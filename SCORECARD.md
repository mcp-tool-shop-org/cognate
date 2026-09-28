# Cognate Scorecard

## Build Status

| Package | Build | Tests | Coverage (stmts) |
|---------|-------|-------|------------------|
| @cognate/types | Passing | N/A | N/A |
| @cognate/policy | Passing | 22 pass | **95%** |
| @cognate/model-registry | Passing | 19 pass | **96%** |
| @cognate/agent-identity | Passing | 16 pass | **96%** |
| @cognate/prompt-store | Passing | 23 pass | **96%** |
| @cognate/node | Passing | 9 pass | 71% |
| @cognate/cognate | Passing | 2 pass | N/A |

## Shipcheck Status

Pass rate: ~88% (14/16)

Remaining gaps:
- HANDBOOK.md (soft gate)
- Logo in README header (soft gate)
- GitHub repo metadata (soft gate)

## Docker Status

- docker-compose.yml: Created with cognate-data persistent volume
- Dockerfile: Multi-stage build, explicit package ordering
- Status: Builds and runs. Health endpoint returns mode: api
- CMD now runs actual server: node packages/node/dist/index.js
- GHCR publish workflow added (.github/workflows/docker-publish.yml)

## Attestia Integration

| Package | Integration | Status |
|---------|-------------|--------|
| @cognate/prompt-store | attestLogPrompt, attestLogOutput | Ready |
| @cognate/model-registry | attestTransitionVersion, buildTransitionProof | Ready |

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /policy/evaluate | Evaluate policy against context |
| POST | /registry/models | Register a model |
| POST | /registry/versions/:id | Register or transition a version |
| POST | /identity/agents | Register an agent |
| POST | /identity/grants/:id/approve | Approve a capability grant |
| POST | /prompts | Log a prompt |
| POST | /prompts/:id/outputs | Log an output |

## npm Publish Status

| Package | Version | Status |
|---------|---------|--------|
| @mcptoolshop/cognate | 0.1.1 | Published |

## Next Work

1. Node route coverage to 90%+ (currently 71%)
2. Add HANDBOOK.md (Starlight docs site)
3. Design logo and add to README
4. Update GitHub repo metadata (description, topics, homepage)

## Repos

| Repo | URL | Status |
|------|-----|--------|
| Attestia | https://github.com/mcp-tool-shop-org/attestia | Phase 15 closed |
| Cognate | https://github.com/mcp-tool-shop-org/cognate | 91 tests, 7 packages, published |
