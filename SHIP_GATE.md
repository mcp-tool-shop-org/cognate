# Ship Gate

**Tags:** [npm] [complex]

---

## A. Security Baseline

- [ ] `[all]` SECURITY.md exists
- [ ] `[all]` README includes threat model paragraph
- [ ] `[all]` No secrets, tokens, or credentials in source
- [ ] `[all]` No telemetry by default

## B. Error Handling

- [ ] `[all]` Errors follow Structured Error Shape: code, message, hint, cause?, retryable?

## C. Operator Docs

- [ ] `[all]` README is current
- [ ] `[all]` CHANGELOG.md
- [x] `[all]` LICENSE file present
- [ ] `[complex]` HANDBOOK.md

## D. Shipping Hygiene

- [x] `[all]` verify script exists
- [x] `[all]` Version in manifest matches git tag (pre-1.0)
- [ ] `[all]` Dependency scanning runs in CI
- [ ] `[npm]` Lockfile committed
- [x] `[npm]` engines.node set

## E. Identity (soft gate)

- [ ] `[all]` Logo in README header
- [ ] `[all]` GitHub repo metadata: description, homepage, topics

---

**Hard gates (A–D):** Must pass before v1.0.0 is tagged.
**Current status:** NOT READY — scaffold phase.
