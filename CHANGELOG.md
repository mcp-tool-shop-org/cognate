# Changelog

All notable changes to Cognate are documented in this file.

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
