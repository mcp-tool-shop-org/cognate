# Changelog

All notable changes to Cognate are documented in this file.

## [Unreleased]

## [0.3.0] - 2026-10-24

### Security

- **Ed25519 request signing (`cognate-request-v1`), replay protection, actor binding, and privilege-escalation guards on `@cognate/node` (PR a).**
  - **Request signing (`packages/node/src/middleware/signature.ts`).** Every write (`POST`) and every authenticated read (`GET /events/:eventId`) requires five headers (`X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, `X-Signature`) and an Ed25519 signature (`node:crypto`) over the 8-line `cognate-request-v1` canonical UTF-8 string (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Header and path fields obey a strict single-line ASCII grammar (`X-Timestamp` is `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$`; `normalizeRequestPathname` normalizes the request pathname once before signed-path rules and route dispatch, refusing dot segments, backslashes, double encoding, and percent-encoded `.`, `/`, or `\` with `400 auth.invalid-path`). Request bodies are buffered as raw bytes under a 1 MiB limit before `JSON.parse`, verified to be RFC 8785 JCS-canonical (`400 auth.body-not-canonical` otherwise), and hashed over those exact bytes. `kid` is the 64-character lowercase hex SHA-256 of the raw 32-byte Ed25519 public key.
  - **Ordered replay protection and uniform 401.** Timestamps must fall within ±300 s of server time, and capability expiry, grant `approvedAt`, and policy `evaluatedAt` are evaluated using server time rather than request body timestamps. The in-memory replay store checks `(agentId, nonce)` read-only via a single `O(1)` lookup and expiry comparison before signature verification, inserts it and prunes expired entries in `recordVerified` only after verification succeeds (so an invalid signature cannot burn a nonce), and retains it inclusively through `max(now, timestamp) + 300 s` across the full 600 s validity span. Early authentication refusals after header grammar validation execute one `O(1)` replay-store lookup and one dummy Ed25519 verification against a fixed dummy public key, and every pre-signature authentication failure returns the same byte-identical `401` body (`code: "auth.unauthenticated"`).
  - **Actor binding across all routes (`403 auth.actor-mismatch`) and version registration attestation.** The actor recorded by every route is derived from the verified signer and checked before RepoMesh or any Attestia append: `POST /registry/versions/:id` (requires initial `status: "registered"` with `400 INVALID_INITIAL_VERSION_STATUS`, appends `cognate.model.version.registered` with the signer as actor on registration, and binds `transition.actorId` on transitions), `POST /registry/versions/:id/evaluations` (`evaluation.evaluator`), `POST /identity/grants` (`grant.requestedBy` and `grant.capability.grantedBy`), `POST /identity/grants/:id/approve` (`approverId`), `POST /identity/agents` (`agent.owner`), `POST /prompts` (`prompt.agentId`, defaulting `null` to the signer, and recording `actorId` on `cognate.prompt.logged` and `cognate.output.logged`), `POST /registry/models` (`model.owner`), and `POST /policy/evaluate` (`context.actorId`, `context.agentId`, and `context.agentCapabilities` checked against the identity registry at server time). Under PR (a), any sign-off-gated action must be signed by the authorizing principal itself; detached `cognate-approval-v1` approvals land in PR (b).
  - **Privilege escalation guards (Ruling 5a–5e) and tenant root key bootstrap.**
    - `5a`: `POST /identity/agents` requires `delegate`, refuses pre-populated `agent.capabilities` (`403 auth.capabilities-not-allowed`) except during the tenant root key's bootstrap of the tenant's first `delegate`, refuses registering any `agent.id` matching a configured tenant root `actorId` (`403 auth.reserved-root-actor-id`), and requires a valid 43-character base64url Ed25519 `publicKey`.
    - `5b`: `POST /identity/grants/:id/approve` requires an active `delegate` capability at server time, refuses self-approval (`approverId === grant.agentId`, `403 auth.self-approval-forbidden`), and sets `capability.grantedBy = approverId`.
    - `5c`: A `principal: "agent"` cannot register a `principal: "human"` record (`403 auth.escalation-forbidden`).
    - `5d`: A `principal: "agent"` cannot request or approve a `delegate` capability grant (`403 auth.escalation-forbidden`).
    - `5e`: Key rotation (`POST /identity/agents/:id/key`) and revocation (`POST /identity/agents/:id/revoke`) are enforced; an `owner` cannot rotate a `principal: "human"`'s key (`403 auth.escalation-forbidden`), and rotated-out/revoked `kid`s are immediately refused (`401 auth.unauthenticated`).
    - Operator-supplied per-tenant root public keys are loaded via `tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH` (`loadTenantRootsConfig`; no root keys ship in the repository or Docker image, startup in `enforce` mode requires operator-supplied roots with distinct `actorId`s, configured public keys are checked against all test fixture derivations as well as the entry's own tenant id, and test-only fixture keys require the context option `allowTestOnlyRoots: true` and log a startup warning when accepted). Root keys are resolved before agent records and mint or approve a `delegate` capability directly only at bootstrap while the tenant has no active `delegate` (`403 auth.bootstrap-already-completed` thereafter), while keeping their standing recovery powers after bootstrap (rotating a human principal's key and approving non-delegate grants).
  - **Sunset-gated `log` mode.** `signedRequests` defaults to `"enforce"`. Starting in `"log"` mode requires `signedRequestsLogUntil` (`COGNATE_SIGNED_REQUESTS_LOG_UNTIL`) set to a future RFC 3339 UTC timestamp at most 14 days away; unsigned requests are refused after sunset, `/identity/*` routes require signatures even in `"log"` mode, and unsigned events in `"log"` mode are marked `unsigned: true` with a sanitized warning (`{ method, pathname, agentId, code }`).
  - **Hashed-identifier value checks.** Plaintext account-naming values on `agent.id`, `agent.owner`, `agent.name`, `model.owner`, `model.name`, `transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `approverId`, and `policy.approvedBy` are refused (`400 PLAINTEXT_ACCOUNT_IDENTIFIER`) while the `owner` property key on `Agent` and `Model` remains allowed, and `ModelVersion.repo` must be stored as `sha256:<64 lowercase hex>`.
  - **Clock-offset sync and Node client signing helper.** `GET /health` returns `serverTime`, and `signHttpRequest` / `createSignedClient` (`packages/node/src/client.ts`) canonicalize bodies with JCS, sign requests, sync clock offset from `/health`, and retry once on `401`.

### Changed (breaking)

- **Unsigned HTTP writes and `/events/:eventId` reads are refused by default (`401 auth.unauthenticated`).** Callers must register an Ed25519 `publicKey` on each `Agent` and sign requests with `cognate-request-v1` headers (`signHttpRequest` / `createSignedClient`), or configure a temporary `signedRequests: "log"` window (at most 14 days via `COGNATE_SIGNED_REQUESTS_LOG_UNTIL`) for non-`/identity/*` routes during migration.
- **`ModelVersion.repo` must be a `sha256:<64 lowercase hex>` digest.** Plaintext `owner/repo` strings on `ModelVersion.repo` are rejected with `PLAINTEXT_ACCOUNT_IDENTIFIER`.
- **`json-canonicalize` is a direct dependency of `@cognate/node` and `@cognate/types`.**

### Security (earlier in 0.3.0 cycle)

- **`@cognate/node` scopes every route to the authenticated agent's tenant.** Before, a caller authenticated in one
  tenant could act in another: transition its versions, record evaluations on them, register models and versions in
  it, log prompts and outputs and policy decisions to its event streams, and register agents and grants in it. Routes
  either took the tenant from the request body or never compared it with the stored record. Now every POST acts in
  the caller's tenant (`packages/node/src/tenant.ts`):
  - A record that names another tenant is refused with 400: `registry.tenant-mismatch` (model, version),
    `prompts.tenant-mismatch` (prompt, output), `policy.tenant-mismatch` (the context and the policy) and
    `identity.tenant-mismatch` (agent, grant).
  - An id that belongs to another tenant gets exactly the answer a missing id gets, so the caller can't learn that it
    exists. That covers a version (transition, evaluation), the model a new version names, the prompt an output
    names, the agent a grant names, and a grant to approve or export.
  - The refusal comes before RepoMesh is asked and before anything is appended.
  - The path id and the body id must agree when registering a version (`registry.version-id-mismatch`) and when
    logging an output (`prompts.prompt-id-mismatch`).
- **This is necessary, not sufficient.** The caller's identity is still self-asserted: the server trusts an unsigned
  `X-Agent-Id` header, so anyone who knows an agent id can act as that agent, in that agent's tenant. Signed requests
  are the fix for that, and they are a separate change.
- **Ids are global across tenants.** Registering a model, version, prompt, output, agent or grant whose id another
  tenant already holds is refused as a duplicate, which still shows that the id is taken.
- **A tenant's first agent is seeded, not posted.** Every POST needs an existing agent, and an agent registers agents
  only into its own tenant, so a new tenant's first agent goes into the agents snapshot (`COGNATE_AGENT_REGISTRY_PATH`,
  `/app/data/cognate/agents.json` in Docker) before the server starts.

### Added

- **A model version can carry any number of evaluations, and a decision cites the ones it rests on.** Before, the only
  way to record an evaluation was the `registered → evaluated` transition, so a second evaluation (a replication, a
  pooled result) had nowhere to go: `evaluated → evaluated` was refused. A decision built on a run and a replication
  that disagreed couldn't be recorded.
  - `@cognate/model-registry`: `recordEvaluation`, `getEvaluations` and `attestEvaluation`, using the `Evaluation`
    type from `@cognate/types`. `attestEvaluation` appends `cognate.evaluation.recorded` to
    `cognate-<tenant>-evaluations`, and returns the new state only after the append succeeds. It refuses an
    evaluation whose tenant isn't the config's, as the runs path does. Recording is not a transition. A rejected or
    retired version takes no more evaluations.
  - `transitionVersion` and `attestTransitionVersion` take an optional `{ evaluationIds }`. Each cited id must be an
    evaluation recorded on that version, and the list can't be empty. The ids are recorded on the transition, sent in
    the event, and bound into its lineage hash. A transition that cites nothing is recorded, sent and hashed exactly as
    before.
  - `@cognate/node`: `POST /registry/versions/:id/evaluations` records an evaluation (201, with the event id). It
    checks the agent, that the evaluation names this version, and that the evaluation's tenant is the caller's and
    the version's. `POST /registry/versions/:id` passes `evaluationIds` through, and refuses one that is not an array
    of strings (`registry.invalid-evaluation-ids`) rather than dropping it. Evaluation events get inclusion proofs from
    `GET /events/:eventId`. Snapshot reload keeps recorded evaluations, so a citation still resolves after a restart.
    It keeps the pre-registered runs and run outcomes too, which reload had also dropped.
  - **Record an evaluation, then transition citing it.** Recording never moves the version, so every call is one
    append and the log can't be left half-written.
  - **`requireEvaluationCitations`, a setting:** `false` (default: no citations required, so every existing caller
    keeps working), `"decisions"` (moves to `approved` or `rejected` must cite) or `"all"` (every transition must).
    It's a transition option in model-registry and `ServerContext.requireEvaluationCitations` in node. The entry
    point reads it from `COGNATE_REQUIRE_EVALUATION_CITATIONS` and refuses to start on any other value.
  - New error codes: `EVALUATION_ALREADY_RECORDED`, `EVALUATION_TENANT_MISMATCH`, `EVALUATION_ON_CLOSED_VERSION`,
    `EVALUATION_NOT_FOUND`, `EVALUATION_IDS_EMPTY`, `EVALUATION_CITATION_REQUIRED` and `INVALID_CITATION_RULE`.

### Changed

- **`@cognate/node` answers a missing id with 404, not 400:** `VERSION_NOT_FOUND`, `MODEL_NOT_FOUND`,
  `store.prompt-not-found`, `identity.agent-not-found`, `identity.grant-not-found` and `vc.grant-not-found`. The
  codes and bodies are unchanged. `@cognate/node` is 0.1.1.
- **Test toolchain: vitest 1.6 to 4.1.12, with vite 8.3.5 declared as its peer.** It clears the high and critical
  advisories in the dev tree (vitest, vite, tinypool, source-map-js) with no ignores or overrides; `pnpm audit
  --audit-level high` over the whole tree is clean. Every test passes unchanged, and the coverage floors are
  unchanged. vitest 4 measures coverage differently, so the figures moved (node lines 93.59 to 90.85).
- **An approved version can be rejected before it is deployed** (`approved → rejected`), for example when a
  replication reverses the evaluation the approval rested on. Deployed and retired versions are unchanged.
- `@cognate/node` enforces the org's 90% line-coverage floor. It measures 93.0%. `@cognate/model-registry` keeps
  the 98% floor set with the run records, and measures 98.8% with evaluations.

## [0.2.0] - 2026-10-24

### Added

- **`RunPreRegistration` and `RunOutcome` types in `@cognate/types`.** `RunPreRegistration` records `planSha256`, `decisionSha256`, `caps`, `plannedCard`, `approvedBy`, `registeredAt`, and optional SHA-256 identifier fields (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `ownerSha256`, `repoOwnerSha256`, `githubUserSha256`, `hfOwnerSha256`, `usernameSha256`, `accountSha256`, `emailSha256`, `authorEmailSha256`, `homePathSha256`). `RunOutcome` records `status` (`in_progress`, `completed`, `cancelled`, `lost`), optional `retirement` (`RunRetirement`: `reason: string`, optional `retiredAt`, `retiredBy`, `sha256`) and `retirementReason?: string | null`, `startedAt`, `endedAt`, `recordedAt`, `outcomeSha256`, and `cost` (`unitsSpent`, `rate`, `basis: "rate_x_runtime" | "measured" | "estimate" | "pending" | "zero"`). A run never records account balances (`startBalance`, `endBalance`, or any `*balance*` key): a persistent account balance across runs is a fingerprint of the operator's billing account, whereas the run's own `unitsSpent`, `rate`, and `basis` record only what the run consumed. Compile-time guards (`ForbiddenPlaintextIdentifierKey`, `ForbiddenAccountBalanceKey`, `ForbidPlaintextAccountFields`) reject plaintext account-naming keys and balance fields at the type level.
- **Hashed-identifier enforcement (`isSha256Hex`, `validateHashedIdentifiers`, `validateRunPreRegistration`, `validateRunOutcome`) and pure run lifecycle functions (`preRegisterRun`, `recordRunOutcome`, `getRunPreRegistration`, `getRunOutcomes`) in `@cognate/model-registry`.** Every account-naming field on a run record must be a 64-character lowercase hex SHA-256 digest. Records carrying unhashed field keys (`ggufRepo`, `gguf_source`, `hostedRepo`, `hfRepo`, `repo`, `githubOwner`, `owner`, `repoOwner`, `githubUser`, `hfOwner`, `username`, `user`, `author`, `account`, `email`, `authorEmail`, `homePath`, `handle`), plaintext string values containing HuggingFace/GitHub owner-repo slugs, email addresses, `@handle` tokens, or OS home paths, or any key containing `balance` (`cost.basis === "balance"`, `startBalance`, `endBalance`, `startingBalance`, `remainingBalance`, etc.) are rejected with `RegistryError`. `recordRunOutcome` requires an existing `RunPreRegistration` in the registry snapshot (`PREREGISTRATION_NOT_FOUND`) and refuses any transition out of a terminal state (`completed`, `cancelled`, `lost` -> `INVALID_RUN_TRANSITION`).
- **`attestRunPreRegistered` and `attestRunCompleted` in `@cognate/model-registry`.** Both validate the run record and append `cognate.run.preregistered` and `cognate.run.completed` events to the `cognate-${tenantId}-runs` stream on Attestia's `EventStore` (`source: "external"`). Stateless `attestRunCompleted(config, outcome, preRegistration)` requires the `RunPreRegistration` argument (`PREREGISTRATION_NOT_FOUND` if omitted).

## [0.1.8] - 2026-10-14

### Security

- **`/policy/evaluate` can no longer be made to hang on a pattern.** The policy's regex `pattern` comes from the request body and ran on the server's event loop with no bound, so a pattern such as `(a+)+$` against a long run of `a` blocked every request. A pattern longer than 1,000 characters, a backreference, and a repeated group that contains a repetition (`(a+)+`, `((ab)+)*`) are now rejected before they run, and any other match is stopped after 100 ms. A rejected pattern does not match, as an invalid pattern already did, with the reason in the rule result. A pattern stopped by the time limit fails closed: the whole evaluation is `deny`, whatever the rule's action, with `regex timed out` in the reason and `timedOut` on the rule result, because someone who controls only the text can make a legitimate pattern time out. Ordinary patterns, including repeated alternations such as `(foo|bar)+`, are unchanged, and the text is not capped. `@cognate/policy` gains `@types/node` as a dev dependency for `node:vm`. (CodeQL `js/regex-injection`.)

## [0.1.7] - 2026-10-01

### Added
- `GET /events/:eventId` reads Attestia's log and returns the recorded event, an inclusion proof, and the root. The caller sends the same agent headers as a write. An id that is not in this tenant's log is a miss, and the body has no proof. The route does not call RepoMesh. An event that holds prompt or output text is not returned.

## [0.1.6] - 2026-10-01

### Added
- The HTTP server appends four acts to Attestia's JSONL log: a policy evaluation (a denial is an event), a version transition, a prompt, and an output. The response includes the event id. A failed append fails the call, and the prompt or transition is not kept.
- The registry, the grants, and the prompts snapshot to `COGNATE_MODEL_REGISTRY_PATH`, `COGNATE_AGENT_REGISTRY_PATH`, and `COGNATE_PROMPT_STORE_PATH`. Docker mounts those files, plus `ATTESTIA_EVENTS_FILE`, on `cognate-data`.
- Moving a version from `approved` to `deployed` on the HTTP server calls RepoMesh `verifyRelease` on the `repo` and `release` recorded on the version. A release that does not pass does not deploy, and a request that names a different release does not deploy either. The refusal is appended as `cognate.release.checked`. `transitionVersion` stays inside the state machine. `REPOMESH_FAIL_ON` defaults to `unverified` (only a PASS deploys); `fail` also allows UNVERIFIED. The image does not set a ledger URL.

## [0.1.5] - 2026-10-01

### Changed
- Model-registry and prompt-store appends write an Attestia `DomainEvent` (`source: "external"`) through the published `EventStore` type. The local `EventStore` interface and the `MerkleTree` `@ts-ignore` are gone.
- READMEs, the handbook, and the package description name Attestia, Cognate, and RepoMesh as three products. RepoMesh keeps its own ledger. `@cognate/repomesh-bridge` is the release check.

## [0.1.1] — 2026-09-28

### Added
- `@mcptoolshop/cognate` on npm. One package bundles types, policy, model-registry, agent-identity, and prompt-store. The `@cognate/*` names stay in the repo.
- `release.yml` publishes that package on a version tag through Trusted Publishing.

## [0.1.0] — 2026-09-28

### Added
- Initial scaffold with 5 packages: types, policy, model-registry, agent-identity, prompt-store.
- Pure-function policy evaluation engine with composite AND/OR, threshold, regex, and keyword rules.
- Model lifecycle state machine (registered → evaluated → approved → deployed → retired).
- Agent identity registry with capability grants, approvals, and revocations.
- Encrypted prompt/output store with AES-256-GCM utilities.
- Docker compose with persistent volumes.
- Multi-stage Dockerfile. Package builds call `pnpm exec tsc`, pnpm is pinned to 10.28.2, and the image serves `/health` until the governance HTTP API exists.
- GitHub Actions CI for build, test, typecheck, and dependency audit.
- GHCR publish workflow on GitHub release.
