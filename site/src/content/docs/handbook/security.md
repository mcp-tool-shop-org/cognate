---
title: Security
description: The Cognate threat model, and the limits of v0.1.0.
sidebar:
  order: 5
---

No package sends telemetry. There is no analytics flag, because there is no analytics client.

Report a vulnerability on GitHub Issues with the label `security`. The aim is a response within 48 hours. Supported versions start at 0.1.0. See `SECURITY.md` in the repository.

## Threats the libraries are built for

1. **Compromised inference endpoint.** Prompts and outputs are stored encrypted, with a SHA-256 integrity hash. Replay uses the recorded events.
2. **Stolen agent key.** Capabilities are time-bound, scoped, and revocable. `requestGrant` does not activate a capability. `approveGrant` does.
3. **Swapped weights.** Registration records weights, config, and manifest hashes. A changed file does not match the version.
4. **Prompt injection.** `evaluatePolicy` runs on the context you pass before you call the model. A `deny` result is the stop.
5. **Tampered logs.** The prompt store appends. It does not update or delete. Attestia's Merkle proofs are the settlement layer under that record.

## What this cut does not defend

The Docker process on port 4000 is `@cognate/node`. A POST checks `X-Agent-Id` against the agent registry. That check is not a tenant key. The registry, the grants, and the prompts are snapshotted on the volume, and the four governance acts append to the event log. Do not put a tenant key in that container and expect it to guard the key.

The libraries will not notice if a caller skips `evaluatePolicy` and calls a model anyway. They will not notice if a caller logs the plaintext beside the ciphertext. The gate is the call. The handbook is the contract for that call.

Errors that leave the registry use `code`, `message`, and `hint`. They are not raw stacks shaped for an operator console.
