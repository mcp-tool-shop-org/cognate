# Changelog

All notable changes to Cognate are documented in this file.

## [Unreleased]

## [0.1.8] - 2026-10-14

### Security

- **`/policy/evaluate` can no longer be made to hang on a pattern.** The policy's regex `pattern` comes from the request body and ran on the server's event loop with no bound, so a pattern such as `(a+)+$` against a long run of `a` blocked every request. A pattern longer than 1,000 characters, a backreference, and a repeated group that contains a repetition (`(a+)+`, `((ab)+)*`) are now rejected before they run, and any other match is stopped after 100 ms. A rejected or stopped pattern does not match, as an invalid pattern already did, and the reason is in the rule result. Ordinary patterns, including repeated alternations such as `(foo|bar)+`, are unchanged, and the text is not capped. `@cognate/policy` gains `@types/node` as a dev dependency for `node:vm`. (CodeQL `js/regex-injection`.)

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
