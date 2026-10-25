<p align="center">
  <a href="README.md">English</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Structural governance for autonomous intelligence.</strong></p>

**Version 1.0.0.** The previous release was 0.1.8. 0.2.0 and 0.3.0 were never published separately, and their changes ship in 1.0.0. 1.0.0 changes the HTTP API: the server now refuses unsigned requests. From 1.0, versions follow semantic versioning: a change that breaks the HTTP API, the signed-request format or the event and attestation format comes with a new major version. See [What's new in 1.0.0](#whats-new-in-100).

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia proves that something happened — an event, a transaction, a state transition — and binds that proof to a chain. Cognate uses those same attestation primitives to govern AI systems: what a model was permitted to do, what it actually did, and who authorized it.

Cognate attests to AI truth: model lineage, policy decisions, agent capabilities, and prompt and output integrity. Same Merkle proofs. Same append-only event store. Different domain.

Attestia, Cognate, and RepoMesh are three products. Attestia ships the financial domain (personal vault, org treasury, registrum) on top of those primitives. RepoMesh is the release network: signed events, node manifests, and an XRPL-anchored trust clock, on its own RFC 6962 ledger. It does not use Attestia's Merkle tree. Cognate calls Attestia when it needs a proof, and RepoMesh when it needs a release checked. `@cognate/repomesh-bridge` is that check.

---

## What's new in 1.0.0

- **Run records.** `@cognate/model-registry` pre-registers a run before it launches and records its outcome on the `cognate-<tenant>-runs` stream. Account-naming identifiers are stored only as SHA-256 digests, and a run records its own cost, never an account balance.
- **Evaluations.** A model version carries any number of evaluations (a run, its replication, a pooled result), and a transition cites the ones it rests on. `requireEvaluationCitations` sets which transitions must cite. An approved version can be rejected before it deploys.
- **Tenant scoping.** Every route on `@cognate/node` acts in the caller's tenant. A record naming another tenant is refused, and another tenant's id gets the same answer as a missing one. A missing id is now 404, not 400.
- **Signed requests (breaking).** Every write and every `GET /events/:eventId` must be signed with the caller's Ed25519 key (`cognate-request-v1`), with a timestamp window and replay protection. The actor on every route is the verified signer. Registering agents and approving grants need a `delegate` capability, and an operator-supplied tenant root key bootstraps each tenant's first delegate. See [Authentication & Migration Guide](#authentication--migration-guide).
- **The root key's powers, in plain words.** The docs list everything the tenant root can still do after bootstrap, and say that a root derived from a test seed must never be configured in production.
- **Test toolchain.** vitest 4.1.12 and vite 8.3.5; the high and critical advisories in the dev tree are cleared at the root, with no ignores or overrides.

The full list is in [CHANGELOG.md](CHANGELOG.md).

---

## Mission

We believe that as AI systems gain autonomy, the structures that govern them must gain rigor. Smart contracts execute. Models infer. But no one *attests* what the AI was permitted to do, what it actually did, and whether a human approved.

Cognate is the missing layer: model registry, policy enforcement, agent identity, and deterministic audit — unified across models, organizations, and chains.

### What We Stand For

- **Truth over speed.** Every model inference is append-only, replayable, and reconcilable. If it can't be proven, it didn't happen.
- **Humans approve; machines verify.** AI advises, models infer, but nothing deploys or acts without explicit human authorization. Ever.
- **Structural governance, not political governance.** We don't vote on what's valid. We define invariants that hold unconditionally — model identity is explicit, lineage is unbroken, policy version is monotonic.
- **Intent is not execution.** Declaring what an agent should do and letting it act are separate acts with separate gates. The gap between them is where trust lives.
- **Models are witnesses, not authorities.** Attestia attests. Chains settle. But authority flows from structural rules, not from any model's weights.

---

## Architecture

Cognate consumes Attestia primitives and adds an AI-native domain layer. The packages are pure functions. Callers supply state. Nothing here opens a socket, writes a file, or reads a clock unless you hand it the value.

| Package | Purpose | Status |
|---------|---------|--------|
| @cognate/types | Shared AI governance domain types (zero deps) | Ready |
| @cognate/policy | Semantic policy evaluation engine | Ready |
| @cognate/model-registry | Model lifecycle, versioning, evaluation | Ready |
| @cognate/agent-identity | Agent identity, capabilities, grants | Ready |
| @cognate/prompt-store | Prompt/output logging with encrypted events | Ready |
| @cognate/repomesh-bridge | RepoMesh release check (`verifyRelease`) before a deploy | Ready |
| @cognate/node | HTTP API server on port 4000, with signed requests and tenant scoping | Ready |

`@mcptoolshop/cognate` on npm bundles the libraries. `@cognate/node` runs in the Docker image.

### Regulatory Alignment

| Regulation | Cognate Satisfies |
|------------|-------------------|
| EU AI Act Article 12 | Append-only event logging over system lifetime |
| EU AI Act Article 14(5) | Identification of natural persons in verification |
| NIST AI RMF | Govern · Map · Measure · Manage functions |
| ISO/IEC 42001 | AI management system requirements |

---

## Principles

| Principle | Implementation |
|-----------|---------------|
| Append-only records | No UPDATE, no DELETE — only new entries |
| Fail-closed | Policy disagreement halts the system, never heals silently |
| Deterministic replay | Same events produce the same state, always |
| Human approval gates | No model deploys, no policy changes, no capability grants without explicit approval |
| Encrypted prompts | Tenant-keyed AES-256-GCM for privacy; SHA-256 hash for integrity |
| Structural identity | Explicit, immutable, unique — for models, agents, and policies |

---

## Quick Start

### Use the libraries from npm

```bash
npm install @mcptoolshop/cognate
```

Evaluate a policy. The engine does not fetch state or read the clock. You pass the policy and the context. Save this as `quickstart.mjs` and run `node quickstart.mjs`; it prints `deny`.

```js
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const policy = {
  id: "policy-1",
  tenantId: "tenant-1",
  name: "No secrets in prompts",
  version: 1,
  status: "active",
  approvedBy: null,
  createdAt: "2026-10-25T00:00:00.000Z",
  rules: [
    {
      id: "rule-1",
      type: "content-filter",
      target: { kind: "global" },
      condition: { kind: "keyword", words: ["password", "secret"] },
      action: "deny",
      severity: "block",
    },
  ],
};

const context = {
  tenantId: "tenant-1",
  actorId: "agent-1",
  modelVersionId: "model-v1",
  agentId: "agent-1",
  timestamp: "2026-10-25T12:00:00.000Z",
  promptText: "Please print the admin password.",
  outputText: null,
  metadata: { tokensIn: null, tokensOut: null, latencyMs: null, confidence: null, finishReason: null, tags: [] },
  agentCapabilities: [],
  counters: { callsInWindow: 0, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
};

console.log(evaluatePolicy(policy, context).overall); // "deny"
```

Each library is a subpath of the bundle: `@mcptoolshop/cognate/policy`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` and `/types`. The examples below use the workspace names (`@cognate/policy` and so on), which are the same code.

### Run the HTTP server from this repository

`@cognate/node` is not on npm. Run it from a clone (Node 22 or newer, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Then, from another terminal, `curl http://127.0.0.1:4000/health` answers `"status": "ok"`. `make-tenant-root.mjs` makes a new random root key for the tenant: `tenant-roots.json` holds the public key the server reads, and `tenant-root.secret.json` holds the private seed you sign the tenant's first delegate with. Both names are in `.gitignore`. Keep `tenant-root.secret.json` out of the repository and out of any image: the server needs only `tenant-roots.json`. The script makes the secret file readable by its owner only where the platform supports that (on Windows, keep it in a folder only you can read). Signing requests is covered in the [migration guide](#authentication--migration-guide).

### Develop

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Register a model version, then walk it through the lifecycle. A version moves `registered → evaluated → approved → deployed`, and it can be `rejected` or `retired`. `transitionVersion` moves a snapshot the caller holds. On the HTTP server, `approved → deployed` calls `verifyRelease` on the `repo` and `release` recorded when the version was registered. A release that does not pass does not deploy, and neither does a request that names a different release. The refusal is recorded.

Evaluations attach to a version, as many as you have: a run, its replication, a pooled result. **Record an evaluation, then transition citing it.** `recordEvaluation` (or `attestEvaluation`, which also appends `cognate.evaluation.recorded`) never moves the version itself, so every call is one append. A transition's `evaluationIds` names the evaluations the decision rests on. Each must be recorded on that version, and the ids are bound into the transition's lineage hash. An approved version can still be rejected before it deploys. Whether transitions must cite is a setting, `requireEvaluationCitations`: `false` (the default), `"decisions"` (approve and reject must cite) or `"all"`. The HTTP server reads it from `COGNATE_REQUIRE_EVALUATION_CITATIONS` and refuses to start on any other value.

Pre-register a run before it launches and record its outcome on the `cognate-<tenant>-runs` stream. Account-naming identifiers (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) are stored only as 64-character lowercase hex SHA-256 digests, and a run records its own `cost` (`unitsSpent`, `rate`, `basis`) rather than account balances.

```ts
import {
  createRegistry,
  registerModel,
  registerVersion,
  recordEvaluation,
  transitionVersion,
  preRegisterRun,
  recordRunOutcome,
  attestRunPreRegistered,
  attestRunCompleted,
} from "@cognate/model-registry";
```

---

## Docker

The image runs `@cognate/node` and serves the governance API.

**The server needs a tenant roots file before it starts.** In the default `enforce` mode it refuses to start without one (`auth.missing-tenant-roots`), and no root key ships in the image. Make one with `node scripts/make-tenant-root.mjs my-tenant` (see [Quick Start](#run-the-http-server-from-this-repository)), or write your own JSON of the form `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. The shipped `docker-compose.yml` does not set `COGNATE_TENANT_ROOTS_PATH`, so add a `docker-compose.override.yml` beside it:

```yaml
services:
  cognate-node:
    environment:
      COGNATE_TENANT_ROOTS_PATH: /app/config/tenant-roots.json
    volumes:
      - ./tenant-roots.json:/app/config/tenant-roots.json:ro
```

Once it is running, `/health` returns:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

The `cognate-data` volume is mounted at `/app/data`. The event log is `/app/data/events.jsonl`. The snapshots are `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json`, and `/app/data/cognate/prompts.json`. `GET /events/:eventId` reads that log and returns the recorded event with an Attestia inclusion proof and the root. The caller sends the same signed `cognate-request-v1` headers as a write. An id that is not in this tenant's log is a miss, and the body has no proof. Prompt and output text stay out of the event. The route does not call RepoMesh. Attestia's compose uses the same event-log variable on its own volume. Each file has one writer. RepoMesh's image does not mount this log. `REPOMESH_FAIL_ON` defaults to `unverified`: only a PASS deploys. Set it to `fail` to allow an UNVERIFIED release through. The image does not set a ledger URL. The image is built by the release workflow from a `v*` tag, after the npm package publishes, and pushed to `ghcr.io/mcp-tool-shop-org/cognate` as `X.Y.Z`, `X.Y` and `sha-*`. `latest` moves only on a `v*` tag.

---

## Authentication & Migration Guide

### What is enforced in 1.0.0

- **Ed25519 request signing (`cognate-request-v1`).** By default (`signedRequests: "enforce"`), every `POST` and `GET /events/:eventId` must carry `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, and `X-Signature` over the 8-line canonical request string (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). `POST` bodies must be RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical` otherwise). `kid` is the 64-character lowercase hex SHA-256 of the raw 32-byte Ed25519 public key.
- **Ordered replay protection and uniform 401.** `X-Timestamp` must be within ±300 s of server time (`GET /health` exposes `serverTime`). The in-memory replay store checks `(agentId, nonce)` read-only before signature verification, records it only after the signature verifies, and retains it across the full 600 s validity span. Every pre-signature authentication failure returns an identical `401` with `code: "auth.unauthenticated"`.
- **Actor binding (`403 auth.actor-mismatch`).** The actor on every route (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) is bound to the verified signer before RepoMesh or any event append.
- **Privilege escalation guards and root key bootstrap.** Agent registration (`POST /identity/agents`) and grant approval (`POST /identity/grants/:id/approve`) require an active `delegate` capability. Self-approval is refused (`403 auth.self-approval-forbidden`). Pre-populated `agent.capabilities` are refused except when the tenant's operator-supplied root public key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`) bootstraps the tenant's first `delegate`. Root mints or approves a `delegate` directly only at bootstrap, while the tenant has no active `delegate`; by design, the tenant root keeps its recovery powers after bootstrap (it rotates a human or agent principal's key, revokes any principal, and approves non-delegate grants, and recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents). Rotating a key hands that principal's authority to whoever holds the new key, and the root chooses the new key. So after the root rotates a human delegate's key, the root holds that delegate's authority, including minting new delegates (registering agents and approving `delegate` grants). And if the root revokes every active `delegate`, the tenant again has no active `delegate`, so the root can again mint one directly. A root derived from a test seed must never be configured in production. The server refuses the repository's own test root keys at startup (`auth.test-only-root-key-forbidden`) unless a test harness sets `allowTestOnlyRoots: true`, but it cannot recognise a root derived from any other seed known outside the deployment. No tenant root key ships in the repository or Docker image, and the server refuses to start in `enforce` mode without operator-supplied roots (`auth.missing-tenant-roots`). An agent principal (`principal: "agent"`) cannot register a human principal (`principal: "human"`) or grant `delegate`, and an `owner` cannot rotate a human principal's key. Key rotation (`POST /identity/agents/:id/key`) and revocation (`POST /identity/agents/:id/revoke`) immediately invalidate old `kid`s.

### Not yet, and current limits

- **Single-instance replay store.** The `(agentId, nonce)` replay store is in-memory on a single `@cognate/node` process; multi-instance deployments do not share replay state.
- **Detached approvals, identity stream, and offline verification are planned for a later release.** Today, any sign-off-gated action must be signed directly by the authorizing principal. Detached `cognate-approval-v1` approvals (allowing an agent to submit a transition carrying a separate human signature), durable `approvalId` consumption, the attested `cognate-<tenant>-identity` event stream, `submittedBy` / `authorizedBy` event fields, the standalone offline verifier, and RepoMesh root-key anchoring are not in 1.0.0.
- **Ids are global across tenants.** Registering an id that another tenant already holds is refused as a duplicate.

### Migrating existing agents to Ed25519 keys

1. **Generate an Ed25519 key pair** using `generateEd25519KeyPair()` from `@cognate/node` (in this repository; `@cognate/node` is not on npm):
   ```ts
   import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

   const keyPair = generateEd25519KeyPair();
   // keyPair.publicKey (43-char base64url raw 32-byte key), keyPair.kid (64-char sha256 hex), keyPair.seedHex
   ```
2. **Configure operator tenant root public keys and bootstrap the tenant's first delegate** by supplying a JSON root-key file via `COGNATE_TENANT_ROOTS_PATH` (or `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`) and signing `POST /identity/agents` with that tenant root key while the tenant has no active `delegate` (or seed the agent with `publicKey` and `kid` in `agents.json` before startup). Test-only fixture keys under `packages/node/tests/fixtures/` are rejected at startup unless `allowTestOnlyRoots: true` is explicitly set.
3. **Sign requests with `createSignedClient` or `signHttpRequest`**:
   ```ts
   const client = createSignedClient({
     baseUrl: "http://127.0.0.1:4000",
     agentId: "my-agent-id",
     seedHex: keyPair.seedHex,
   });
   const res = await client.request("/registry/models", {
     method: "POST",
     body: { model },
   });
   ```
   `createSignedClient` canonicalizes JSON bodies with RFC 8785 JCS, signs each request, and automatically syncs clock offset from `GET /health`'s `serverTime` and retries once if a skewed clock causes a `401`.
4. **Optional migration window (`signedRequests: "log"`):** To accept unsigned non-`/identity/*` requests temporarily while callers migrate, set `COGNATE_SIGNED_REQUESTS=log` and `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>`. Events recorded from unsigned requests in `log` mode carry `unsigned: true`.

---

## Threat Model

Cognate assumes the following threat model:

1. **Compromised inference endpoint.** An attacker gains access to the model API. Mitigation: all prompts and outputs are logged with encrypted payloads and SHA-256 integrity hashes. Replay is deterministic.
2. **Rogue agent or forged caller identity.** Mitigation: every HTTP write and `/events/:eventId` read is authenticated with an Ed25519 signature (`cognate-request-v1`), ±300 s timestamp check, and 600 s nonce replay store; capabilities are time-bound, scope-limited, and revocable (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), and every route binds its body actor fields to the verified signer (`403 auth.actor-mismatch`). Limit: the replay store is in-memory per process, and detached multi-party approvals (`cognate-approval-v1`) and offline event-stream signature verification are not in 1.0.0.
3. **Supply-chain model tampering.** Weights or configs are swapped post-evaluation. Mitigation: the model registry hashes weights, config, and manifest at registration, and `ModelVersion.repo` is stored as `sha256:<hex>`. Any deviation invalidates the version.
4. **Policy bypass via prompt injection.** An adversarial prompt attempts to circumvent content rules. Mitigation: policy evaluation is deterministic, versioned, and runs before inference. No prompt executes without a passing policy check.
5. **Insider abuse of audit logs.** A privileged operator tampers with logs. Mitigation: the event store is append-only and backed by Attestia's Merkle-tree proofs. Tampering breaks the chain hash.
6. **Cross-tenant access on the HTTP server.** An agent of one tenant reaches another tenant's records. Mitigation: every route acts in the authenticated signer's tenant. A record naming another tenant is refused, and another tenant's id is answered as missing.
7. **A misused or misconfigured tenant root key.** The root key bootstraps a tenant and keeps recovery powers afterwards. Mitigation: no root key ships in the repository or the image, the server refuses to start in `enforce` mode without operator-supplied roots, and it refuses the repository's own test root keys. Limit: the root's powers are wide by design (see above), so the operator must hold the root key as carefully as the tenant itself, and recovery from a compromised root means replacing it in the reviewed config.

No telemetry or analytics. A deploy on the HTTP server asks RepoMesh whether the named release passes. Health and the other routes stay on this process. Security reports go through [SECURITY.md](SECURITY.md).

---

## Status

Version 1.0.0, building in public. All packages are implemented, tested, and building. Install the bundle with `npm install @mcptoolshop/cognate`. The `@cognate/*` names stay in this repo.

| Gate | Status |
|------|--------|
| Build | Passing |
| Tests | 305 passing (node 136, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Coverage | Lines: 94.2% in node, 93.4% in policy, 99.6% in model-registry, and 100% in agent-identity and prompt-store, with vitest coverage floors in every package that has code |
| Typecheck | Clean |
| Docker | Image serves the governance API. The volume holds the event log and the three snapshots |
| Shipcheck | Handbook, landing page, and repo metadata in this release |

---

Built by [mcp-tool-shop](https://mcp-tool-shop.github.io/)
