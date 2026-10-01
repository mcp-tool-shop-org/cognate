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
  transitionVersion,
  getCurrentDeployedVersion,
} from "@cognate/model-registry";
```

A version stores three hashes: weights, config, and manifest. `getCurrentDeployedVersion` is the deployed version, which is not automatically the newest one. `RegistryError` carries `code`, `message`, and `hint`.

On the HTTP server, `approved → deployed` also calls `verifyRelease`. The request names `repo` and `release`. A release that does not pass does not deploy, and the refusal is recorded. `transitionVersion` stays the state machine: a caller who holds a snapshot moves it without that check.

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
