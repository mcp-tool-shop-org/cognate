# Ship Gate

**Tags:** [npm] [complex]

---

## A. Security Baseline

- [x] `[all]` SECURITY.md exists
- [x] `[all]` README includes threat model paragraph
- [x] `[all]` No secrets, tokens, or credentials in source
- [x] `[all]` No telemetry by default

## B. Error Handling

- [x] `[all]` Errors follow Structured Error Shape: code, message, hint, cause?, retryable?

## C. Operator Docs

- [x] `[all]` README is current
- [x] `[all]` CHANGELOG.md
- [x] `[all]` LICENSE file present
- [ ] `[complex]` HANDBOOK.md

## D. Shipping Hygiene

- [x] `[all]` verify script exists
- [x] `[all]` Version in manifest matches git tag (pre-1.0)
- [x] `[all]` Dependency scanning runs in CI
- [x] `[npm]` Lockfile committed
- [x] `[npm]` engines.node set

## E. Identity (soft gate)

- [ ] `[all]` Logo in README header
- [ ] `[all]` GitHub repo metadata: description, homepage, topics

---

**Hard gates (A–D):** Must pass before v1.0.0 is tagged.
**Current status:** IN PROGRESS — core packages ready, handbook and identity pending.
