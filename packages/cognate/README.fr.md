<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>Gouvernance structurelle pour l’intelligence artificielle autonome.</strong></p>

Cognate est la couche de gouvernance de l’IA, construite sur [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prouve qu’un événement s’est produit — un événement, une transaction, une transition d’état — et lie cette preuve à une chaîne. Cognate utilise les mêmes primitives d’attestation pour gouverner les systèmes d’IA : ce qu’un modèle était autorisé à faire, ce qu’il a réellement fait et qui l’a autorisé.

Là où Attestia atteste de la vérité financière, Cognate atteste de la vérité de l’IA : la généalogie du modèle, les décisions de politique, les capacités de l’agent et l’intégrité des invites et des résultats. Les mêmes arbres de Merkle. Le même magasin d’événements en ajout uniquement. Domaine différent.

## Installation

```bash
npm install @mcptoolshop/cognate
```

Node 22 ou version ultérieure. Les cinq bibliothèques sont contenues dans ce seul paquet. Les noms internes `@cognate/*` ne sont pas publiés.

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| Importation | Description |
|--------|------------|
| `@mcptoolshop/cognate` | Espaces de noms : `types`, `policy`, `modelRegistry`, `agentIdentity`, `promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | Versions du modèle et validation avant le déploiement |
| `@mcptoolshop/cognate/agent-identity` | Attribution de capacités, approbations, révocations |
| `@mcptoolshop/cognate/prompt-store` | Journal des invites et des résultats chiffrés, en ajout uniquement |
| `@mcptoolshop/cognate/types` | Les noms communs |

Ce sont des fonctions pures. Vous transmettez l’horloge, la clé du locataire et le magasin. Ce paquet n’ouvre pas de socket.

Manuel : <https://mcp-tool-shop-org.github.io/cognate/handbook/>
