<p align="center">
  <a href="README.md">English</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Structural governance for autonomous intelligence.</strong></p>

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia)'s attestation primitives. Where Attestia proves financial truth, Cognate proves AI truth: every model version, every prompt, every output, every policy decision — attested, immutable, and human-governed.

---

## Mission

We believe that as AI systems gain autonomy, the structures that govern them must gain rigor. Smart contracts execute. Models infer. But no one *attests* what the AI was permitted to do, what it actually did, and whether a human approved.

Cognate is the missing layer: model registry, policy enforcement, agent identity, and deterministic audit — unified across models, organizations, and chains.

### What We Stand For

- **Truth over speed.** Every model inference is append-only, replayable, and reconcilable. If it can't be proven, it didn't happen.
- **Humans approve; machines verify.** AI advises, models infer, but nothing deploys or acts without explicit human authorization. Ever.
- **Structural governance, not political governance.** We don't vote on what's valid. We define invariants that hold unconditionally — model identity is explicit, lineage is unbroken, policy version is monotonic.
- **Intent is not execution.** Declaring what an agent should do and letting it act are separate acts with separate gates. The gap between them is where trust lives.
- **Models are witnesses, not authorities.** Attestia attests. Chains settle. But authority flows from structural rules, not from any model's weights.

---

## Architecture

Cognate consumes Attestia primitives and adds an AI-native domain layer. The packages are pure functions. Callers supply state. Nothing here opens a socket, writes a file, or reads a clock unless you hand it the value.

| Package | Purpose | Status |
|---------|---------|--------|
| @cognate/types | Shared AI governance domain types (zero deps) | Ready |
| @cognate/policy | Semantic policy evaluation engine | Ready |
| @cognate/model-registry | Model lifecycle, versioning, evaluation | Ready |
| @cognate/agent-identity | Agent identity, capabilities, grants | Ready |
| @cognate/prompt-store | Prompt/output logging with encrypted events | Ready |

### Regulatory Alignment

| Regulation | Cognate Satisfies |
|------------|-------------------|
| EU AI Act Article 12 | Append-only event logging over system lifetime |
| EU AI Act Article 14(5) | Identification of natural persons in verification |
| NIST AI RMF | Govern · Map · Measure · Manage functions |
| ISO/IEC 42001 | AI management system requirements |

---

## Principles

| Principle | Implementation |
|-----------|---------------|
| Append-only records | No UPDATE, no DELETE — only new entries |
| Fail-closed | Policy disagreement halts the system, never heals silently |
| Deterministic replay | Same events produce the same state, always |
| Human approval gates | No model deploys, no policy changes, no capability grants without explicit approval |
| Encrypted prompts | Tenant-keyed AES-256-GCM for privacy; SHA-256 hash for integrity |
| Structural identity | Explicit, immutable, unique — for models, agents, and policies |

---

## Quick Start

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Evaluate a policy. The engine does not fetch state. You pass the policy and the context.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

Register a model version, then walk it through the lifecycle. A version moves `registered → evaluated → approved → deployed`, and it can be `rejected` or `retired`. Deployment still requires an approval recorded on the version.

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

The published image builds the five packages and serves a health endpoint. The governance HTTP API is not in this image yet. `/health` answers so the container can be supervised while that service is still ahead.

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`/health` returns:

```json
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

Compose keeps prompt and agent data on the `cognate-data` volume, mounted at `/app/data`. The image is published to GHCR when a GitHub release is published.

---

## Threat Model

Cognate assumes the following threat model:

1. **Compromised inference endpoint.** An attacker gains access to the model API. Mitigation: all prompts and outputs are logged with encrypted payloads and SHA-256 integrity hashes. Replay is deterministic.
2. **Rogue agent with stolen credentials.** An agent's keys are exfiltrated. Mitigation: capabilities are time-bound, scope-limited, and revocable. Every grant requires explicit approval.
3. **Supply-chain model tampering.** Weights or configs are swapped post-evaluation. Mitigation: the model registry hashes weights, config, and manifest at registration. Any deviation invalidates the version.
4. **Policy bypass via prompt injection.** An adversarial prompt attempts to circumvent content rules. Mitigation: policy evaluation is deterministic, versioned, and runs before inference. No prompt executes without a passing policy check.
5. **Insider abuse of audit logs.** A privileged operator tampers with logs. Mitigation: the event store is append-only and backed by Attestia's Merkle-tree proofs. Tampering breaks the chain hash.

No telemetry, analytics, or outbound network calls are made by default.

---

## Status

Building in public. All core packages are implemented, tested, and building. v0.1.0 is the first published cut. The packages are libraries. They are not on npm yet.

| Gate | Status |
|------|--------|
| Build | Passing |
| Tests | 72 passing |
| Coverage | >90% on policy |
| Typecheck | Clean |
| Docker | Image builds. Health endpoint is a placeholder |
| Shipcheck | Handbook, landing page, and repo metadata in this release |

---

Built by [MCP Tool Shop](https://mcp-tool-shop.github.io/)
