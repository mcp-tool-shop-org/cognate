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
