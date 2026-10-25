---
title: Security
description: The Cognate threat model, and the limits of this release.
sidebar:
  order: 5
---

No package sends telemetry. There is no analytics flag, because there is no analytics client.

Report a vulnerability on GitHub Issues with the label `security`. The aim is a response within 48 hours. Supported versions start at 0.1.0. See `SECURITY.md` in the repository.

## Threats the libraries are built for

1. **Compromised inference endpoint.** Prompts and outputs are stored encrypted, with a SHA-256 integrity hash. Replay uses the recorded events.
2. **Stolen agent key.** Capabilities are time-bound, scoped, and revocable. `requestGrant` does not activate a capability. `approveGrant` does.
3. **Swapped weights.** Registration records weights, config, and manifest hashes. A changed file does not match the version.
4. **Prompt injection.** `evaluatePolicy` runs on the context you pass before you call the model. A `deny` result is the stop.
5. **Tampered logs.** The prompt store appends. It does not update or delete. Attestia's Merkle proofs are the settlement layer under that record.

## What is proved on the HTTP server (PR a) and what comes in PR (b)

The Docker process on port 4000 is `@cognate/node`. By default (`signedRequests: "enforce"`), every `POST` and `GET /events/:eventId` requires an Ed25519 signature (`cognate-request-v1`) over the 8-line canonical request string (`X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, `X-Signature`) and an RFC 8785 JCS-canonical JSON body (`400 auth.body-not-canonical` otherwise), with a ±300 s timestamp window, a 600 s ordered replay store, and a uniform `401 auth.unauthenticated` refusal. Every route acts in the verified signer's tenant and binds its body actor fields (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) to that signer (`403 auth.actor-mismatch`) before RepoMesh or any Attestia append. Agent registration and grant approval require `delegate`, self-approval is refused (`403 auth.self-approval-forbidden`), `principal: "agent"` cannot register `principal: "human"` or grant `delegate`, an `owner` cannot rotate a human principal's key, and the operator-supplied tenant root key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`; no root keys ship in the repo or image) mints a `delegate` only at bootstrap, while the tenant has no active `delegate` (recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents).

**Current limits and PR (b):**
- The `(agentId, nonce)` replay store is in-memory on a single `@cognate/node` instance.
- Under PR (a), any sign-off-gated action must be signed directly by the authorizing principal. Detached `cognate-approval-v1` approvals, durable `approvalId`s, the `cognate-<tenant>-identity` stream, `submittedBy` / `authorizedBy` on events, and the standalone offline verifier come in PR (b).
- Ids remain global across tenants, so a duplicate id is still refused across tenants.

The libraries will not notice if a caller skips `evaluatePolicy` and calls a model anyway. They will not notice if a caller logs the plaintext beside the ciphertext. The gate is the call. The handbook is the contract for that call.

Errors that leave the registry use `code`, `message`, and `hint`. They are not raw stacks shaped for an operator console.
