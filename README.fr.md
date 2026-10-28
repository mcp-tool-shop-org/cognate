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

**Version 1.1.0.** La version 1.1.0 ajoute la sélection d’un plan avant qu’un agent n’agisse, et permet aux types du paquet npm de fonctionner pour les utilisateurs TypeScript. Elle ne modifie rien dans l’API HTTP, le format des requêtes signées ou le format des événements et des attestations, de sorte qu’un appelant de la version 1.0.0 continue de fonctionner. Les versions suivent une numérotation sémantique : une modification qui compromet l’un de ces éléments est accompagnée d’une nouvelle version principale. Voir [Nouveautés de la version 1.1.0](#nouveautés-de-la-version-110).

Cognate est la couche de gouvernance de l’IA construite sur [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prouve qu’un événement s’est produit (un événement, une transaction, une transition d’état) et lie cette preuve à une chaîne. Cognate utilise les mêmes primitives d’attestation pour gouverner les systèmes d’IA : ce qu’un modèle était autorisé à faire, ce qu’il a réellement fait et qui l’a autorisé.

Cognate atteste de la vérité de l’IA : la lignée du modèle, les décisions de politique, les capacités de l’agent et l’intégrité des invites et des résultats. Les mêmes preuves Merkle. Le même magasin d’événements en append-only. Un domaine différent.

Attestia, Cognate et RepoMesh sont trois produits. Attestia prend en charge le domaine financier (coffre-fort personnel, trésorerie d’organisation, registre) en utilisant ces primitives. RepoMesh est le réseau de publication : événements signés, manifestes de nœuds et horloge de confiance ancrée sur XRPL, sur son propre registre RFC 6962. Il n’utilise pas l’arbre de Merkle d’Attestia. Cognate appelle Attestia lorsqu’il a besoin d’une preuve, et RepoMesh lorsqu’il a besoin qu’une publication soit vérifiée. `@cognate/repomesh-bridge` est cette vérification.

---

## Nouveautés de la version 1.1.0

- **Sélection d’un plan, avant qu’un agent n’agisse.** `@cognate/civility-kernel` (depuis npm, `@mcptoolshop/cognate/civility-kernel`) prend les plans candidats d’un agent, élimine ceux qui violent une contrainte stricte, évalue les autres en fonction des pondérations de préférence de la politique, et renvoie l’un de trois résultats : `EXECUTE` (avec le plan choisi), `ASK_USER` ou `NO_VALID_PLAN`, avec une trace expliquant pourquoi. Il s’agit du premier des [deux étapes](#deux-étapes-choisir-un-plan-puis-valider-chaque-événement) : le noyau choisit le plan, et `@cognate/policy` continue de contrôler chaque événement pendant l’exécution du plan.
- **Décisions qui peuvent être enregistrées et prouvées.** `computeDecisionDigests` hache une décision sous la forme d’un pré-enregistrement d’exécution (`planSha256`, `decisionSha256`), et `attestDecision` ajoute `cognate.policy.decided` au flux de politique du locataire, un flux dont `GET /events/:eventId` prouve déjà les événements. L’événement contient le résultat et les règles que chaque plan rejeté a violées, jamais les étapes du plan. Avec un `decisionId` et un `timestamp`, les mêmes entrées donnent une trace identique octet par octet.
- **Trois corrections apportées au noyau lors de son intégration dans Cognate.** Son cache de compilation est indexé uniquement sur la version de la politique, de sorte que deux politiques avec une version mais des pondérations différentes obtiennent les mêmes règles (le cache a disparu). Une décision peut maintenant être reproduite. Et un plan échoué obtient une valeur de `null` au lieu de moins l’infini, de sorte qu’une trace survit à un aller-retour JSON.
- **Types qui se résolvent à partir de npm.** Les déclarations de type du paquet 1.0.0 pointaient vers des paquets d’espace de travail qui ne sont pas sur npm, de sorte qu’un projet TypeScript obtenait des types non résolus sur chaque sous-chemin. La version 1.1.0 inclut ces déclarations dans le paquet, et CI installe le paquet dans un projet vide et vérifie le type d’une importation à partir de chaque entrée.

La liste complète se trouve dans [CHANGELOG.md](CHANGELOG.md).

### Nouveautés de la version 1.0.0

- **Enregistrements d’exécution.** `@cognate/model-registry` pré-enregistre une exécution avant de la lancer et enregistre son résultat dans le flux `cognate-<tenant>-runs`. Les identifiants de nommage de compte sont stockés uniquement sous forme de hachages SHA-256, et une exécution enregistre son propre coût, jamais le solde d’un compte.
- **Évaluations.** Une version de modèle contient un nombre quelconque d’évaluations (une exécution, sa réplication, un résultat agrégé), et une transition cite celles sur lesquelles elle repose. `requireEvaluationCitations` définit les transitions qui doivent être citées. Une version approuvée peut être rejetée avant son déploiement.
- **Portée du locataire.** Chaque route sur `@cognate/node` agit dans le contexte du locataire de l’appelant. Un enregistrement nommant un autre locataire est refusé, et l’ID d’un autre locataire renvoie la même réponse qu’un ID manquant. Un ID manquant est maintenant 404, et non 400.
- **Requêtes signées (modification importante).** Chaque écriture et chaque `GET /events/:eventId` doivent être signées avec la clé Ed25519 de l’appelant (`cognate-request-v1`), avec une fenêtre de temps et une protection contre la relecture. L’acteur sur chaque route est le signataire vérifié. L’enregistrement des agents et l’approbation des autorisations nécessitent une capacité `delegate`, et une clé racine de locataire fournie par un opérateur initialise le premier délégué de chaque locataire. Voir [Guide d’authentification et de migration](#guide-dauthentification-et-de-migration).
- **Les pouvoirs de la clé racine, en termes simples.** La documentation répertorie tout ce que la racine du locataire peut encore faire après l’initialisation, et indique qu’une racine dérivée d’une graine de test ne doit jamais être configurée en production.
- **Chaîne d’outils de test.** vitest 4.1.12 et vite 8.3.5 ; les avertissements élevés et critiques dans l’arborescence de développement sont supprimés à la racine, sans ignorer ni remplacer.

---

## Mission

Nous pensons que, à mesure que les systèmes d’IA gagnent en autonomie, les structures qui les gouvernent doivent gagner en rigueur. Les contrats intelligents s’exécutent. Les modèles infèrent. Mais personne n’« atteste » de ce que l’IA était autorisée à faire, de ce qu’elle a réellement fait et de savoir si un humain l’a approuvé.

Cognate est la couche manquante : registre de modèles, application des politiques, identité des agents et audit déterministe, unifiés entre les modèles, les organisations et les chaînes.

### Nos valeurs

- **La vérité avant la vitesse.** Chaque inférence de modèle est en append-only, rejouable et réconciliable. Si elle ne peut pas être prouvée, elle ne s’est pas produite.
- **Les humains approuvent ; les machines vérifient.** L’IA conseille, les modèles infèrent, mais rien ne se déploie ou n’agit sans une autorisation humaine explicite. Jamais.
- **Gouvernance structurelle, et non gouvernance politique.** Nous ne votons pas sur ce qui est valide. Nous définissons des invariants qui sont valables de manière inconditionnelle : l’identité du modèle est explicite, la lignée est ininterrompue, la version de la politique est monotone.
- **L’intention n’est pas l’exécution.** Déclarer ce qu’un agent doit faire et le laisser agir sont des actions distinctes avec des contrôles distincts. L’écart entre eux est l’endroit où réside la confiance.
- **Les modèles sont des témoins, et non des autorités.** Attestia atteste. Les chaînes valident. Mais l’autorité découle de règles structurelles, et non des poids d’un modèle.

---

## Architecture

Cognate consomme les primitives d’Attestia et ajoute une couche de domaine native à l’IA. Les bibliothèques utilisent l’état que vous leur transmettez. Quelques appels vont au-delà de cet état : `transitionVersion` et `feedbackFromMcpResult` enregistrent l’heure actuelle, les fonctions `decide` et `decideAsync` du noyau lisent l’heure et génèrent un identifiant aléatoire, à moins que vous ne leur transmettiez à la fois `decisionId` et `timestamp`, et `verifyRelease` lit l’heure et le registre RepoMesh, via le réseau ou à partir d’un répertoire local. Aucune autre fonction n’ouvre de socket, n’écrit dans un fichier ou ne lit l’heure.

| Paquet | Objectif | État |
|---------|---------|--------|
| @cognate/types | Types de domaine d’IA partagés (aucune dépendance) | Prêt |
| @cognate/policy | Moteur d’évaluation de politiques sémantiques | Prêt |
| @cognate/civility-kernel | Sélection de plan : filtrer les plans candidats en fonction de contraintes strictes, les évaluer en fonction de pondérations de préférences, puis exécuter ou demander | Prêt (nouveau dans la version 1.1.0) |
| @cognate/model-registry | Cycle de vie du modèle, gestion des versions, évaluation | Prêt |
| @cognate/agent-identity | Identité de l’agent, capacités, autorisations | Prêt |
| @cognate/prompt-store | Journalisation des invites/sorties avec événements chiffrés | Prêt |
| @cognate/repomesh-bridge | Vérification de la version RepoMesh (`verifyRelease`) avant un déploiement | Prêt |
| @cognate/node | Serveur d’API HTTP sur le port 4000, avec requêtes signées et portée du locataire | Prêt |

`@mcptoolshop/cognate` sur npm regroupe les bibliothèques, avec leurs déclarations de type à l’intérieur. `@cognate/node` s’exécute dans l’image Docker.

### Deux étapes : choisir un plan, puis valider chaque événement

Cognate contrôle un agent à deux moments.

1. **Avant qu’il n’agisse, `@cognate/civility-kernel` choisit parmi les plans.** L’agent propose des plans candidats. Les contraintes strictes suppriment ceux qui enfreignent une règle (un changement irréversible, une dépense dépassant une limite). Les plans restants sont évalués en fonction des pondérations de préférences de la politique. Le meilleur plan est exécuté, à moins que son incertitude ne dépasse le seuil de la politique : dans ce cas, l’agent demande. Si aucun plan ne survit, l’agent demande à la personne d’assouplir une contrainte ou de proposer une autre option.
2. **Pendant qu’il agit, `@cognate/policy` valide chaque événement.** Chaque invite, sortie ou dépense est vérifiée par rapport aux règles du locataire (filtres de contenu, limites de débit et de dépenses, capacités), et, parmi les règles qui correspondent, la plus stricte l’emporte.

Une décision peut être enregistrée et hachée. `attestDecision` ajoute `cognate.policy.decided` au flux de politiques du locataire, en incluant les résumés et le résumé de la décision, mais jamais les étapes du plan. `computeDecisionDigests` fournit le `planSha256` et le `decisionSha256` que la pré-inscription d’une exécution (`preRegisterRun`) demande. Si vous transmettez `decisionId` et `timestamp`, les mêmes entrées produiront une trace identique.

```js
import { createKernel, computeDecisionDigests } from "@mcptoolshop/cognate/civility-kernel";

const kernel = createKernel({
  policy: {
    version: "1.0",
    weights: { efficiency: 0.3, low_risk: 0.7 },
    constraints: ["no_irreversible_changes"],
    contextRules: [],
    uncertaintyThreshold: 0.4,
    memory: {},
    calibration: { riskTolerance: 0.3, verbosity: 0.5, initiative: 0.5 },
  },
});

const plans = [
  { id: "drop-and-reload", summary: "Drop the table and reload it", steps: [], meta: { reversibility: 0, estimatedTimeSec: 30 } },
  { id: "migrate-with-backup", summary: "Back up, then migrate", steps: [], meta: { reversibility: 1, estimatedTimeSec: 300, stake: 0.2 } },
];

const trace = kernel.decide("deploy:db", plans, { decisionId: "dec-1", timestamp: "2026-10-28T12:00:00.000Z" });
console.log(trace.outcome, trace.chosenPlanId); // "EXECUTE migrate-with-backup"

const { planSha256, decisionSha256 } = computeDecisionDigests(trace, plans[1]);
console.log(planSha256.length, decisionSha256.length); // 64 64
```

Les politiques sont modifiées via la boucle du noyau, chaque étape étant approuvée par un humain : `proposePolicyUpdates` à partir des commentaires, puis `diffPolicy`, `lintPolicy` et `explainPolicy` avant que le changement ne soit appliqué.

### Alignement réglementaire

| Réglementation | Cognate répond aux exigences |
|------------|-------------------|
| Article 12 de la loi européenne sur l’IA | Journalisation des événements en annexe sur toute la durée de vie du système |
| Article 14(5) de la loi européenne sur l’IA | Identification des personnes physiques lors de la vérification |
| NIST AI RMF | Fonctions de gouvernance, de cartographie, de mesure et de gestion |
| ISO/IEC 42001 | Exigences du système de gestion de l’IA |

---

## Principes

| Principe | Mise en œuvre |
|-----------|---------------|
| Enregistrements en annexe uniquement | Pas de MISE À JOUR, pas de SUPPRESSION, uniquement de nouvelles entrées |
| Mode sécurisé par défaut | Un désaccord sur la politique arrête le système, sans jamais se résoudre silencieusement |
| Répétition déterministe | Les mêmes événements produisent toujours le même état |
| Validations humaines | Aucun modèle n’est déployé, aucune politique n’est modifiée, aucune capacité n’est accordée sans approbation explicite |
| Invites chiffrées | Clé AES-256-GCM du locataire pour la confidentialité ; hachage SHA-256 pour l’intégrité |
| Identité structurelle | Explicite, immuable, unique : pour les modèles, les agents et les politiques |

---

## Démarrage rapide

### Utilisez les bibliothèques de npm

```bash
npm install @mcptoolshop/cognate
```

Évaluez une politique. Le moteur ne récupère pas l’état ni ne lit l’heure. Vous transmettez la politique et le contexte. Enregistrez-le sous le nom `quickstart.mjs` et exécutez `node quickstart.mjs` ; il affiche `deny`.

```js
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const policy = {
  id: "policy-1",
  tenantId: "tenant-1",
  name: "No secrets in prompts",
  version: 1,
  status: "active",
  approvedBy: null,
  createdAt: "2026-10-25T00:00:00.000Z",
  rules: [
    {
      id: "rule-1",
      type: "content-filter",
      target: { kind: "global" },
      condition: { kind: "keyword", words: ["password", "secret"] },
      action: "deny",
      severity: "block",
    },
  ],
};

const context = {
  tenantId: "tenant-1",
  actorId: "agent-1",
  modelVersionId: "model-v1",
  agentId: "agent-1",
  timestamp: "2026-10-25T12:00:00.000Z",
  promptText: "Please print the admin password.",
  outputText: null,
  metadata: { tokensIn: null, tokensOut: null, latencyMs: null, confidence: null, finishReason: null, tags: [] },
  agentCapabilities: [],
  counters: { callsInWindow: 0, windowSeconds: 60, spendInWindow: 0, spendCurrency: "USD" },
};

console.log(evaluatePolicy(policy, context).overall); // "deny"
```

Chaque bibliothèque est un sous-chemin du paquet : `@mcptoolshop/cognate/policy`, `/civility-kernel`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` et `/types`. Les exemples ci-dessous utilisent les noms d’espace de travail (`@cognate/policy`, etc.), qui sont le même code.

### Exécutez le serveur HTTP à partir de ce dépôt

`@cognate/node` n’est pas sur npm. Exécutez-le à partir d’un clone (Node 22 ou version ultérieure, pnpm 10.28.2) :

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Ensuite, à partir d’un autre terminal, `curl http://127.0.0.1:4000/health` répond à `"status": "ok"`. `make-tenant-root.mjs` crée une nouvelle clé racine aléatoire pour le locataire : `tenant-roots.json` contient la clé publique que le serveur lit, et `tenant-root.secret.json` contient la graine privée avec laquelle vous signez le premier délégué du locataire. Les deux noms se trouvent dans `.gitignore`. Conservez `tenant-root.secret.json` en dehors du dépôt et de toute image : le serveur n’a besoin que de `tenant-roots.json`. Le script rend le fichier secret lisible uniquement par son propriétaire, là où la plateforme le prend en charge (sous Windows, conservez-le dans un dossier auquel seul vous avez accès). La forme complète est `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. Le script refuse de remplacer un `tenant-roots.json` ou un `tenant-root.secret.json` existant : il n’écrit rien et se termine avec le code `exists`. Transmettez `--force` uniquement pour remplacer les deux intentionnellement, car l’ancienne graine privée ne peut pas être récupérée. La signature des requêtes est abordée dans le [guide de migration](#guide-dauthentification-et-de-migration).

### Développement

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Enregistrez une version du modèle, puis faites-la passer par le cycle de vie. Une version passe `registered → evaluated → approved → deployed`, et elle peut être `rejected` ou `retired`. `transitionVersion` fait passer un instantané que l’appelant conserve. Sur le serveur HTTP, `approved → deployed` appelle `verifyRelease` sur le `repo` et le `release` enregistrés lorsque la version a été enregistrée. Une version qui ne passe pas le test n’est pas déployée, et une requête qui mentionne une version différente n’est pas non plus acceptée. Le refus est enregistré.

Les évaluations sont liées à une version, et ce, pour autant de versions que vous en avez : une exécution, sa réplication, un résultat agrégé. **Enregistrez une évaluation, puis effectuez une transition en la citant.** `recordEvaluation` (ou `attestEvaluation`, qui ajoute également `cognate.evaluation.recorded`) ne modifie jamais la version elle-même, de sorte que chaque appel est une simple ajout. Le `evaluationIds` d’une transition indique les évaluations sur lesquelles repose la décision. Chacune doit être enregistrée pour cette version, et les identifiants sont liés au hachage de la chaîne de la transition. Une version approuvée peut toujours être rejetée avant son déploiement. Le fait que les transitions doivent-elles citer une source est un paramètre : `requireEvaluationCitations` : `false` (par défaut), `"decisions"` (l’approbation et le rejet doivent citer une source) ou `"all"`. Le serveur HTTP le lit à partir de `COGNATE_REQUIRE_EVALUATION_CITATIONS` et refuse de démarrer avec toute autre valeur.

Pré-enregistrez une exécution avant son lancement et enregistrez son résultat dans le flux `cognate-<tenant>-runs`. Les identifiants de nom de compte (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) sont stockés uniquement sous forme de hachages hexadécimaux en minuscules de 64 caractères SHA-256, et une exécution enregistre son propre `cost` (`unitsSpent`, `rate`, `basis`) plutôt que les soldes des comptes.

```ts
import {
  createRegistry,
  registerModel,
  registerVersion,
  recordEvaluation,
  transitionVersion,
  preRegisterRun,
  recordRunOutcome,
  attestRunPreRegistered,
  attestRunCompleted,
} from "@cognate/model-registry";
```

---

## Docker

L’image exécute `@cognate/node` et fournit l’API de gouvernance.

**Le serveur a besoin d’un fichier de racines de locataire avant de démarrer.** Dans le mode `enforce` par défaut, il refuse de démarrer sans celui-ci, et aucune clé racine n’est incluse dans l’image. Créez-en un avec `node scripts/make-tenant-root.mjs my-tenant` (voir [Démarrage rapide](#exécutez-le-serveur-http-à-partir-de-ce-dépôt)), ou écrivez votre propre fichier JSON au format `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. Le `docker-compose.yml` inclus définit `COGNATE_TENANT_ROOTS_PATH` sur `/run/cognate/tenant-roots.json` et affiche le point de montage sous forme de ligne de volume commentée. Décommentez cette ligne avec le chemin d’accès de votre fichier, ou ajoutez un `docker-compose.override.yml` à côté :

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

Sans le fichier, le serveur affiche une ligne d’erreur JSON dans le format d’erreur de l’API (`auth.missing-tenant-roots`, avec un indice) et se termine avec le code 1. Définissez `COGNATE_DEBUG=1` pour ajouter la pile.

Une fois qu’il est en cours d’exécution, `/health` renvoie :

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

Le volume `cognate-data` est monté à `/app/data`. Le journal des événements est `/app/data/events.jsonl`. Les instantanés sont `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` et `/app/data/cognate/prompts.json`. `GET /events/:eventId` lit ce journal et renvoie l’événement enregistré avec une preuve d’inclusion Attestia et la racine. L’appelant envoie les mêmes en-têtes signés `cognate-request-v1` qu’une écriture. Un identifiant qui ne figure pas dans le journal de ce locataire est une erreur, et le corps ne contient aucune preuve. Le texte d’invite et de sortie est exclu de l’événement. La route n’appelle pas RepoMesh. La composition d’Attestia utilise la même variable de journal des événements sur son propre volume. Chaque fichier a un seul rédacteur. L’image RepoMesh ne monte pas ce journal. `REPOMESH_FAIL_ON` a par défaut la valeur `unverified` : seul un PASS est déployé. Définissez-le sur `fail` pour autoriser un déploiement NON VÉRIFIÉ. L’image ne définit pas d’URL de grand livre. L’image est générée par le flux de publication à partir d’une étiquette `v*`, après la publication du package npm, et est poussée vers `ghcr.io/mcp-tool-shop-org/cognate` sous les formes `X.Y.Z`, `X.Y` et `sha-*`. `latest` ne se déplace que sur une étiquette `v*`.

---

## Guide d’authentification et de migration

### Ce qui est appliqué dans la version 1.1.0 (inchangé depuis la version 1.0.0)

- **Signature des requêtes Ed25519 (`cognate-request-v1`).** Par défaut (`signedRequests: "enforce"`), chaque requête `POST` et `GET /events/:eventId` doit inclure `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` et `X-Signature` dans la chaîne de requête canonique de 8 lignes (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Les corps `POST` doivent être au format RFC 8785 JCS canonique UTF-8 (`400 auth.body-not-canonical` sinon). `kid` est le hachage hexadécimal en minuscules de 64 caractères SHA-256 de la clé publique brute de 32 octets Ed25519.
- **Protection contre la relecture ordonnée et uniformité du code 401.** `X-Timestamp` doit être compris dans une plage de ± 300 s par rapport à l’heure du serveur (`GET /health` expose `serverTime`). Le magasin de relecture en mémoire vérifie `(agentId, nonce)` en lecture seule avant la vérification de la signature, l’enregistre uniquement après la vérification de la signature et le conserve pendant toute la période de validité de 600 s. Chaque échec d’authentification avant la signature renvoie un `401` identique avec `code: "auth.unauthenticated"`.
- **Liaison d’acteur (`403 auth.actor-mismatch`).** L’acteur de chaque route (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` et `context.agentCapabilities`) est lié au signataire vérifié avant RepoMesh ou tout ajout d’événement.
- **Garde contre l’escalade de privilèges et amorçage de la clé racine.** L’enregistrement d’agent (`POST /identity/agents`) et l’approbation d’autorisation (`POST /identity/grants/:id/approve`) nécessitent une capacité `delegate` active. L’auto-approbation est refusée (`403 auth.self-approval-forbidden`). Les `agent.capabilities` pré-remplis sont refusés, sauf lorsque la clé publique racine fournie par l’opérateur du locataire (`tenantRootsPath` ou `COGNATE_TENANT_ROOTS_PATH`) amorce le premier `delegate` du locataire. La racine crée ou approuve directement un `delegate` uniquement lors de l’amorçage, tandis que le locataire n’a pas de `delegate` actif ; par conception, la racine du locataire conserve ses pouvoirs de récupération après l’amorçage (elle fait pivoter la clé d’un principal humain ou d’un agent, révoque tout principal et approuve les autorisations non déléguées, et la récupération d’une racine compromise consiste à la remplacer dans la configuration révisée et à resigner les agents délégués du locataire). La rotation d’une clé confère l’autorité de ce principal à celui qui détient la nouvelle clé, et la racine choisit la nouvelle clé. Ainsi, après que la racine a fait pivoter la clé d’un délégué humain, la racine détient l’autorité de ce délégué, y compris la création de nouveaux délégués (enregistrement d’agents et approbation des autorisations `delegate`). Et si la racine révoque toutes les `delegate` actives, le locataire n’a plus de `delegate` actif, de sorte que la racine peut à nouveau en créer un directement. Une racine dérivée d’une graine de test ne doit jamais être configurée en production. Le serveur refuse les propres clés racine de test du référentiel au démarrage (`auth.test-only-root-key-forbidden`), à moins qu’un harnais de test ne définisse `allowTestOnlyRoots: true`, mais il ne peut pas reconnaître une racine dérivée d’une autre graine connue en dehors du déploiement. Aucune clé racine de locataire n’est incluse dans le référentiel ou l’image Docker, et le serveur refuse de démarrer en mode `enforce` sans les racines fournies par l’opérateur (`auth.missing-tenant-roots`). Un principal d’agent (`principal: "agent"`) ne peut pas enregistrer un principal humain (`principal: "human"`) ou accorder une autorisation `delegate`, et un `owner` ne peut pas faire pivoter la clé d’un principal humain. La rotation de clé (`POST /identity/agents/:id/key`) et la révocation (`POST /identity/agents/:id/revoke`) invalident immédiatement les anciens `kid`.

### Pas encore, et limites actuelles

- **Stockage de relecture à instance unique.** Le stockage de relecture `(agentId, nonce)` est stocké en mémoire dans un seul `@cognate/node` processus ; les déploiements multi-instance ne partagent pas l’état de relecture.
- **Les approbations distinctes, le flux d’identité et la vérification hors ligne sont prévus pour une version ultérieure.** Aujourd’hui, toute action soumise à une approbation doit être signée directement par le responsable habilité. Les `cognate-approval-v1` approbations distinctes (permettant à un agent de soumettre une transition contenant une signature humaine distincte), la conservation durable `approvalId`, le flux d’événements attesté `cognate-<tenant>-identity`, les champs d’événements `submittedBy` / `authorizedBy`, le vérificateur hors ligne autonome et l’ancrage de clé racine RepoMesh ne sont pas inclus dans la version 1.1.0.
- **Les identifiants sont globaux pour tous les locataires.** L’enregistrement d’un identifiant qu’un autre locataire possède déjà est refusé car il s’agit d’un doublon.

### Migration des agents existants vers les clés Ed25519

1. **Générez une paire de clés Ed25519** à l’aide de `generateEd25519KeyPair()` à partir de `@cognate/node` (dans ce référentiel ; `@cognate/node` n’est pas sur npm) :
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

const keyPair = generateEd25519KeyPair();
// keyPair.publicKey (clé brute de 32 octets, 43 caractères base64url), keyPair.kid (64 caractères sha256 hexadécimal), keyPair.seedHex
```
2. **Configurez les clés publiques racines du locataire de l’opérateur et amorcez le premier délégué du locataire** en fournissant un fichier de clé racine JSON via `COGNATE_TENANT_ROOTS_PATH` (ou `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`) et en signant `POST /identity/agents` avec cette clé racine du locataire lorsque le locataire n’a aucune `delegate` active (ou en initialisant l’agent avec `publicKey` et `kid` dans `agents.json` avant le démarrage). Les clés de test uniquement situées sous `packages/node/tests/fixtures/` sont rejetées au démarrage, à moins que `allowTestOnlyRoots: true` ne soit explicitement défini.
3. **Signez les requêtes avec `createSignedClient` ou `signHttpRequest`** :
```ts
const client = createSignedClient({
baseUrl: "http://127.0.0.1:4000",
agentId: "my-agent-id",
seedHex: keyPair.seedHex,
});
const res = await client.request("/registry/models", {
method: "POST",
body: { model },
});
```
`createSignedClient` canonise les corps JSON avec RFC 8785 JCS, signe chaque requête et synchronise automatiquement le décalage d’horloge à partir de `GET /health` et de `serverTime` et réessaie une fois si un décalage d’horloge provoque une `401`.
4. **Fenêtre de migration facultative (`signedRequests: "log"`) :** Pour accepter temporairement les requêtes non signées `/identity/*` pendant que les appelants effectuent la migration, définissez `COGNATE_SIGNED_REQUESTS=log` et `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>`. Les événements enregistrés à partir des requêtes non signées en mode `log` contiennent `unsigned: true`.

---

## Modèle de menace

Cognate suppose le modèle de menace suivant :

1. **Point de terminaison d’inférence compromis.** Un attaquant obtient l’accès à l’API du modèle. Atténuation : toutes les invites et les sorties sont enregistrées avec des charges utiles chiffrées et des hachages d’intégrité SHA-256. La relecture est déterministe.
2. **Agent malveillant ou identité d’appelant falsifiée.** Atténuation : chaque écriture HTTP et chaque lecture `/events/:eventId` sont authentifiées avec une signature Ed25519 (`cognate-request-v1`), une vérification de l’horodatage de ± 300 s et un stockage de relecture de 600 s ; les capacités sont limitées dans le temps, limitées dans leur portée et révocables (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), et chaque route lie les champs d’acteur de son corps au signataire vérifié (`403 auth.actor-mismatch`). Limite : le stockage de relecture est stocké en mémoire par processus, et les approbations distinctes multi-parties (`cognate-approval-v1`) et la vérification de la signature du flux d’événements hors ligne ne sont pas incluses dans la version 1.1.0.
3. **Altération du modèle de la chaîne d’approvisionnement.** Les poids ou les configurations sont modifiés après l’évaluation. Atténuation : le registre de modèles hache les poids, la configuration et le manifeste lors de l’enregistrement, et `ModelVersion.repo` est stocké sous forme de `sha256:<hex>`. Toute déviation invalide la version.
4. **Contournement de la stratégie via l’injection d’invite.** Une invite malveillante tente de contourner les règles de contenu. Atténuation : l’évaluation de la stratégie est déterministe, versionnée et s’exécute avant l’inférence. Aucune invite ne s’exécute sans qu’une vérification de stratégie réussisse.
5. **Abus interne des journaux d’audit.** Un opérateur privilégié manipule les journaux. Atténuation : le magasin d’événements est en append-only et est sauvegardé par les preuves d’arbres de Merkle d’Attestia. La manipulation rompt la chaîne de hachage.
6. **Accès multi-locataire sur le serveur HTTP.** Un agent d’un locataire accède aux enregistrements d’un autre locataire. Atténuation : chaque route agit dans le locataire du signataire authentifié. Un enregistrement qui nomme un autre locataire est refusé, et l’identifiant d’un autre locataire est renvoyé comme étant manquant.
7. **Clé racine de locataire mal utilisée ou mal configurée.** La clé racine initialise un locataire et conserve les pouvoirs de récupération par la suite. Atténuation : aucune clé racine n’est fournie dans le dépôt ou l’image, le serveur refuse de démarrer en mode `enforce` sans les racines fournies par l’opérateur, et il refuse les propres clés racines de test du dépôt. Limite : les pouvoirs de la racine sont larges par conception (voir ci-dessus), de sorte que l’opérateur doit conserver la clé racine avec autant de soin que le locataire lui-même, et la récupération à partir d’une clé racine compromise implique de la remplacer dans la configuration révisée.

Aucune télémétrie ou analyse. Un déploiement sur le serveur HTTP demande à RepoMesh si la version nommée est valide. La santé et les autres routes restent sur ce processus. Les rapports de sécurité sont transmis via [SECURITY.md](SECURITY.md).

---

## État

Version 1.1.0, en cours de construction en mode public. Tous les packages sont implémentés, testés et en cours de construction. Installez le paquet avec `npm install @mcptoolshop/cognate`. Les `@cognate/*` restent dans ce dépôt.

| Porte d’entrée | État |
|------|--------|
| Construction | Réussite |
| Tests | 490 tests réussis (civility-kernel 164, node 157, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Couverture | Lignes : 91,9 % dans civility-kernel, 94,3 % dans node, 93,4 % dans policy, 99,6 % dans model-registry, et 100 % dans agent-identity, prompt-store et repomesh-bridge, avec un seuil de couverture de ligne vitest de 90 ou plus dans chacun de ces sept packages |
| Vérification du type | Propre, et le paquet construit vérifie le type dans un projet vide sous `bundler` et `node16` |
| Docker | L’image sert l’API de gouvernance. Le volume contient le journal des événements et les trois instantanés |
| Vérification avant déploiement | Toutes les portes d’entrée sont franchies (16/16 vérifié) |

---

Construit par [mcp-tool-shop](https://mcp-tool-shop.github.io/)
