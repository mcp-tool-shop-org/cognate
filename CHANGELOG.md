# Changelog

All notable changes to Cognate are documented in this file.

## [Unreleased]

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
