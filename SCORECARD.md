# Scorecard

**Repo:** Cognate
**Date:** 2026-09-28
**Type tags:** [npm] [complex]

## Assessment

| Category | Score | Notes |
|----------|-------|-------|
| A. Security | 6/10 | SECURITY.md missing; no telemetry stated; no threat model yet |
| B. Error Handling | 6/10 | Pure functions return structured results; no typed error hierarchy yet |
| C. Operator Docs | 7/10 | README, RFC-010 present; HANDBOOK.md missing |
| D. Shipping Hygiene | 6/10 | verify script exists, pnpm workspace, 2 packages; no CI yet |
| E. Identity (soft) | 5/10 | No logo, no landing page, no translations yet |
| **Overall** | **30/50** | Early scaffold — expected for day-0 |

## Key Gaps

1. SECURITY.md + THREAT_MODEL.md
2. CI pipeline (GitHub Actions)
3. Coverage > 90% (currently ~76%)
4. HANDBOOK.md
5. Logo + landing page
6. Typed error hierarchy (Structured Error Shape)
