---
title: Cognate
description: Structural governance for autonomous intelligence.
sidebar:
  order: 0
---

**Structural governance for autonomous intelligence.**

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia proves that something happened — an event, a transaction, a state transition — and binds that proof to a chain. Cognate uses those same attestation primitives to govern AI systems: what a model was permitted to do, what it actually did, and who authorized it.

Where Attestia attests to financial truth, Cognate attests to AI truth — model lineage, policy decisions, agent capabilities, and prompt/output integrity. Same Merkle trees. Same append-only event store. Different domain.

The v0.1.0 cut is five libraries. They are pure functions. You pass in the clock, the tenant key, and the store. They do not open a socket, and they do not publish a governance HTTP API. The Docker image says so: `/health` returns `"mode": "placeholder"`.

## In this handbook

- [Getting started](/cognate/handbook/getting-started/) — install the workspace and run `pnpm verify`.
- [Usage](/cognate/handbook/usage/) — evaluate a policy, register a model version, approve a grant, log a prompt.
- [Architecture](/cognate/handbook/architecture/) — how the five packages sit on Attestia.
- [Reference](/cognate/handbook/reference/) — the functions each package exports.
- [Security](/cognate/handbook/security/) — the threat model and what the libraries refuse to do.

## What holds

A policy disagreement stops the call. A model version does not deploy itself. A capability grant is not active until a person approves it. A prompt record is append-only, encrypted with a key you hold, and hashed so a later edit is visible.

Those are library rules. A service you build on top of them can break them if it skips the calls. The handbook is about the calls.
