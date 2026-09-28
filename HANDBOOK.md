# Cognate

**Structural governance for autonomous intelligence.**

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia proves that something happened — an event, a transaction, a state transition — and binds that proof to a chain. Cognate uses those same attestation primitives to govern AI systems: what a model was permitted to do, what it actually did, and who authorized it.

Where Attestia attests to financial truth, Cognate attests to AI truth — model lineage, policy decisions, agent capabilities, and prompt/output integrity. Same Merkle trees. Same append-only event store. Different domain.

The v0.1.0 cut is five libraries. They are pure functions. You pass in the clock, the tenant key, and the store. They do not open a socket, and they do not publish a governance HTTP API. The Docker image says so: `/health` returns `"mode": "placeholder"`.

The pages under `site/` are this same handbook, with install, usage, and the package reference beside it.

## Install

The workspace needs Node 22 or newer and pnpm 10.28.2.

```bash
pnpm install
pnpm verify
```

`pnpm verify` builds every package, runs the tests, and typechecks. There is no global CLI. Each package is imported by the application that owns the clock, the keys, and the store.

## Packages

| Package | What you call | What it refuses to do |
|---------|---------------|------------------------|
| `@cognate/types` | Domain types: models, versions, policies, agents, hashes | Runtime behavior. Zero dependencies |
| `@cognate/policy` | `evaluatePolicy(policy, context)` | I/O, clocks, hidden state |
| `@cognate/model-registry` | `createRegistry`, `registerModel`, `registerVersion`, `transitionVersion` | Deploying a model that was not approved |
| `@cognate/agent-identity` | `registerAgent`, `requestGrant`, `approveGrant`, `revokeCapability` | Granting a capability without an approval |
| `@cognate/prompt-store` | `logPrompt`, `logOutput`, `encrypt`, `decrypt` | Storing plaintext prompts |

Build scripts run `pnpm exec tsc` so the compiler resolves inside a pnpm workspace, including the Docker builder.

## Policy

`evaluatePolicy` is a pure function. The same policy and the same context always return the same result. You supply `context.timestamp`. The engine does not read the clock.

Matched rules resolve to one overall action. Precedence is `deny`, then `quarantine`, then `require-human-review`, then `allow`. A `block` severity on a matched rule is what stops the call. Disagreement fails closed. The engine does not rewrite the policy to make the call succeed.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, {
  tenantId,
  actorId,
  modelVersionId,
  agentId,
  timestamp: "2026-09-28T00:00:00.000Z",
  promptText,
  outputText: null,
  metadata: {
    tokensIn: null,
    tokensOut: null,
    latencyMs: null,
    confidence: null,
    finishReason: null,
    tags: [],
  },
  agentCapabilities: [],
  counters: {
    callsInWindow: 0,
    windowSeconds: 60,
    spendInWindow: 0,
    spendCurrency: "USD",
  },
});
```

Rule types are `content-filter`, `capability-limit`, `rate-limit`, `guardrail`, and `composite`. A rule targets one model, one agent, one tenant, or the whole system.

## Model registry

A model has an owner, an architecture, and at most one current version. A version records three hashes: weights, config, and manifest. It also records dataset refs and whether consent was verified.

Legal version states are `registered`, `evaluated`, `approved`, `deployed`, `rejected`, and `retired`. `transitionVersion` is the only way to move. `getCurrentDeployedVersion` returns the version that is actually deployed, which is not the same as the newest version.

`RegistryError` carries `code`, `message`, and `hint`.

## Agent identity

An agent is an actor with capabilities. The sequence is `requestGrant`, then `approveGrant` or `rejectGrant`. `revokeCapability` ends a grant. `isCapabilityActive` and `hasCapability` answer questions about the registry state you pass in. They do not consult a server.

A stolen key is not a new identity. Capabilities are time-bound, scoped, and revocable. Approval is a separate act from the request.

## Prompt store

`logPrompt` and `logOutput` append. They do not update or delete. `encrypt` and `decrypt` use AES-256-GCM with a tenant key the caller holds. `hashPlaintext` is SHA-256, for integrity, and it is not a substitute for encryption.

The store indexes by session, model version, agent, and time range. Those queries read the state object you pass. They do not open a database.

## Docker

`docker compose up -d` builds `Dockerfile` and publishes port 4000. The process behind that port is a health server. It is there so the image can be supervised. It is not the governance API.

```bash
curl http://localhost:4000/health
```

```json
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

The `cognate-data` volume mounts at `/app/data`. Prompt and agent files belong there when a service starts writing them. Nothing in v0.1.0 writes those files yet.

The image is pushed to `ghcr.io/mcp-tool-shop-org/cognate` when a GitHub release is published. Local builds use the same Dockerfile.

## Threat model

1. A compromised inference endpoint is answered by encrypted prompt and output records plus a SHA-256 integrity hash.
2. A stolen agent key is answered by time-bound, scoped, revocable capabilities. Every grant needs an explicit approval.
3. Swapped weights are answered by the three hashes recorded at registration. A mismatch is a different version, not a silent edit.
4. Prompt injection is answered by evaluating policy before inference. A failing check does not execute.
5. Tampered logs are answered by append-only records. Attestia's Merkle proofs are the settlement layer under those records.

No package phones home. There is no telemetry switch to turn off, because there is no telemetry.

## What v0.1.0 does not include

The five packages do not open an HTTP API, do not publish to npm, and do not choose a model provider. The Docker image tells you that directly: `mode` is `placeholder`. The next service layer should call these functions. It should not reimplement them.
