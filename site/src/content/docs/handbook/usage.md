---
title: Usage
description: Call the policy engine, the model registry, agent identity, and the prompt store.
sidebar:
  order: 2
---

Every call takes the state you already have. None of these functions read the clock, the filesystem, or the network.

## Policy

`evaluatePolicy` returns one overall action. Precedence is `deny`, then `quarantine`, then `require-human-review`, then `allow`. A matched rule with severity `block` is what stops the call.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // do not call the model
}
```

`context.timestamp` is yours. Pass an ISO 8601 string. The engine will not call `Date.now()`.

## Model registry

Create a registry, register the model, register a version, then transition it. The legal states are `registered`, `evaluated`, `approved`, `deployed`, `rejected`, and `retired`.

```ts
import {
  createRegistry,
  registerModel,
  registerVersion,
  recordEvaluation,
  transitionVersion,
  getCurrentDeployedVersion,
} from "@cognate/model-registry";
```

**Record an evaluation, then transition citing it.** A version takes any number of evaluations: a run, its replication, a pooled result. Recording one never moves the version, so each call makes one append and the log can't be left half-written. The transition names what it rests on:

```ts
let s = recordEvaluation(state, run);          // run.modelVersionId === "v1"
s = recordEvaluation(s, replication);
s = transitionVersion(s, "v1", "registered", "evaluated", "rnd", "both runs in", {
  evaluationIds: [run.id, replication.id],
});
```

Each cited id must be an evaluation recorded on that version. The ids go into the transition, its event and its lineage hash. A transition that cites nothing is recorded and hashed exactly as before. An approved version can be rejected before it deploys, for example when a replication reverses the run the approval rested on.

`requireEvaluationCitations` decides which transitions must cite:

| Value | Must cite |
|-------|-----------|
| `false` (default) | none |
| `"decisions"` | moves to `approved` or `rejected` |
| `"all"` | every transition |

The HTTP server reads it from `COGNATE_REQUIRE_EVALUATION_CITATIONS` and won't start on any other value. `POST /registry/versions/:id/evaluations` records an evaluation and returns its event id, and `GET /events/:eventId` proves it.

A version stores three hashes: weights, config, and manifest. `getCurrentDeployedVersion` is the deployed version, which is not automatically the newest one. `RegistryError` carries `code`, `message`, and `hint`.

On the HTTP server, `approved → deployed` calls `verifyRelease` on the `repo` and `release` recorded when the version was registered. A release that does not pass does not deploy, and neither does a request that names a different release. The refusal is recorded. `transitionVersion` stays the state machine: a caller who holds a snapshot moves it without that check.

`GET /events/:eventId` reads the log the server already writes and returns that event with an Attestia inclusion proof and the root. The caller sends the same agent headers as a write. An id that is not in this tenant's log is a miss, and the body has no proof. Prompt and output text stay out of the event. The route does not call RepoMesh.

## Agent identity

The grant sequence is request, then approve or reject. Revocation is its own call.

```ts
import {
  registerAgent,
  requestGrant,
  approveGrant,
  rejectGrant,
  revokeCapability,
  isCapabilityActive,
} from "@cognate/agent-identity";
```

`isCapabilityActive` answers from the registry state you pass. It does not ask a server.

## Prompt store

Log, then encrypt. The tenant key stays with the caller.

```ts
import { createStore, logPrompt, logOutput, encrypt, decrypt, hashPlaintext } from "@cognate/prompt-store";
```

`logPrompt` and `logOutput` append. `encrypt` is AES-256-GCM. `hashPlaintext` is SHA-256 for integrity. The hash is not a substitute for encryption.
