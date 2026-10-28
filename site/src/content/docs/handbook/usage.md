---
title: Usage
description: Choose a plan with the civility kernel, then call the policy engine, the model registry, agent identity, and the prompt store.
sidebar:
  order: 2
---

Every call takes the state you already have. None of these functions read the filesystem or the network, and only the kernel's `decide` reads the clock, when you don't pass it a time.

The examples use the workspace names (`@cognate/policy` and so on). From npm, import the same functions from the bundle's subpaths: `@mcptoolshop/cognate/civility-kernel`, `@mcptoolshop/cognate/policy`, `@mcptoolshop/cognate/model-registry`, `@mcptoolshop/cognate/agent-identity`, `@mcptoolshop/cognate/prompt-store`, `@mcptoolshop/cognate/repomesh-bridge` and `@mcptoolshop/cognate/types`.

## Choose a plan (new in 1.1.0)

Before an agent acts, the civility kernel chooses among its candidate plans. Plans that break a hard constraint are dropped, the rest are scored by the policy's weights, and the top plan executes unless its uncertainty is over the policy's threshold.

```ts
import { createKernel, computeDecisionDigests } from "@cognate/civility-kernel";

const kernel = createKernel({
  policy: {
    version: "1.0",
    weights: { efficiency: 0.3, low_risk: 0.7 },
    constraints: ["no_irreversible_changes"],
    contextRules: [],
    uncertaintyThreshold: 0.4,
    memory: {},
    calibration: { riskTolerance: 0.3, verbosity: 0.5, initiative: 0.5 },
  },
});

const plans = [
  { id: "drop-and-reload", summary: "Drop the table and reload it", steps: [], meta: { reversibility: 0, estimatedTimeSec: 30 } },
  { id: "migrate-with-backup", summary: "Back up, then migrate", steps: [], meta: { reversibility: 1, estimatedTimeSec: 300, stake: 0.2 } },
];

const trace = kernel.decide("deploy:db", plans, { decisionId: "dec-1", timestamp: "2026-10-28T12:00:00.000Z" });
trace.outcome;      // "EXECUTE"
trace.chosenPlanId; // "migrate-with-backup": the irreversible plan broke no_irreversible_changes

const { planSha256, decisionSha256 } = computeDecisionDigests(trace, plans[1]);
// two 64-character hex digests, the form preRegisterRun takes
```

With only `drop-and-reload` offered, the outcome is `NO_VALID_PLAN`. Give `migrate-with-backup` a `meta.uncertainty` of 0.9 and it is `ASK_USER`: the kernel asks a person rather than act. In both cases `chosenPlanId` is undefined.

Without `decisionId` and `timestamp`, `decide` uses a random id and the current time. Pass both and the same inputs give a byte-identical trace.

To record the decision, `attestDecision({ eventStore, tenantId, actorId }, trace, plans[1])` appends `cognate.policy.decided` to `cognate-<tenantId>-policy`. The event carries the digests, the outcome, the chosen plan's id, and the constraints each rejected plan broke. It never carries plan steps.

## Policy

Once a plan runs, the policy engine gates each event: every prompt, output or spend. `evaluatePolicy` returns one overall action. Precedence is `deny`, then `quarantine`, then `require-human-review`, then `allow`. A matched rule with severity `block` is what stops the call.

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
  preRegisterRun,
  recordRunOutcome,
  attestRunPreRegistered,
  attestRunCompleted,
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

Pre-register a run before launch with `preRegisterRun` and record its completion, cancellation, or loss with `recordRunOutcome`. `attestRunPreRegistered` and `attestRunCompleted` append `cognate.run.preregistered` and `cognate.run.completed` to the `cognate-${tenantId}-runs` stream on Attestia's `EventStore`. Every account-naming identifier on a run is stored only as a 64-character lowercase hex SHA-256 digest, and a run records its own `cost` (`unitsSpent`, `rate`, `basis`), never the account's starting or ending balance.

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
