# Cognate

**Structural governance for autonomous intelligence.**

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

Cognate consumes Attestia primitives and adds an AI-native domain layer:

```
┌─────────────────────────────────────────────────────────────┐
│                        COGNATE                               │
│                                                              │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐     │
│  │   AI Policy  │  │  Model   │  │      Agent         │     │
│  │   Engine     │  │ Registry │  │     Identity       │     │
│  └──────────────┘  └──────────┘  └────────────────────┘     │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐     │
│  │ Prompt/Output│  │  Dataset │  │  Drift / Eval      │     │
│  │   Store      │  │  Lineage │  │  Detection         │     │
│  └──────────────┘  └──────────┘  └────────────────────┘     │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │   @mcptoolshop/       │                       │
│              │   attestia (platform) │                       │
│              │   event-store · proof · │                       │
│              │   verify · registrum  │                       │
│              └───────────┬───────────┘                       │
│                          │                                   │
│              ┌───────────┴───────────┐                       │
│              │   Witness Network      │                       │
│              │  (XRPL + EVM + Solana) │                       │
│              └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

| Package | Purpose |
|---------|---------|
| `@cognate/types` | Shared AI governance domain types (zero deps) |
| `@cognate/policy` | Semantic policy evaluation engine |
| `@cognate/model-registry` | Model lifecycle, versioning, evaluation |
| `@cognate/agent-identity` | Agent identity, capabilities, grants |
| `@cognate/prompt-store` | Prompt/output logging with encrypted events |

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

## Status

Scaffolded. Building in public.

| Package | Status |
|---------|--------|
| `@cognate/types` | Scaffolded |
| `@cognate/policy` | Planned |
| `@cognate/model-registry` | Planned |
| `@cognate/agent-identity` | Planned |
| `@cognate/prompt-store` | Planned |

---

Built by [MCP Tool Shop](https://mcp-tool-shop.github.io/)
