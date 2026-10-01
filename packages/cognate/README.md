<p align="center">
  <a href="README.md">English</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>Structural governance for autonomous intelligence.</strong></p>

Cognate is the AI governance layer built on [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia proves that something happened — an event, a transaction, a state transition — and binds that proof to a chain. Cognate uses those same attestation primitives to govern AI systems: what a model was permitted to do, what it actually did, and who authorized it.

Cognate attests to AI truth: model lineage, policy decisions, agent capabilities, and prompt and output integrity. Same Merkle proofs. Same append-only event store. Different domain.

Attestia ships the financial domain on those primitives. RepoMesh is the release network, on its own RFC 6962 ledger. This package calls Attestia for a proof and RepoMesh, through `@cognate/repomesh-bridge`, when a release needs checking.

## Install

```bash
npm install @mcptoolshop/cognate
```

Node 22 or newer. The libraries are in this one package, including the RepoMesh release check. The internal `@cognate/*` names are not published.

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| Import | What it is |
|--------|------------|
| `@mcptoolshop/cognate` | Namespaces: `types`, `policy`, `modelRegistry`, `agentIdentity`, `promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | Model versions and the approval gate before deploy |
| `@mcptoolshop/cognate/agent-identity` | Capability grants, approvals, revocations |
| `@mcptoolshop/cognate/prompt-store` | Append-only encrypted prompt and output log |
| `@mcptoolshop/cognate/types` | The shared nouns |

These are pure functions. You pass the clock, the tenant key, and the store. This package does not open a socket.

Handbook: <https://mcp-tool-shop-org.github.io/cognate/handbook/>
