# Changelog

All notable changes to `@cognate/civility-kernel` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Imported into Cognate from `@mcptoolshop/civility-kernel@1.1.0` (the `prototypes` monorepo at `3359fd0`), as the
  workspace package `@cognate/civility-kernel`. The entries from 1.1.0 down are the package's history before the move.

## [1.1.0] - 2026-04-06

### Added
- `createKernel()` — pre-wired facade that replaces 4-step manual setup (decide, lint, explain, diff, proposePolicyUpdates, updatePolicy all in one object)
- `decideAsync()` — async constraint evaluation via `Promise.all` for I/O-bound checks (balance lookups, API calls)
- `evaluateAsync()` on `ConstraintRegistry` — async constraint handler support
- `onDecision` hook — optional callback on DecisionEngine constructor, fires after every decision
- `loadPolicy()` / `dumpPolicy()` — Zod-validated policy persistence with deterministic serialization
- `PreferencePolicySchema` — exported Zod schema for runtime policy validation
- `PolicyBuilder` — fluent chainable API for constructing policies with validation on build()
- `applyPolicyProposal()` — closes the learning loop by merging proposals back into policies
- `planFromMcpToolCall()` / `feedbackFromMcpResult()` — MCP tool-call adapter bridge
- `matchesContext()` — glob/wildcard pattern matching for context rules (e.g. `tool:*`)
- Context rule provenance in `DecisionTrace.appliedContextRules` — audit trail for which rules fired
- Last-writer-wins warnings when multiple context rules adjust the same field
- NO_VALID_PLAN rationale now summarizes top constraint violations with counts
- Uncertainty check targets only the top-utility plan, not all survivors
- Extended FeedbackEvent types: CONSTRAINT_RELAXED, PLAN_EDITED, TIMEOUT, ABORT
- LRU-1 memoization cache for `compileEffectivePolicy` (avoids repeated structuredClone)
- 96 new tests (47 → 143) covering all new features and previously untested paths

### Fixed
- Empty plans array caused `Math.max(...[])` → `-Infinity` in decision and context compilation
- Zod-validated params were not forwarded to constraint handlers (defaults only applied during validation)
- `max_spend_without_confirm` silently bypassed when `spec.params` was undefined (NaN comparison)
- Non-null assertion on `evals.find()` replaced with safe index access
- `maxUnc` computed over all plans instead of only constraint-passing survivors
- `annotatePlanWithTags` overwrote existing tags instead of merging
- `JSON.stringify` used instead of deterministic `stableJson` for context rule comparison in diff
- Constraint deduplication used object identity instead of value-based comparison
- `import.meta.dirname` crashed on Node 18/20 LTS — replaced with `fileURLToPath` pattern
- Off-by-one in CLI arg parser — flags at end of argv silently got `undefined`
- `clean` script missing `require('fs')` — broke `npm publish` on Node 20
- Secretlint step in CI was unenforced (`continue-on-error: true`) and not installed
- Publish workflow didn't run tests before npm publish
- SECURITY.md used unreachable no-reply email for vulnerability reports
- Site landing page showed fake API signatures (`diffPolicy` with `{ mode }`, `canonicalizePolicy` with `scorers?`, `lintPolicy` with wrong return fields)
- Missing `favicon.svg` — broken tab icon on all site pages
- `readJson()` threw raw SyntaxError with no file context
- `askYesNo()` hung indefinitely when stdin was closed (CI environments)
- Publish workflow triggered on tag push instead of release:published
- Handbook stated Node 18 requirement (now >=20)
- Handbook vulnerability reporting contradicted SECURITY.md

### Changed
- `engines.node` from >=18 to >=20 (Node 18 is EOL)
- Removed unused `rollup` devDependency
- `crypto.randomUUID()` replaces `Math.random()` for decision trace IDs
- `--apply` now warns when used without `--write-prev`

### Note
- Git tags for v1.0.1 and v1.0.2 are missing and need to be created manually

## [1.0.2] - 2026-03-25

### Added
- `--help` / `-h` and `--version` / `-V` flags for policy-check CLI
- `.npmignore` for clean packaging
- `coverage/` to `.gitignore`

## [1.0.0] - 2026-02-27

### Changed

- Promoted version from 0.2.1 to 1.0.0
- Added SECURITY.md with vulnerability reporting process and data scope
- Added SHIP_GATE.md and SCORECARD.md for product standards compliance
- Added coverage configuration (`@vitest/coverage-v8`) and verify script
- Updated README with Security & Data Scope section, scorecard, and badges

## [0.2.0] - 2026-02-23

### Fixed

- Fix broken logo image on npm (absolute raw.githubusercontent.com URL)
- Add `keywords` and `homepage` to package.json for better npm discoverability
- Explicit `README.md` and `LICENSE` entries in `files`

## [0.1.0] - 2026-02-21

### Added

- Human governance loop: preview, propose, explicit approval, apply, with automatic rollback backup
- Policy linter + deterministic diff utilities
- Canonicalization to prevent noisy diffs (defaults filled via Zod, deterministic ordering)
- Parameterized constraints with Zod validation (fail-closed with actionable errors)
- Human-readable diffs via constraint `describe()` hooks
- CI guard: tests, build, examples, and policy-check fixtures
