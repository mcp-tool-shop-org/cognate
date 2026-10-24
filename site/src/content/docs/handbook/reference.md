---
title: Reference
description: Exported functions for the five Cognate packages.
sidebar:
  order: 4
---

`@mcptoolshop/cognate` is `0.1.8` on npm. The `@cognate/*` packages stay in this workspace and are inlined into that bundle.

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
| `transitionVersion` | Move a version through the lifecycle, optionally citing `evaluationIds` |
| `recordEvaluation` | Attach an evaluation to a version; not a transition |
| `attestEvaluation` | `recordEvaluation` plus one `cognate.evaluation.recorded` append |
| `getEvaluations` | A version's evaluations, in recorded order |
| `getVersionHistory` | Prior transitions |
| `getCurrentDeployedVersion` | The version whose state is `deployed` |
| `preRegisterRun` | Record a `RunPreRegistration` before launch |
| `recordRunOutcome` | Record a `RunOutcome` linked to a pre-registered run |
| `getRunPreRegistration` / `getRunOutcomes` | Read pre-registrations and outcomes from the registry snapshot |
| `attestRunPreRegistered` / `attestRunCompleted` | Append `cognate.run.preregistered` and `cognate.run.completed` on the `cognate-${tenantId}-runs` stream |
| `isSha256Hex` / `validateHashedIdentifiers` / `validateRunPreRegistration` / `validateRunOutcome` | Enforce the hashed-identifier rule and reject plaintext identifiers or account balance fields |
| `RegistryError` | `code`, `message`, `hint` |

Version states: `registered`, `evaluated`, `approved`, `deployed`, `rejected`, `retired`. `approved` can move to `deployed` or `rejected`.

`requireEvaluationCitations` (transition option; server env `COGNATE_REQUIRE_EVALUATION_CITATIONS`): `false` (default), `"decisions"` or `"all"`.

Errors added with evaluations: `EVALUATION_ALREADY_RECORDED`, `EVALUATION_TENANT_MISMATCH`, `EVALUATION_ON_CLOSED_VERSION`, `EVALUATION_NOT_FOUND`, `EVALUATION_IDS_EMPTY`, `EVALUATION_CITATION_REQUIRED`, `INVALID_CITATION_RULE`. On the HTTP server, `registry.invalid-evaluation-ids` refuses a transition whose `evaluationIds` is not an array of strings.

Run statuses: `in_progress`, `completed`, `cancelled`, `lost`.

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

## @cognate/node: tenant scoping

Every POST acts in the authenticated agent's tenant.

| Request names | Answer |
|---------------|--------|
| A record for another tenant (model, version, prompt, output, policy or its context, agent, grant) | 400 `registry.tenant-mismatch`, `prompts.tenant-mismatch`, `policy.tenant-mismatch` or `identity.tenant-mismatch` |
| Another tenant's version, model, prompt, agent or grant by id | The same 404 a missing id gets |
| A body id that differs from the path id | 400 `registry.version-id-mismatch` or `prompts.prompt-id-mismatch` |

A missing id is 404: `VERSION_NOT_FOUND`, `MODEL_NOT_FOUND`, `store.prompt-not-found`, `identity.agent-not-found`, `identity.grant-not-found`, `vc.grant-not-found`. The caller is identified by an unsigned `X-Agent-Id`, so this scoping is not authentication.

## @cognate/types

Shared types only. Notable nouns: `Model`, `ModelVersion`, `RunPreRegistration`, `RunOutcome`, `RunCost`, `RunCostBasis`, `RunStatus`, `RunRetirement`, `Policy`, `PolicyRule`, `DatasetRef`, and the branded ids `HashId`, `Timestamp`, `TenantId`, `ActorId`.

Model architectures: `transformer`, `diffusion`, `mamba`, `rnn`, `cnn`, `hybrid`, `other`.

Policy rule types: `content-filter`, `capability-limit`, `rate-limit`, `guardrail`, `composite`.
