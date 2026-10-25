# Cognate

**Structural governance for autonomous intelligence.**

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia proves that something happened — an event, a transaction, a state transition — and binds that proof to a chain. Cognate uses those same attestation primitives to govern AI systems: what a model was permitted to do, what it actually did, and who authorized it.

Cognate attests to AI truth: model lineage, policy decisions, agent capabilities, and prompt and output integrity. Same Merkle proofs. Same append-only event store. Different domain.

Attestia, Cognate, and RepoMesh are three products. Attestia ships the financial domain (personal vault, org treasury, registrum) on top of those primitives. RepoMesh is the release network: signed events, node manifests, and an XRPL-anchored trust clock, on its own RFC 6962 ledger. It does not use Attestia's Merkle tree. Cognate calls Attestia when it needs a proof, and RepoMesh when it needs a release checked.

The npm package `@mcptoolshop/cognate` is those libraries in one bundle. They are pure functions. You pass in the clock, the tenant key, and the store. `@cognate/node` is a separate HTTP layer over the same functions. Its `/health` returns `"mode": "api"`. `@cognate/repomesh-bridge` checks a release on the RepoMesh ledger.

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
| `@cognate/types` | Domain types: models, versions, runs (`RunPreRegistration`, `RunOutcome`), policies, agents, hashes | Runtime behavior, plaintext account-naming identifiers, or account balance fields. Zero dependencies |
| `@cognate/policy` | `evaluatePolicy(policy, context)` | I/O, clocks, hidden state |
| `@cognate/model-registry` | `createRegistry`, `registerModel`, `registerVersion`, `transitionVersion`, `preRegisterRun`, `recordRunOutcome`, `attestRunPreRegistered`, `attestRunCompleted` | Deploying an unapproved model, recording a run outcome without a pre-registration, or storing unhashed account identifiers or account balances |
| `@cognate/agent-identity` | `registerAgent`, `requestGrant`, `approveGrant`, `revokeCapability` | Granting a capability without an approval |
| `@cognate/prompt-store` | `logPrompt`, `logOutput`, `encrypt`, `decrypt` | Storing plaintext prompts |
| `@cognate/repomesh-bridge` | `verifyRelease`, `verifyAll` on the RepoMesh ledger | Running the ledger, anchoring to XRPL, or sharing Attestia's Merkle tree |

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

Legal version states are `registered`, `evaluated`, `approved`, `deployed`, `rejected`, and `retired`. `transitionVersion` is the only way to move a snapshot the caller holds, and that call stays inside the state machine. The HTTP server calls `verifyRelease` before it moves a version from `approved` to `deployed`, using the `repo` and `release` recorded when the version was registered. A release that does not pass does not deploy, and neither does a request that names a different release. `getCurrentDeployedVersion` returns the version that is actually deployed, which is not the same as the newest version.

Runs are pre-registered before launch with `preRegisterRun` (`RunPreRegistration`: `planSha256`, `decisionSha256`, `caps`, `plannedCard`, `approvedBy`, `registeredAt`) and closed out with `recordRunOutcome` (`RunOutcome`: `status` in `in_progress`, `completed`, `cancelled`, `lost`; `retirement` / `retirementReason`; `startedAt`, `endedAt`, `recordedAt`, `outcomeSha256`, and `cost`). `attestRunPreRegistered` and `attestRunCompleted` append `cognate.run.preregistered` and `cognate.run.completed` events to the `cognate-${tenantId}-runs` stream on Attestia's `EventStore`. Every account-naming identifier (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `ownerSha256`, `repoOwnerSha256`, `githubUserSha256`, `hfOwnerSha256`, `usernameSha256`, `accountSha256`, `emailSha256`, `authorEmailSha256`, `homePathSha256`) is stored only as a 64-character lowercase hex SHA-256 digest; plaintext repo slugs, email addresses, `@handle` tokens, and home paths are rejected (`validateHashedIdentifiers`, `validateRunPreRegistration`, `validateRunOutcome`). A run records its own `cost` (`unitsSpent`, `rate`, `basis` in `rate_x_runtime | measured | estimate | pending | zero`), never the account's starting or ending balance (`startBalance`, `endBalance`, or any `*balance*` key), because a persistent balance across runs fingerprints the operator's billing account.

`RegistryError` carries `code`, `message`, and `hint`.

## Agent identity

An agent is an actor with capabilities. The sequence is `requestGrant`, then `approveGrant` or `rejectGrant`. `revokeCapability` ends a grant. `isCapabilityActive` and `hasCapability` answer questions about the registry state you pass in. They do not consult a server.

A stolen key is not a new identity. Capabilities are time-bound, scoped, and revocable. Approval is a separate act from the request.

## Prompt store

