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

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia proves that something happened — an event, a transaction, a state transition — and binds that proof to a chain. Cognate uses those same attestation primitives to govern AI systems: what a model was permitted to do, what it actually did, and who authorized it.

Cognate attests to AI truth: model lineage, policy decisions, agent capabilities, and prompt and output integrity. Same Merkle proofs. Same append-only event store. Different domain.

Attestia, Cognate, and RepoMesh are three products. Attestia ships the financial domain (personal vault, org treasury, registrum) on top of those primitives. RepoMesh is the release network: signed events, node manifests, and an XRPL-anchored trust clock, on its own RFC 6962 ledger. It does not use Attestia's Merkle tree. Cognate calls Attestia when it needs a proof, and RepoMesh when it needs a release checked. `@cognate/repomesh-bridge` is that check.

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

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Evaluate a policy. The engine does not fetch state. You pass the policy and the context.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
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

The image runs `@cognate/node` and serves the governance API. `/health` returns:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

The `cognate-data` volume is mounted at `/app/data`. The event log is `/app/data/events.jsonl`. The snapshots are `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json`, and `/app/data/cognate/prompts.json`. `GET /events/:eventId` reads that log and returns the recorded event with an Attestia inclusion proof and the root. The caller sends the same signed `cognate-request-v1` headers as a write. An id that is not in this tenant's log is a miss, and the body has no proof. Prompt and output text stay out of the event. The route does not call RepoMesh. Attestia's compose uses the same event-log variable on its own volume. Each file has one writer. RepoMesh's image does not mount this log. `REPOMESH_FAIL_ON` defaults to `unverified`: only a PASS deploys. Set it to `fail` to allow an UNVERIFIED release through. The image does not set a ledger URL. The image is published to GHCR when a GitHub release is published.

---

## Authentication & Migration Guide

### What is proved now (PR a)

- **Ed25519 request signing (`cognate-request-v1`).** By default (`signedRequests: "enforce"`), every `POST` and `GET /events/:eventId` must carry `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, and `X-Signature` over the 8-line canonical request string (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). `POST` bodies must be RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical` otherwise). `kid` is the 64-character lowercase hex SHA-256 of the raw 32-byte Ed25519 public key.
- **Ordered replay protection and uniform 401.** `X-Timestamp` must be within ±300 s of server time (`GET /health` exposes `serverTime`). The in-memory replay store checks `(agentId, nonce)` read-only before signature verification, records it only after the signature verifies, and retains it across the full 600 s validity span. Every pre-signature authentication failure returns an identical `401` with `code: "auth.unauthenticated"`.
- **Actor binding (`403 auth.actor-mismatch`).** The actor on every route (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) is bound to the verified signer before RepoMesh or any event append.
- **Privilege escalation guards and root key bootstrap.** Agent registration (`POST /identity/agents`) and grant approval (`POST /identity/grants/:id/approve`) require an active `delegate` capability. Self-approval is refused (`403 auth.self-approval-forbidden`). Pre-populated `agent.capabilities` are refused except when the tenant's operator-supplied root public key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`) bootstraps the tenant's first `delegate`. Root mints or approves a `delegate` directly only at bootstrap, while the tenant has no active `delegate`; by design, the tenant root keeps its recovery powers after bootstrap (it rotates a human or agent principal's key, revokes any principal, and approves non-delegate grants, and recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents). Rotating a key hands that principal's authority to whoever holds the new key, and the root chooses the new key. So after the root rotates a human delegate's key, the root holds that delegate's authority, including minting new delegates (registering agents and approving `delegate` grants). And if the root revokes every active `delegate`, the tenant again has no active `delegate`, so the root can again mint one directly. A root derived from a test seed must never be configured in production. The server refuses the repository's own test root keys at startup (`auth.test-only-root-key-forbidden`) unless a test harness sets `allowTestOnlyRoots: true`, but it cannot recognise a root derived from any other seed known outside the deployment. No tenant root key ships in the repository or Docker image, and the server refuses to start in `enforce` mode without operator-supplied roots (`auth.missing-tenant-roots`). An agent principal (`principal: "agent"`) cannot register a human principal (`principal: "human"`) or grant `delegate`, and an `owner` cannot rotate a human principal's key. Key rotation (`POST /identity/agents/:id/key`) and revocation (`POST /identity/agents/:id/revoke`) immediately invalidate old `kid`s.

### What is not proved yet (coming in PR b) and current limits

- **Single-instance replay store.** The `(agentId, nonce)` replay store is in-memory on a single `@cognate/node` process; multi-instance deployments do not share replay state.
- **Detached approvals, identity stream, and offline verification come in PR (b).** Under PR (a), any sign-off-gated action must be signed directly by the authorizing principal. Detached `cognate-approval-v1` approvals (allowing an agent to submit a transition carrying a separate human signature), durable `approvalId` consumption, the attested `cognate-<tenant>-identity` event stream, `submittedBy` / `authorizedBy` event fields, the standalone offline verifier, and RepoMesh root-key anchoring are scheduled for PR (b).

### Migrating existing agents to Ed25519 keys

1. **Generate an Ed25519 key pair** using `generateEd25519KeyPair()` from `@cognate/node`:
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
2. **Rogue agent or forged caller identity.** Mitigation: every HTTP write and `/events/:eventId` read is authenticated with an Ed25519 signature (`cognate-request-v1`), ±300 s timestamp check, and 600 s nonce replay store; capabilities are time-bound, scope-limited, and revocable (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), and every route binds its body actor fields to the verified signer (`403 auth.actor-mismatch`). Limit: the replay store is in-memory per process, and detached multi-party approvals (`cognate-approval-v1`) and offline event-stream signature verification land in PR (b).
3. **Supply-chain model tampering.** Weights or configs are swapped post-evaluation. Mitigation: the model registry hashes weights, config, and manifest at registration, and `ModelVersion.repo` is stored as `sha256:<hex>`. Any deviation invalidates the version.
4. **Policy bypass via prompt injection.** An adversarial prompt attempts to circumvent content rules. Mitigation: policy evaluation is deterministic, versioned, and runs before inference. No prompt executes without a passing policy check.
5. **Insider abuse of audit logs.** A privileged operator tampers with logs. Mitigation: the event store is append-only and backed by Attestia's Merkle-tree proofs. Tampering breaks the chain hash.
6. **Cross-tenant access on the HTTP server.** An agent of one tenant reaches another tenant's records. Mitigation: every route acts in the authenticated signer's tenant. A record naming another tenant is refused, and another tenant's id is answered as missing.

No telemetry or analytics. A deploy on the HTTP server asks RepoMesh whether the named release passes. Health and the other routes stay on this process.

---

## Status

Building in public. All core packages are implemented, tested, and building. Install the bundle with `npm install @mcptoolshop/cognate`. The `@cognate/*` names stay in this repo.

| Gate | Status |
|------|--------|
| Build | Passing |
| Tests | 287 passing |
| Coverage | Over 92% of lines in node, 97% in policy and agent-identity, 98% in model-registry, and 99% in prompt-store, with vitest coverage floors enforced |
| Typecheck | Clean |
| Docker | Image serves the governance API. The volume holds the event log and the three snapshots |
| Shipcheck | Handbook, landing page, and repo metadata in this release |

---

Built by [MCP Tool Shop](https://mcp-tool-shop.github.io/)
