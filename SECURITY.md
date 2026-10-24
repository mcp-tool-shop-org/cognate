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

## Known Limitations

- **The HTTP server's caller identity is self-asserted.** `@cognate/node` identifies a caller by the `X-Agent-Id`
  header and checks only that the agent exists and is active. Nothing is signed, so anyone who knows an agent's id can
  act as that agent. Every route is scoped to that agent's tenant, which keeps an agent inside its own tenant, but it
  does not prove who is calling. Do not expose the server to callers you don't trust. Signed requests are planned.
- **Ids are global across tenants.** A duplicate id is refused across tenants, which shows that the id is taken.
