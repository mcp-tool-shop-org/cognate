<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Gouvernance structurelle pour l’intelligence artificielle autonome.</strong></p>

Cognate est la couche de gouvernance de l’IA, construite sur [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prouve qu’un événement s’est produit (un événement, une transaction, une transition d’état) et lie cette preuve à une chaîne. Cognate utilise les mêmes primitives d’attestation pour gérer les systèmes d’IA : ce qu’un modèle était autorisé à faire, ce qu’il a réellement fait et qui l’a autorisé.

Cognate atteste de la véracité de l’IA : lignée du modèle, décisions relatives aux politiques, capacités de l’agent et intégrité des invites et des résultats. Les mêmes preuves Merkle. Le même magasin d’événements en ajout uniquement. Domaine différent.

Attestia, Cognate et RepoMesh sont trois produits. Attestia propose le domaine financier (coffre-fort personnel, trésorerie de l’organisation, registre) en s’appuyant sur ces éléments de base. RepoMesh est le réseau de distribution : événements signés, manifestes de nœuds et horloge de confiance ancrée sur XRPL, sur son propre registre RFC 6962. Il n’utilise pas l’arbre de Merkle d’Attestia. Cognate appelle Attestia lorsqu’il a besoin d’une preuve, et RepoMesh lorsqu’il a besoin qu’une distribution soit vérifiée. `@cognate/repomesh-bridge` est cette vérification.

---

## Mission

Nous pensons que, à mesure que les systèmes d’IA gagnent en autonomie, les structures qui les régissent doivent gagner en rigueur. Les contrats intelligents s’exécutent. Les modèles infèrent. Mais personne ne « atteste » de ce que l’IA était autorisée à faire, de ce qu’elle a réellement fait et de savoir si un humain a donné son accord.

Cognate est la couche manquante : registre des modèles, application des politiques, identité des agents et audit déterministe, le tout unifié entre les modèles, les organisations et les chaînes.

### Ce que nous défendons

- **La vérité avant la vitesse.** Chaque inférence de modèle est ajoutée en lecture seule, peut être rejouée et réconciliée. Si cela ne peut être prouvé, cela ne s’est pas produit.
- **Les humains approuvent ; les machines vérifient.** L’IA conseille, les modèles infèrent, mais rien ne se déploie ni n’agit sans une autorisation humaine explicite. Jamais.
- **Gouvernance structurelle, pas gouvernance politique.** Nous ne votons pas sur ce qui est valide. Nous définissons des invariants qui sont valables de manière inconditionnelle : l’identité du modèle est explicite, la lignée est ininterrompue, la version de la politique est monotone.
- **L’intention n’est pas l’exécution.** Déclarer ce qu’un agent doit faire et le laisser agir sont des actes distincts avec des mécanismes de contrôle distincts. L’écart entre eux est l’endroit où réside la confiance.
- **Les modèles sont des témoins, pas des autorités.** Attestia atteste. Les chaînes valident. Mais l’autorité découle de règles structurelles, et non des poids d’un modèle.

---

## Architecture

Cognate utilise les primitives d’Attestia et ajoute une couche de domaine native de l’IA. Les paquets sont des fonctions pures. Les appelants fournissent l’état. Rien ici n’ouvre une socket, n’écrit dans un fichier ou ne lit l’heure, à moins que vous ne lui fournissiez la valeur.

| Paquet | Objectif | État |
|---------|---------|--------|
| @cognate/types | Types de domaine de gouvernance de l’IA partagés (zéro dépendance) | Prêt |
| @cognate/policy | Moteur d’évaluation de politique sémantique | Prêt |
| @cognate/model-registry | Cycle de vie, versionnage et évaluation du modèle | Prêt |
| @cognate/agent-identity | Identité de l’agent, capacités, autorisations | Prêt |
| @cognate/prompt-store | Journalisation des invites/sorties avec événements chiffrés | Prêt |

### Alignement réglementaire

| Réglementation | Cognate répond aux exigences |
|------------|-------------------|
| Article 12 du règlement européen sur l’IA | Journalisation des événements en lecture seule sur toute la durée de vie du système |
| Article 14(5) du règlement européen sur l’IA | Identification des personnes physiques lors de la vérification |
| NIST AI RMF | Fonctions de gouvernance, de cartographie, de mesure et de gestion |
| ISO/IEC 42001 | Exigences du système de gestion de l’IA |

---

## Principes

| Principe | Mise en œuvre |
|-----------|---------------|
| Enregistrements en lecture seule | Pas de MISE À JOUR, pas de SUPPRESSION : uniquement de nouvelles entrées |
| Fonctionnement en mode sécurisé | Un désaccord sur la politique arrête le système, il ne se répare jamais silencieusement |
| Relecture déterministe | Les mêmes événements produisent toujours le même état |
| Mécanismes de contrôle de l’approbation humaine | Aucun modèle ne se déploie, aucune politique ne change, aucune capacité n’est accordée sans une approbation explicite |
| Invites chiffrées | AES-256-GCM avec clé de locataire pour la confidentialité ; hachage SHA-256 pour l’intégrité |
| Identité structurelle | Explicite, immuable, unique : pour les modèles, les agents et les politiques |

---

## Démarrage rapide

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Évaluer une politique. Le moteur ne récupère pas l’état. Vous transmettez la politique et le contexte.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

Enregistrez une version du modèle, puis faites-la passer par le cycle de vie. Une version évolue `registered → evaluated → approved → deployed`, et elle peut être `rejected` ou `retired`. `transitionVersion` déplace un instantané que l’appelant conserve. Sur le serveur HTTP, `approved → deployed` appelle `verifyRelease` sur les éléments `repo` et `release` enregistrés lors de l’enregistrement de la version. Une version qui ne passe pas n’est pas déployée, et une requête qui fait référence à une version différente ne l’est pas non plus. Le refus est enregistré.

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

L’image exécute `@cognate/node` et fournit l’API de gouvernance. `/health` renvoie :

```json
{ "status": "ok", "service": "cognate", "mode": "api" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

Le volume `cognate-data` est monté à `/app/data`. Le journal des événements est `/app/data/events.jsonl`. Les instantanés sont `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` et `/app/data/cognate/prompts.json`. `GET /events/:eventId` lit ce journal et renvoie l’événement enregistré avec une preuve d’inclusion Attestia et la racine. L’appelant envoie les mêmes en-têtes d’agent qu’une opération d’écriture. Un identifiant qui ne figure pas dans le journal de ce locataire est considéré comme une erreur, et le corps ne contient aucune preuve. Le texte de l’invite et le texte de sortie ne sont pas inclus dans l’événement. La route n’appelle pas RepoMesh. La fonction de composition d’Attestia utilise la même variable de journal des événements sur son propre volume. Chaque fichier a un seul rédacteur. L’image de RepoMesh ne monte pas ce journal. `REPOMESH_FAIL_ON` a par défaut la valeur `unverified` : seule une opération réussie est autorisée. Définissez-la sur `fail` pour autoriser une publication non vérifiée. L’image ne définit pas d’URL de registre. L’image est publiée sur GHCR lorsqu’une publication GitHub est effectuée.

---

## Modèle de menace

Cognate suppose le modèle de menace suivant :

1. **Point de terminaison d’inférence compromis.** Un attaquant obtient l’accès à l’API du modèle. Atténuation : toutes les invites et les sorties sont enregistrées avec des charges utiles chiffrées et des hachages d’intégrité SHA-256. La relecture est déterministe.
2. **Agent malveillant avec des informations d’identification volées.** Les clés d’un agent sont exfiltrées. Atténuation : les capacités sont limitées dans le temps, limitées dans leur portée et révocables. Chaque autorisation nécessite une approbation explicite.
3. **Altération du modèle de la chaîne d’approvisionnement.** Les poids ou les configurations sont modifiés après l’évaluation. Atténuation : le registre des modèles hache les poids, la configuration et le manifeste lors de l’enregistrement. Toute déviation invalide la version.
4. **Contournement de la politique par injection d’invite.** Une invite malveillante tente de contourner les règles de contenu. Atténuation : l’évaluation de la politique est déterministe, versionnée et s’effectue avant l’inférence. Aucune invite n’est exécutée sans qu’un contrôle de politique réussi ne soit effectué.
5. **Abus interne des journaux d’audit.** Un opérateur privilégié manipule les journaux. Atténuation : le magasin d’événements est en lecture seule et est sauvegardé par les preuves d’arbres de Merkle d’Attestia. La manipulation brise la chaîne de hachage.

Aucune télémétrie ou analyse. Un déploiement sur le serveur HTTP demande à RepoMesh si la version spécifiée passe les tests. L’état de santé et les autres routes restent sur ce processus.

---

## État

Développement en mode ouvert. Tous les principaux modules sont implémentés, testés et en cours de construction. Installez le paquet avec `npm install @mcptoolshop/cognate`. Les noms des `@cognate/*` restent dans ce dépôt.

| Porte | État |
|------|--------|
| Construction | Réussite |
| Tests | 178 réussies |
| Couverture | Plus de 90 % de la politique est respectée |
| Vérification des types | Propre |
| Docker | L’image fournit l’API de gouvernance. Le volume contient le journal des événements et les trois instantanés. |
| Vérification avant la mise en production | Manuel, page d’accueil et métadonnées du dépôt inclus dans cette version |

---

Créé par [MCP Tool Shop](https://mcp-tool-shop.github.io/)
