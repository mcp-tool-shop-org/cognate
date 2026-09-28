# Cognate Scorecard

## Build Status

| Package | Build | Tests | Coverage |
|---------|-------|-------|----------|
| @cognate/types | Passing | N/A | N/A |
| @cognate/policy | Passing | 22 passed | 91% stmts |
| @cognate/model-registry | Passing | 15 passed | TBD |
| @cognate/agent-identity | Passing | 12 passed | TBD |
| @cognate/prompt-store | Passing | 11 passed | TBD |
| @cognate/node | Passing | 2 passed | TBD |
| @cognate/cognate | Passing | 2 passed | TBD |

## Shipcheck Status

Pass rate: 81% (13/16)

Remaining gaps:
- HANDBOOK.md (soft gate)
- Logo in README header (soft gate)
- GitHub repo metadata (soft gate)

## Docker Status

- docker-compose.yml: Created with cognate-data persistent volume
- Dockerfile: Multi-stage build, explicit package ordering
- Status: Builds and runs. Health endpoint returns mode: api
- CMD now runs actual server: node packages/node/dist/index.js

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

## Next Work

1. Add HANDBOOK.md (Starlight docs site)
2. Design logo and add to README
3. Coverage to 90%+ across all packages
4. Publish v0.1.0 to npm

## Repos

| Repo | URL | Status |
|------|-----|--------|
| Attestia | https://github.com/mcp-tool-shop-org/attestia | Phase 15 closed |
| Cognate | https://github.com/mcp-tool-shop-org/cognate | 7 packages building + testing, pushed to main |
