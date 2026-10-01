# RFC-010 — AI Governance Extension

**Status:** Draft  
**Author:** MCP Tool Shop  
**Date:** 2026-09-28  
**Target:** Cognate v0.1.0  
**Depends on:** Attestia v2.0.2+ (platform layer)

---

## Summary

Extend Attestia's proof primitives into an AI-native domain: model registry, policy evaluation, agent identity, and prompt/output attestation. The AI governance layer sits beside Vault and Treasury, not inside them. It consumes Attestia's event store and Merkle proofs. It adds domain types and a policy engine that Attestia does not have. Release checks go to RepoMesh, which keeps its own RFC 6962 ledger.

---

## Motivation

Web 3.0 convergence means agents (human and AI) hold wallets, sign transactions, and manage treasuries. Attestia proves that an event, a transaction, or a state transition happened, and binds that proof to a chain. The domain Attestia ships is financial truth. Cognate proves AI truth on the same event store and Merkle proofs: prompts, outputs, model versions, and policy evaluations. RepoMesh is not that store. It is the release network and XRPL trust clock.

Regulatory drivers:
- EU AI Act Article 12: automatic recording of events over system lifetime
- EU AI Act Article 14(5): identification of natural persons in verification
- NIST AI RMF: Govern · Map · Measure · Manage
- ISO/IEC 42001: AI management system requirements

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        COGNATE                               │
│                                                              │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │   AI Policy  │  │  Model   │  │      Agent         │   │
│  │   Engine     │  │ Registry │  │     Identity       │   │
│  └──────────────┘  └──────────┘  └────────────────────┘   │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │ Prompt/Output│  │  Dataset │  │  Drift / Eval      │   │
│  │   Store      │  │  Lineage │  │  Detection         │   │
│  └──────────────┘  └──────────┘  └────────────────────┘   │
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
│              └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Domain Model

### Model Registry

A `Model` is an abstract entity. A `ModelVersion` is an immutable artifact. The lifecycle:

```
registered → evaluated → approved → deployed → retired
                ↑_________rejected
```

Human approval gates at `evaluated→approved` and `approved→deployed`.

### Policy Engine

Policies contain rules. Rules have conditions. Conditions evaluate against events.

| Rule Type | Example |
|-----------|---------|
| `content-filter` | Block prompts containing "investment advice" unless human reviewer present |
| `capability-limit` | Agent may spend max 0.5 ETH per day |
| `rate-limit` | Max 100 inferences per hour per model |
| `guardrail` | Refuse requests for personal financial advice |
| `composite` | (content-filter AND rate-limit) OR human-review |

### Agent Identity

Agents are first-class identities with:
- Wallet address + public key (on-chain verifiable)
- Human owner (always)
- Capability list (what the agent is permitted to do)
- Capability grants are intents — require human approval

### Prompt / Output Store

- Prompts and outputs are **encrypted** with tenant-keyed AES-256-GCM
- **SHA-256 hash** of plaintext is recorded in the event store for integrity
- The hash chain is verifiable without decryption
- For audit, authorized parties with tenant key decrypt

---

## Event Catalog (New Types)

```
ai.model.registered
ai.model.version.registered
ai.model.version.evaluated
ai.model.version.approved
ai.model.version.deployed
ai.model.version.retired
ai.policy.drafted
ai.policy.approved
ai.policy.activated
ai.policy.superseded
ai.agent.registered
ai.agent.capability-granted
ai.agent.capability-revoked
ai.prompt.received
ai.output.generated
ai.evaluation.completed
ai.drift.detected
ai.policy.violation
```

All events follow Attestia's Event Sourcing Model: `type`, `metadata` (eventId, timestamp, actor, correlationId), `payload`, hash-chained via SHA-256.

---

## Intent Control Standard Extension

Existing RFC-003 defines: Intent → Approve → Execute → Verify

Cognate adds AI-native intent types:

| Intent | Declares | Approved By | Execute |
|--------|----------|-------------|---------|
| `model-deploy` | Deploy model version X to environment Y | Human owner + evaluator | Update model registry state |
| `policy-change` | Activate policy version N | Governance admin | Update active policy pointer |
| `capability-grant` | Grant agent A capability C | Human owner of agent | Write capability to agent identity |
| `high-stakes-inference` | Run inference on model X with privileged data | Data owner or model owner | Execute inference + log prompt/output |

---

## Reconciliation Model

Current Attestia reconciler does 3D matching: vault ↔ ledger ↔ chain.

Cognate adds a 4th dimension:

```
declared policy ↔ observed output ↔ human feedback ↔ on-chain action
```

Example: Agent declares it will spend max 0.5 ETH/day (policy). It signs a transaction for 1.0 ETH (on-chain action). The reconciler flags the mismatch.

---

## Compliance Mapping

| Regulation | Attestia Primitive | Cognate Extension |
|------------|-------------------|-------------------|
| EU AI Act Art 12 (logs) | Event store hash chain | AI event types + encrypted prompt store |
| EU AI Act Art 14(5) (human verification) | Intent → Approve flow | Capability grant approval + model deploy approval |
| NIST AI RMF Govern | Registrum invariants | AI policy invariants (e.g., "all prompts logged") |
| NIST AI RMF Map | — | Model registry + agent identity |
| NIST AI RMF Measure | Replay verification | Evaluation events + drift detection |
| NIST AI RMF Manage | Witness attestation | Policy activation attestation |
| ISO/IEC 42001 | Compliance evidence generator | AI-specific evidence (model evals, policy versions) |

---

## Security Considerations

- Prompt/output encryption is **tenant-keyed**, not global. No single key compromise exposes all tenants.
- Model weights hash is public; weights themselves may live in external store (IPFS, on-chain, S3).
- Agent wallet private keys are **never** stored by Cognate. Only public key + address are recorded.
- Policy evaluation is **pure** — no side effects, no external calls during rule matching.

---

## Open Questions

1. Should the policy engine support WASM-based custom predicates for extensibility?
2. How does Cognate integrate with Attestia's `@attestia/node` REST API — new endpoints or new service?
3. Should model evaluation results be attested on-chain (witness) or off-chain only?

---

## References

- Attestia README / ARCHITECTURE.md / HANDBOOK.md
- RFC-003 — Intent Control Standard
- EU AI Act Article 12, 14
- NIST AI RMF 1.0
- ISO/IEC 42001:2023
