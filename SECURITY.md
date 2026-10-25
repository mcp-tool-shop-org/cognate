# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| >= 0.1.0 | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to the maintainers via GitHub Issues with the label [security].

We aim to respond within 48 hours and will coordinate disclosure responsibly.

## Design Principles

- No telemetry or outbound analytics by default.
- No secrets, tokens, or credentials are shipped in source.
- All errors follow a structured shape (code, message, hint) — no raw stack traces leak to operators.
- Encryption uses tenant-specific keys; the framework never holds master keys.

## What Is Proved Now (PR a)

- **Ed25519 request signing (`cognate-request-v1`).** `@cognate/node` defaults to `signedRequests: "enforce"`. Every `POST` and `GET /events/:eventId` must carry `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, and `X-Signature` signed with Ed25519 (`node:crypto`) over the 8-line canonical request string (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Request bodies must be RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical` otherwise). Every pre-signature authentication failure returns a byte-identical `401` with `code: "auth.unauthenticated"`.
- **Replay protection and clock window.** `X-Timestamp` must be within ±300 s of server time (`GET /health` returns `serverTime`). Nonces are checked read-only before signature verification, inserted only after signature verification succeeds, and retained across the full 600 s validity span.
- **Actor binding and privilege-escalation guards.** Every route binds its body actor fields (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) to the verified signer (`403 auth.actor-mismatch`) before RepoMesh or any Attestia append. Agent registration and grant approval require `delegate`; self-approval is refused (`403 auth.self-approval-forbidden`); `principal: "agent"` cannot register `principal: "human"` or grant `delegate`; an `owner` cannot rotate a human principal's key; and an operator-supplied tenant root public key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`; no root keys ship in the repository or image) can only bootstrap the tenant's first `delegate`.
- **Sunset-gated `log` mode.** Starting in `signedRequests: "log"` requires `signedRequestsLogUntil` (`COGNATE_SIGNED_REQUESTS_LOG_UNTIL`) set to a future RFC 3339 UTC timestamp at most 14 days away. `/identity/*` routes enforce signatures even in `log` mode, unsigned requests are refused after the sunset passes, and events recorded from unsigned requests in `log` mode carry `unsigned: true`.

## Known Limitations & What Comes in PR (b)

- **Single-instance in-memory replay store.** The `(agentId, nonce)` replay store lives in memory on a single `@cognate/node` process and is not shared across multiple server instances.
- **Detached approvals, identity stream, and offline verification come in PR (b).** Under PR (a), any sign-off-gated action must be signed directly by the authorizing principal. Detached `cognate-approval-v1` approvals (where an agent submits an action carrying a separate human approval signature), durable `approvalId` replay tracking, the attested `cognate-<tenant>-identity` event stream, `submittedBy` / `authorizedBy` event fields, the standalone offline verifier, and RepoMesh root-key anchoring are scheduled for PR (b).
- **Ids are global across tenants.** A duplicate id is refused across tenants, which shows that the id is taken.
