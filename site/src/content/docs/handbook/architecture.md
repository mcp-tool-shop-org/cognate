---
title: Architecture
description: Where Cognate sits on Attestia, and what each package is responsible for.
sidebar:
  order: 3
---

Attestia is the settlement layer under Cognate: append-only events and Merkle proofs. Cognate is the AI-shaped domain on top of that. It does not reimplement a ledger.

```
policy  ── evaluate before inference
   │
   ├─ model-registry ── version hashes, approval, deploy
   ├─ agent-identity ── who may act, and under which grant
   └─ prompt-store ── what was asked, and what came back
          │
          └─ types ── the shared nouns
                 │
                 └─ Attestia ── attest the record
```

## Boundaries

| Package | Owns | Does not own |
|---------|------|----------------|
| `@cognate/types` | The nouns: model, version, policy, agent, hash, tenant | Behavior |
| `@cognate/policy` | Whether this call is allowed | Fetching the policy |
| `@cognate/model-registry` | Whether this version may be deployed | Storing weight files |
| `@cognate/agent-identity` | Whether this agent holds a live capability | Issuing keys |
| `@cognate/prompt-store` | The append-only encrypted log | Choosing a database |

The Docker image builds all five and then starts a health process. That process is not a sixth package. When a service layer arrives, it should call these functions rather than grow a second policy engine beside them.

## Regulatory map

| Requirement | Where it lands |
|-------------|----------------|
| EU AI Act Article 12, logging over the system lifetime | Prompt store, append-only |
| EU AI Act Article 14(5), a natural person in the loop | Agent identity approvals, model-registry transitions |
| NIST AI RMF Govern, Map, Measure, Manage | Policy, registry, prompt store, and the human gate on deploy |
| ISO/IEC 42001 | The same gates, as an AI management record rather than a vote |
