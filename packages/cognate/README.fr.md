<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>Gouvernance structurelle pour l’intelligence artificielle autonome.</strong></p>

Cognate est la couche de gouvernance de l’IA, construite sur [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prouve qu’un événement s’est produit — un événement, une transaction, une transition d’état — et lie cette preuve à une chaîne. Cognate utilise les mêmes primitives d’attestation pour gouverner les systèmes d’IA : ce qu’un modèle était autorisé à faire, ce qu’il a réellement fait et qui l’a autorisé.

Les éléments apparentés attestent de la vérité de l’IA : la généalogie du modèle, les décisions relatives aux politiques, les capacités de l’agent et l’intégrité des invites et des résultats. Les mêmes preuves de Merkle. Le même magasin d’événements en ajout uniquement. Domaine différent.

Attestia prend en charge le domaine financier en utilisant ces éléments de base. RepoMesh est le réseau de distribution, avec son propre registre basé sur RFC 6962. Ce paquet appelle Attestia pour obtenir une preuve et RepoMesh, via `@cognate/repomesh-bridge`, lorsqu’une distribution doit être vérifiée.

## Installation

```bash
npm install @mcptoolshop/cognate
```

Nœud 22 ou version ultérieure. Les bibliothèques sont regroupées dans ce paquet, y compris la vérification des distributions RepoMesh. Les noms internes `@cognate/*` ne sont pas publiés.

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
| `@mcptoolshop/cognate` | Espaces de noms : `types`, `policy`, `civilityKernel`, `modelRegistry`, `agentIdentity`, `promptStore`, `repomeshBridge` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/civility-kernel` | Sélection d’un plan, avant qu’un agent n’agisse |
| `@mcptoolshop/cognate/model-registry` | Versions du modèle et validation avant le déploiement |
| `@mcptoolshop/cognate/agent-identity` | Attribution de capacités, approbations, révocations |
| `@mcptoolshop/cognate/prompt-store` | Journal des invites et des résultats chiffrés, en ajout uniquement |
| `@mcptoolshop/cognate/repomesh-bridge` | La vérification de la publication de RepoMesh, `verifyRelease` |
| `@mcptoolshop/cognate/types` | Les noms communs |

Ces fonctions prennent en entrée l’état actuel : la clé du locataire et le magasin. Quelques-unes d’entre elles effectuent des opérations en dehors de cet état : `transitionVersion` et `feedbackFromMcpResult` enregistrent l’heure actuelle, les fonctions `decide` et `decideAsync` du noyau lisent l’heure et génèrent un identifiant aléatoire, à moins que vous ne fournissiez à la fois `decisionId` et `timestamp`, et `verifyRelease` lit l’heure et le registre RepoMesh, soit via le réseau, soit à partir d’un répertoire local.

Manuel : <https://mcp-tool-shop-org.github.io/cognate/handbook/>
