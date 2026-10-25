# Changelog

All notable changes to Cognate are documented in this file.

## [Unreleased]

### Security

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
