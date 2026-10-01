# Changelog

All notable changes to Cognate are documented in this file.

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
