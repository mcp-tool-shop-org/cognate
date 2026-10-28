---
title: What's new
description: What changed in Cognate 1.1.0, and in 1.0.0.
sidebar:
  order: 6
---

1.1.0 adds plan selection before an agent acts, and makes the npm bundle's types work for TypeScript users. It changes nothing in the HTTP API, the signed-request format or the event and attestation format, so a 1.0.0 caller keeps working. The full list is in the repository's [CHANGELOG.md](https://github.com/mcp-tool-shop-org/cognate/blob/main/CHANGELOG.md).

## 1.1.0

### Plan selection, before an agent acts

`@cognate/civility-kernel` (from npm, `@mcptoolshop/cognate/civility-kernel`) takes an agent's candidate plans, drops any that break a hard constraint, scores the rest by the policy's preference weights, and returns `EXECUTE` with the chosen plan, `ASK_USER`, or `NO_VALID_PLAN`, with a trace of why. It is the first of two stages: the kernel chooses the plan, and `@cognate/policy` still gates each event while the plan runs. The [usage page](/cognate/handbook/usage/) has an example.

### Decisions that can be recorded and proved

`computeDecisionDigests` hashes a decision in the form a run pre-registration takes (`planSha256`, `decisionSha256`). `attestDecision` appends `cognate.policy.decided` to the tenant's policy stream, which `GET /events/:eventId` already proves. The event carries the outcome and the rules each rejected plan broke, never the plan steps. Pass `decisionId` and `timestamp` and the same inputs give a byte-identical trace.

### Three fixes in the kernel, on the way in

- Its compile cache keyed on the policy's version alone, so two policies with one version but different weights or constraints got the first one's rules. The cache is gone.
- A decision can be reproduced, given its id and time.
- A failed plan scores `null` rather than minus infinity, so a trace survives a JSON round trip.

### Types that resolve from npm

The 1.0.0 bundle's type declarations pointed at workspace packages that aren't on npm, so a TypeScript project got unresolved types on every subpath. 1.1.0 ships those declarations inside the bundle. CI packs the bundle as it is published, installs it into an empty project, and type-checks an import from every entry under `bundler` and `node16` resolution. 490 tests pass.

## 1.0.0

1.0.0 is the first release since 0.1.8. 0.2.0 and 0.3.0 were never published separately, and their changes ship in 1.0.0. From 1.0, versions follow semantic versioning: a change that breaks the HTTP API, the signed-request format or the event and attestation format comes with a new major version. The full list is in the repository's [CHANGELOG.md](https://github.com/mcp-tool-shop-org/cognate/blob/main/CHANGELOG.md).

### Signed requests (breaking)

Every write (`POST`) and every `GET /events/:eventId` on `@cognate/node` must be signed with the caller's Ed25519 key, using the `cognate-request-v1` headers. The timestamp must be within 300 seconds of server time, and a nonce can't be used twice. An unsigned request is refused with `401 auth.unauthenticated`.

- The actor on every route is the verified signer. A body that names someone else is refused (`403 auth.actor-mismatch`).
- Registering an agent and approving a grant need an active `delegate` capability. No one approves their own grant, and an agent can't register a human or grant `delegate`.
- Each tenant's first delegate is bootstrapped by an operator-supplied tenant root key. No root key ships in the repository or the image, and the server won't start in `enforce` mode without one.
- `createSignedClient` and `signHttpRequest` sign requests for you. A temporary `log` mode, at most 14 days, lets callers migrate.

The root key keeps recovery powers after bootstrap. The [security page](/cognate/handbook/security/) lists them, including what rotating a person's key hands to the root, and says a root derived from a test seed must never be used in production.

### Tenant scoping

Every route acts in the caller's tenant. A record that names another tenant is refused, and another tenant's id gets the same answer as a missing one. A missing id is now `404`, not `400`. Ids stay global, so an id another tenant holds is refused as a duplicate.

### Evaluations

A model version carries any number of evaluations: a run, its replication, a pooled result. Recording one never moves the version. A transition names the evaluations it rests on in `evaluationIds`, and those ids go into its lineage hash. `requireEvaluationCitations` sets which transitions must cite (`false`, `"decisions"` or `"all"`). An approved version can now be rejected before it deploys.

### Run records

`preRegisterRun` records a run before it launches and `recordRunOutcome` closes it out, on the `cognate-<tenant>-runs` stream. Account-naming identifiers are stored only as SHA-256 digests, and a run records its own cost, never an account balance.

### Toolchain

vitest 4.1.12 and vite 8.3.5. The high and critical advisories in the dev tree are cleared at the root, with no ignores or overrides. 316 tests pass.
