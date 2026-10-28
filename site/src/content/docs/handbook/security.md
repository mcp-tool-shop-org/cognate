---
title: Security
description: The Cognate threat model, and the limits of this release.
sidebar:
  order: 5
---

No package sends telemetry. There is no analytics flag, because there is no analytics client.

Report a vulnerability on GitHub Issues with the label `security`. The aim is a response within 48 hours. This handbook describes 1.1.0. The latest 1.x release receives security fixes; versions before 1.0 do not. See `SECURITY.md` in the repository.

## Threats the libraries are built for

1. **Compromised inference endpoint.** Prompts and outputs are stored encrypted, with a SHA-256 integrity hash. Replay uses the recorded events.
2. **Stolen or forged agent identity.** On the HTTP server every write is signed with the agent's Ed25519 key, and the actor on every route is the verified signer. Capabilities are time-bound, scoped, and revocable, and a rotated or revoked key is refused at once. `requestGrant` does not activate a capability. `approveGrant` does.
3. **Swapped weights.** Registration records weights, config, and manifest hashes. A changed file does not match the version.
4. **Prompt injection.** `evaluatePolicy` runs on the context you pass before you call the model. A `deny` result is the stop.
5. **Tampered logs.** The prompt store appends. It does not update or delete. Attestia's Merkle proofs are the settlement layer under that record.

## What the HTTP server enforces in 1.1.0 (unchanged since 1.0.0), and what it does not yet

The Docker process on port 4000 is `@cognate/node`. By default (`signedRequests: "enforce"`), every `POST` and `GET /events/:eventId` requires an Ed25519 signature (`cognate-request-v1`) over the 8-line canonical request string (`X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, `X-Signature`) and an RFC 8785 JCS-canonical JSON body (`400 auth.body-not-canonical` otherwise), with a ±300 s timestamp window, a 600 s ordered replay store, and a uniform `401 auth.unauthenticated` refusal. Every route acts in the verified signer's tenant and binds its body actor fields (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) to that signer (`403 auth.actor-mismatch`) before RepoMesh or any Attestia append. Agent registration and grant approval require `delegate`, self-approval is refused (`403 auth.self-approval-forbidden`), `principal: "agent"` cannot register `principal: "human"` or grant `delegate`, an `owner` cannot rotate a human principal's key, and the operator-supplied tenant root key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`; no root keys ship in the repo or image) mints or approves a `delegate` directly only at bootstrap, while the tenant has no active `delegate`; by design, the tenant root keeps its recovery powers after bootstrap (it rotates a human or agent principal's key, revokes any principal, and approves non-delegate grants, and recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents). Rotating a key hands that principal's authority to whoever holds the new key, and the root chooses the new key. So after the root rotates a human delegate's key, the root holds that delegate's authority, including minting new delegates (registering agents and approving `delegate` grants). And if the root revokes every active `delegate`, the tenant again has no active `delegate`, so the root can again mint one directly. A root derived from a test seed must never be configured in production. The server refuses the repository's own test root keys at startup (`auth.test-only-root-key-forbidden`) unless a test harness sets `allowTestOnlyRoots: true`, but it cannot recognise a root derived from any other seed known outside the deployment.

**Not yet, and current limits:**
- The `(agentId, nonce)` replay store is in-memory on a single `@cognate/node` instance.
- Today, any sign-off-gated action must be signed directly by the authorizing principal. Detached `cognate-approval-v1` approvals, durable `approvalId`s, the `cognate-<tenant>-identity` stream, `submittedBy` / `authorizedBy` on events, and the standalone offline verifier are not in 1.1.0.
- Ids remain global across tenants, so a duplicate id is still refused across tenants.

The libraries will not notice if a caller skips `evaluatePolicy` and calls a model anyway. They will not notice if a caller logs the plaintext beside the ciphertext. The gate is the call. The handbook is the contract for that call.

Errors that leave the registry use `code`, `message`, and `hint`. They are not raw stacks shaped for an operator console.
