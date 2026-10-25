---
title: What's new
description: What changed in Cognate 1.0.0.
sidebar:
  order: 6
---

1.0.0 is the first release since 0.1.8. 0.2.0 and 0.3.0 were never published separately, and their changes ship in 1.0.0. From 1.0, versions follow semantic versioning: a change that breaks the HTTP API, the signed-request format or the event and attestation format comes with a new major version. The full list is in the repository's [CHANGELOG.md](https://github.com/mcp-tool-shop-org/cognate/blob/main/CHANGELOG.md).

## Signed requests (breaking)

Every write (`POST`) and every `GET /events/:eventId` on `@cognate/node` must be signed with the caller's Ed25519 key, using the `cognate-request-v1` headers. The timestamp must be within 300 seconds of server time, and a nonce can't be used twice. An unsigned request is refused with `401 auth.unauthenticated`.

- The actor on every route is the verified signer. A body that names someone else is refused (`403 auth.actor-mismatch`).
- Registering an agent and approving a grant need an active `delegate` capability. No one approves their own grant, and an agent can't register a human or grant `delegate`.
- Each tenant's first delegate is bootstrapped by an operator-supplied tenant root key. No root key ships in the repository or the image, and the server won't start in `enforce` mode without one.
- `createSignedClient` and `signHttpRequest` sign requests for you. A temporary `log` mode, at most 14 days, lets callers migrate.

The root key keeps recovery powers after bootstrap. The [security page](/cognate/handbook/security/) lists them, including what rotating a person's key hands to the root, and says a root derived from a test seed must never be used in production.

## Tenant scoping

Every route acts in the caller's tenant. A record that names another tenant is refused, and another tenant's id gets the same answer as a missing one. A missing id is now `404`, not `400`. Ids stay global, so an id another tenant holds is refused as a duplicate.

## Evaluations

A model version carries any number of evaluations: a run, its replication, a pooled result. Recording one never moves the version. A transition names the evaluations it rests on in `evaluationIds`, and those ids go into its lineage hash. `requireEvaluationCitations` sets which transitions must cite (`false`, `"decisions"` or `"all"`). An approved version can now be rejected before it deploys.

## Run records

`preRegisterRun` records a run before it launches and `recordRunOutcome` closes it out, on the `cognate-<tenant>-runs` stream. Account-naming identifiers are stored only as SHA-256 digests, and a run records its own cost, never an account balance.

## Toolchain

vitest 4.1.12 and vite 8.3.5. The high and critical advisories in the dev tree are cleared at the root, with no ignores or overrides. 316 tests pass.