`logPrompt` and `logOutput` append. They do not update or delete. `encrypt` and `decrypt` use AES-256-GCM with a tenant key the caller holds. `hashPlaintext` is SHA-256, for integrity, and it is not a substitute for encryption.

The store indexes by session, model version, agent, and time range. Those queries read the state object you pass. They do not open a database.

## Docker

`docker compose up -d` builds `Dockerfile` and publishes port 4000. The process is `@cognate/node`. It serves the governance routes. A restart reads the three snapshots back from the volume.

```bash
curl http://localhost:4000/health
```

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

The `cognate-data` volume mounts at `/app/data`. The event log is `/app/data/events.jsonl` (`ATTESTIA_EVENTS_FILE`). The snapshots are `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json`, and `/app/data/cognate/prompts.json`. `GET /events/:eventId` reads that log and returns the recorded event with an Attestia inclusion proof and the root. The caller sends the same signed `cognate-request-v1` headers as a write. An id that is not in this tenant's log is a miss, and the body has no proof. Prompt and output text stay out of the event. The route does not call RepoMesh. Attestia's compose uses the same event-log variable on its own `attestia-data` volume. Each file has one writer. RepoMesh's image does not mount this log. `REPOMESH_FAIL_ON` defaults to `unverified`: only a PASS deploys. Set it to `fail` to allow an UNVERIFIED release through. The image does not set a ledger URL.

The image is pushed to `ghcr.io/mcp-tool-shop-org/cognate` when a GitHub release is published. Local builds use the same Dockerfile.

## Authentication and migration guide (`@cognate/node`)

- **What is proved now (PR a):** `@cognate/node` enforces `cognate-request-v1` Ed25519 request signatures (`X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, `X-Signature`) over an 8-line canonical string and RFC 8785 JCS-canonical JSON bodies (`400 auth.body-not-canonical` otherwise), with a ±300 s timestamp window, a 600 s ordered replay store, and a uniform `401 auth.unauthenticated` response. Every route binds its body actor fields to the verified signer (`403 auth.actor-mismatch`) before RepoMesh or any Attestia append. Agent registration and grant approval require `delegate`, self-approval is refused (`403 auth.self-approval-forbidden`), `principal: "agent"` cannot register `principal: "human"` or grant `delegate`, an `owner` cannot rotate a human principal's key, and the operator-supplied tenant root key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`; no root keys ship in the repo or image) mints a `delegate` only at bootstrap, while the tenant has no active `delegate` (recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents).
- **What comes in PR (b) and current limits:** The `(agentId, nonce)` replay store is in-memory on a single server instance. Under PR (a), any sign-off-gated action must be signed by the authorizing principal itself; detached `cognate-approval-v1` approvals, durable `approvalId`s, the `cognate-<tenant>-identity` stream, `submittedBy` / `authorizedBy` on events, and the standalone offline verifier come in PR (b).
- **Migration guide:** Generate an Ed25519 key pair with `generateEd25519KeyPair()`, supply operator root public keys via `COGNATE_TENANT_ROOTS_PATH` (or `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`), bootstrap the tenant's first `delegate` via `POST /identity/agents` signed by that tenant root key while the tenant has no active `delegate`, and send requests with `createSignedClient` or `signHttpRequest` (which canonicalize bodies with JCS, sync clock offset from `GET /health`'s `serverTime`, and retry once on `401`). For a bounded migration window (at most 14 days), set `COGNATE_SIGNED_REQUESTS=log` and `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp>`; `/identity/*` stays signed even in `log` mode, and unsigned events are marked `unsigned: true`.

## Threat model

1. A compromised inference endpoint is answered by encrypted prompt and output records plus a SHA-256 integrity hash.
2. A stolen or forged caller identity is answered by Ed25519 request signing (`cognate-request-v1`), actor binding (`403 auth.actor-mismatch`), privilege-escalation guards, and time-bound, scoped, revocable capabilities (`POST /identity/agents/:id/key`, `POST /identity/agents/:id/revoke`).
3. Swapped weights are answered by the three hashes recorded at registration and `ModelVersion.repo` stored as `sha256:<hex>`. A mismatch is a different version, not a silent edit.
4. Prompt injection is answered by evaluating policy before inference. A failing check does not execute.
5. Tampered logs are answered by append-only records. Attestia's Merkle proofs are the settlement layer under those records.

No package sends telemetry. There is no analytics switch to turn off, because there is no analytics client. A deploy on the HTTP server calls RepoMesh `verifyRelease`. That call may reach the release ledger. It is the release check.

## What this release does not include

`@mcptoolshop/cognate` is `0.3.0`. `@cognate/node` is the HTTP layer. It calls the libraries. It does not choose a model provider.
