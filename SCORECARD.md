# Cognate Scorecard

## Build Status

| Package | Build | Tests | Coverage |
|---------|-------|-------|----------|
| @cognate/types | Passing | N/A (no tests) | N/A |
| @cognate/policy | Passing | 22 passed | 91% stmts |
| @cognate/model-registry | Passing | 15 passed | TBD |
| @cognate/agent-identity | Passing | 12 passed | TBD |
| @cognate/prompt-store | Passing | 11 passed | TBD |

## Shipcheck Status

Pass rate: 81% (13/16)

Remaining gaps:
- HANDBOOK.md (soft gate)
- Logo in README header (soft gate)
- GitHub repo metadata (soft gate)

## Docker Status

- docker-compose.yml: Created with cognate-data persistent volume
- Dockerfile: Multi-stage build; builder stage has tsc module resolution issue
- Status: Builds locally with pnpm build; Docker build needs fix

## Next Work (when you return)

1. Fix Docker builder stage -- tsc module resolution in container
2. Add HANDBOOK.md (Starlight docs site)
3. Design logo and add to README
4. Add @cognate/node REST API package
5. Wire Attestia event-store consumption into prompt-store and model-registry
6. Coverage to 90%+ across all packages
7. Publish v0.1.0 to npm

## Repos

| Repo | URL | Status |
|------|-----|--------|
| Attestia | https://github.com/mcp-tool-shop-org/attestia | Phase 15 closed, Docker persistent volumes ready |
| Cognate | https://github.com/mcp-tool-shop-org/cognate | 5 packages building + testing, pushed to main |
