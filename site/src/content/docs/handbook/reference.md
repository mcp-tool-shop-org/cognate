---
title: Reference
description: Exported functions for the five Cognate packages.
sidebar:
  order: 4
---

Versions in this cut are `0.1.0`. The packages are workspace libraries. They are not published to npm.

## @cognate/policy

| Export | Role |
|--------|------|
| `evaluatePolicy(policy, context)` | Returns `policyId`, `policyVersion`, `evaluatedAt`, `overall`, and the per-rule results |
| `hasCapability` | Capability predicate used by policy checks |
| `isCapabilityActive` | Whether a capability is live in the context you passed |

`overall` is one of `deny`, `quarantine`, `require-human-review`, `allow`.

`EvaluationContext` includes `tenantId`, `actorId`, `modelVersionId`, `agentId`, `timestamp`, `promptText`, `outputText`, `metadata`, `agentCapabilities`, and `counters`.

## @cognate/model-registry

| Export | Role |
|--------|------|
| `createRegistry` | Empty registry state |
| `registerModel` | Record a model and its owner |
| `registerVersion` | Record weights, config, and manifest hashes |
| `transitionVersion` | Move a version through the lifecycle |
| `getVersionHistory` | Prior transitions |
| `getCurrentDeployedVersion` | The version whose state is `deployed` |
| `RegistryError` | `code`, `message`, `hint` |

Version states: `registered`, `evaluated`, `approved`, `deployed`, `rejected`, `retired`.

## @cognate/agent-identity

| Export | Role |
|--------|------|
| `createRegistry` | Empty identity registry |
| `registerAgent` | Record an agent |
| `getAgent` | Read one agent |
| `requestGrant` | Ask for a capability. This does not activate it |
| `approveGrant` / `rejectGrant` | The human gate |
| `revokeCapability` | End a grant |
| `getActiveCapabilities` | Live capabilities for an agent |
| `isCapabilityActive` / `hasCapability` | Predicates over the state you pass |
| `getGrantsForAgent` | Grant history |

## @cognate/prompt-store

| Export | Role |
|--------|------|
| `createStore` | Empty store state |
| `logPrompt` / `logOutput` | Append a record |
| `getPrompt` / `getOutput` | Read one record |
| `getOutputsForPrompt` | Outputs tied to a prompt |
| `getSessionPrompts` | Prompts in a session |
| `getModelVersionPrompts` | Prompts for a model version |
| `getPromptsByAgent` | Prompts for an agent |
| `getPromptsInRange` | Prompts in a time range |
| `encrypt` / `decrypt` | AES-256-GCM with the tenant key you pass |
| `hashPlaintext` | SHA-256 |
| `serializePayload` / `deserializePayload` | Encrypted payload codec |

## @cognate/types

Shared types only. Notable nouns: `Model`, `ModelVersion`, `Policy`, `PolicyRule`, `DatasetRef`, and the branded ids `HashId`, `Timestamp`, `TenantId`, `ActorId`.

Model architectures: `transformer`, `diffusion`, `mamba`, `rnn`, `cnn`, `hybrid`, `other`.

Policy rule types: `content-filter`, `capability-limit`, `rate-limit`, `guardrail`, `composite`.
