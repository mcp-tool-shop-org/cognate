# Cognate Scorecard

## Build Status

| Package | Build | Tests | Coverage (stmts) |
|---------|-------|-------|------------------|
| @cognate/types | Passing | N/A | N/A |
| @cognate/policy | Passing | 22 pass | **95%** |
| @cognate/model-registry | Passing | 19 pass | **96%** |
| @cognate/agent-identity | Passing | 16 pass | **96%** |
| @cognate/prompt-store | Passing | 23 pass | **96%** |
| @cognate/node | Passing | **26 pass** | **98%** |
| @cognate/cognate | Passing | 2 pass | N/A |

## Shipcheck Status

**Pass rate: 100% (16/16)** — All hard gates pass. Ship it.

## Docker Status

- docker-compose.yml: Created with cognate-data persistent volume
- Dockerfile: Multi-stage build, explicit package ordering
- Status: Builds and runs. Health endpoint returns mode: api
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
| @mcptoolshop/cognate | 0.1.6 | Published |

## Handbook

Live at: https://mcp-tool-shop-org.github.io/cognate/handbook/

## Repos

| Repo | URL | Status |
|------|-----|--------|
| Attestia | https://github.com/mcp-tool-shop-org/attestia | Phase 15 closed |
| Cognate | https://github.com/mcp-tool-shop-org/cognate | **Shipcheck 100%** |
