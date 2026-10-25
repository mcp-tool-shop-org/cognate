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

**Version 1.0.0.** La version précédente était la 0.1.8. Les versions 0.2.0 et 0.3.0 n’ont jamais été publiées séparément, et leurs modifications sont intégrées à la version 1.0.0. La version 1.0.0 modifie l’API HTTP : le serveur refuse désormais les requêtes non signées. À partir de la version 1.0, les versions suivent un système de versionnement sémantique : une modification qui perturbe l’API HTTP, le format des requêtes signées ou le format des événements et des attestations est accompagnée d’une nouvelle version principale. Voir [Nouveautés de la version 1.0.0](#nouveautés-de-la-version-100).

Cognate est la couche de gouvernance de l’IA, construite sur [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prouve qu’un événement s’est produit (un événement, une transaction, une transition d’état) et lie cette preuve à une chaîne. Cognate utilise les mêmes primitives d’attestation pour gouverner les systèmes d’IA : ce qu’un modèle était autorisé à faire, ce qu’il a réellement fait et qui l’a autorisé.

Cognate atteste de la vérité de l’IA : la lignée du modèle, les décisions de politique, les capacités de l’agent et l’intégrité des invites et des résultats. Les mêmes preuves Merkle. Le même magasin d’événements en append-only. Un domaine différent.

Attestia, Cognate et RepoMesh sont trois produits. Attestia prend en charge le domaine financier (coffre-fort personnel, trésorerie d’organisation, registre) en utilisant ces primitives. RepoMesh est le réseau de publication : événements signés, manifestes de nœuds et horloge de confiance ancrée sur XRPL, sur son propre registre RFC 6962. Il n’utilise pas l’arbre de Merkle d’Attestia. Cognate appelle Attestia lorsqu’il a besoin d’une preuve, et RepoMesh lorsqu’il a besoin qu’une publication soit vérifiée. `@cognate/repomesh-bridge` est cette vérification.

---

## Nouveautés de la version 1.0.0

- **Enregistrements d’exécution.** `@cognate/model-registry` pré-enregistre une exécution avant de la lancer et enregistre son résultat dans le flux `cognate-<tenant>-runs`. Les identifiants de nommage des comptes sont stockés uniquement sous forme de hachages SHA-256, et une exécution enregistre ses propres coûts, jamais le solde d’un compte.
- **Évaluations.** Une version de modèle contient un nombre quelconque d’évaluations (une exécution, sa réplication, un résultat agrégé), et une transition cite celles sur lesquelles elle repose. `requireEvaluationCitations` définit les transitions qui doivent être citées. Une version approuvée peut être rejetée avant son déploiement.
- **Définition du périmètre du locataire.** Chaque route sur `@cognate/node` agit dans le périmètre du locataire appelant. Un enregistrement qui référence un autre locataire est refusé, et l’ID d’un autre locataire renvoie la même réponse qu’un ID manquant. Un ID manquant est maintenant 404, et non 400.
- **Requêtes signées (modification).** Chaque écriture et chaque `GET /events/:eventId` doivent être signées avec la clé Ed25519 du locataire appelant (`cognate-request-v1`), avec une fenêtre de temps et une protection contre la relecture. L’acteur sur chaque route est le signataire vérifié. L’enregistrement des agents et l’approbation des autorisations nécessitent une capacité `delegate`, et une clé racine de locataire fournie par un opérateur initialise le premier délégué de chaque locataire. Voir [Guide d’authentification et de migration](#authentification-et-guide-de-migration).
- **Les pouvoirs de la clé racine, en termes simples.** La documentation répertorie tout ce que la racine du locataire peut encore faire après l’initialisation, et indique qu’une racine dérivée d’une graine de test ne doit jamais être configurée en production.
- **Chaîne d’outils de test.** vitest 4.1.12 et vite 8.3.5 ; les avertissements élevés et critiques dans l’arborescence de développement sont effacés à la racine, sans ignorer ni remplacer.

La liste complète se trouve dans [CHANGELOG.md](CHANGELOG.md).

---

## Mission

Nous pensons que, à mesure que les systèmes d’IA gagnent en autonomie, les structures qui les gouvernent doivent gagner en rigueur. Les contrats intelligents s’exécutent. Les modèles infèrent. Mais personne n’« atteste » de ce que l’IA était autorisée à faire, de ce qu’elle a réellement fait et de savoir si un humain l’a approuvé.

Cognate est la couche manquante : registre de modèles, application des politiques, identité des agents et audit déterministe, le tout unifié entre les modèles, les organisations et les chaînes.

### Ce que nous défendons

- **La vérité avant la vitesse.** Chaque inférence de modèle est enregistrée en append-only, rejouable et réconciliable. Si elle ne peut pas être prouvée, elle ne s’est pas produite.
- **Les humains approuvent ; les machines vérifient.** L’IA conseille, les modèles infèrent, mais rien ne se déploie ni n’agit sans une autorisation humaine explicite. Jamais.
- **Gouvernance structurelle, et non gouvernance politique.** Nous ne votons pas sur ce qui est valide. Nous définissons des invariants qui sont valables de manière inconditionnelle : l’identité du modèle est explicite, la lignée est ininterrompue, la version de la politique est monotone.
- **L’intention n’est pas l’exécution.** Déclarer ce qu’un agent doit faire et le laisser agir sont des actions distinctes avec des portes d’entrée distinctes. L’écart entre elles est l’endroit où réside la confiance.
- **Les modèles sont des témoins, et non des autorités.** Attestia atteste. Les chaînes valident. Mais l’autorité découle de règles structurelles, et non des poids d’un modèle.

---

## Architecture

Cognate consomme les primitives d’Attestia et ajoute une couche de domaine spécifique à l’IA. Les packages sont des fonctions pures. Les appelants fournissent l’état. Rien ici n’ouvre une socket, n’écrit dans un fichier ou ne lit l’heure, à moins que vous ne lui fournissiez la valeur.

| Package | Objectif | État |
|---------|---------|--------|
| @cognate/types | Types de domaine de gouvernance de l’IA partagés (zéro dépendance) | Prêt |
| @cognate/policy | Moteur d’évaluation de politiques sémantiques | Prêt |
| @cognate/model-registry | Cycle de vie du modèle, versionnage, évaluation | Prêt |
| @cognate/agent-identity | Identité de l’agent, capacités, autorisations | Prêt |
| @cognate/prompt-store | Journalisation des invites/sorties avec événements chiffrés | Prêt |
| @cognate/repomesh-bridge | Vérification de la publication RepoMesh (`verifyRelease`) avant un déploiement | Prêt |
| @cognate/node | Serveur d’API HTTP sur le port 4000, avec requêtes signées et définition du périmètre du locataire | Prêt |

`@mcptoolshop/cognate` sur npm regroupe les bibliothèques. `@cognate/node` s’exécute dans l’image Docker.

### Conformité réglementaire

| Règlement | Cognate répond aux exigences |
|------------|-------------------|
| Article 12 de la loi européenne sur l’IA | Journalisation d’événements en append-only sur toute la durée de vie du système |
| Article 14(5) de la loi européenne sur l’IA | Identification des personnes physiques lors de la vérification |
| NIST AI RMF | Fonctions de gouvernance, de cartographie, de mesure et de gestion |
| ISO/IEC 42001 | Exigences du système de gestion de l’IA |

---

## Principes

| Principe | Mise en œuvre |
|-----------|---------------|
| Enregistrements en append-only | Pas de MISE À JOUR, pas de SUPPRESSION, seulement de nouvelles entrées |
| Fonctionnement en mode sécurisé | Un désaccord sur la politique interrompt le système, sans jamais se résoudre silencieusement. |
| Relecture déterministe | Les mêmes événements produisent le même état, toujours. |
| Validation humaine | Aucun modèle n’est déployé, aucune politique n’est modifiée, aucune autorisation n’est accordée sans approbation explicite. |
| Requêtes chiffrées | Clé AES-256-GCM spécifique au locataire pour la confidentialité ; hachage SHA-256 pour l’intégrité. |
| Identité structurelle | Explicite, immuable, unique : pour les modèles, les agents et les politiques. |

---

## Guide de démarrage rapide

### Utilisez les bibliothèques de npm

```bash
npm install @mcptoolshop/cognate
```

Évaluez une politique. Le moteur ne récupère pas l’état ni ne consulte l’heure. Vous transmettez la politique et le contexte. Enregistrez ceci sous le nom `quickstart.mjs` et exécutez `node quickstart.mjs` ; il affiche `deny`.

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

Chaque bibliothèque est un sous-chemin du paquet : `@mcptoolshop/cognate/policy`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` et `/types`. Les exemples ci-dessous utilisent les noms d’espaces de travail (`@cognate/policy`, etc.), qui correspondent au même code.

### Exécutez le serveur HTTP à partir de ce dépôt

`@cognate/node` n’est pas disponible sur npm. Exécutez-le à partir d’une copie (Node 22 ou version ultérieure, pnpm 10.28.2) :

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Ensuite, à partir d’un autre terminal, `curl http://127.0.0.1:4000/health` répond à `"status": "ok"`. `make-tenant-root.mjs` génère une nouvelle clé racine aléatoire pour le locataire : `tenant-roots.json` contient la clé publique que le serveur lit, et `tenant-root.secret.json` contient la clé privée que vous utilisez pour signer le premier délégué du locataire. Les deux noms se trouvent dans `.gitignore`. Conservez `tenant-root.secret.json` en dehors du dépôt et de toute image : le serveur n’a besoin que de `tenant-roots.json`. Le script rend le fichier secret accessible uniquement à son propriétaire, là où la plateforme le permet (sous Windows, conservez-le dans un dossier auquel seul vous avez accès). La forme complète est `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. Le script refuse de remplacer un `tenant-roots.json` ou un `tenant-root.secret.json` existant : il n’écrit rien et se termine avec le code `exists`. Ne transmettez `--force` que pour remplacer les deux intentionnellement, car l’ancienne clé privée ne peut pas être récupérée. La signature des requêtes est expliquée dans le [guide de migration](#authentification-et-guide-de-migration).

### Développement

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Enregistrez une version de modèle, puis exécutez-la tout au long de son cycle de vie. Une version passe par `registered → evaluated → approved → deployed`, et elle peut être `rejected` ou `retired`. `transitionVersion` fait passer un instantané que l’appelant conserve. Sur le serveur HTTP, `approved → deployed` appelle `verifyRelease` sur les `repo` et `release` enregistrés lors de l’enregistrement de la version. Une version qui ne passe pas le test n’est pas déployée, et une requête qui fait référence à une version différente ne l’est pas non plus. Le refus est enregistré.

Les évaluations sont liées à une version, autant que vous en avez : une exécution, sa réplication, un résultat agrégé. **Enregistrez une évaluation, puis effectuez une transition en la citant.** `recordEvaluation` (ou `attestEvaluation`, qui ajoute également `cognate.evaluation.recorded`) ne fait jamais passer la version elle-même, de sorte que chaque appel est une simple annexe. Le `evaluationIds` d’une transition indique les évaluations sur lesquelles repose la décision. Chacune doit être enregistrée pour cette version, et les identifiants sont liés au hachage de la lignée de la transition. Une version approuvée peut toujours être rejetée avant son déploiement. Le fait que les transitions doivent-elles citer ou non est un paramètre : `requireEvaluationCitations` : `false` (par défaut), `"decisions"` (l’approbation et le rejet doivent citer) ou `"all"`. Le serveur HTTP le lit à partir de `COGNATE_REQUIRE_EVALUATION_CITATIONS` et refuse de démarrer avec toute autre valeur.

Pré-enregistrez une exécution avant son lancement et enregistrez son résultat dans le flux `cognate-<tenant>-runs`. Les identifiants de nommage de compte (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) sont stockés uniquement sous forme de hachages hexadécimaux de 64 caractères en minuscules SHA-256, et une exécution enregistre son propre `cost` (`unitsSpent`, `rate`, `basis`) au lieu des soldes de compte.

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

**Le serveur a besoin d’un fichier de clés racines du locataire avant de démarrer.** En mode `enforce` par défaut, il refuse de démarrer sans celui-ci, et aucune clé racine n’est incluse dans l’image. Créez-en un avec `node scripts/make-tenant-root.mjs my-tenant` (voir [Guide de démarrage rapide](#exécutez-le-serveur-http-à-partir-de-ce-dépôt)), ou écrivez votre propre fichier JSON du format `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. Le `docker-compose.yml` inclus définit `COGNATE_TENANT_ROOTS_PATH` sur `/run/cognate/tenant-roots.json` et affiche le montage sous forme de ligne de volume commentée. Décommentez cette ligne avec le chemin d’hôte de votre fichier, ou ajoutez un `docker-compose.override.yml` à côté :

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

Le volume `cognate-data` est monté à `/app/data`. Le journal des événements est `/app/data/events.jsonl`. Les instantanés sont `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` et `/app/data/cognate/prompts.json`. `GET /events/:eventId` lit ce journal et renvoie l’événement enregistré avec une preuve d’inclusion Attestia et la clé racine. L’appelant envoie les mêmes en-têtes signés `cognate-request-v1` qu’une écriture. Un identifiant qui ne figure pas dans le journal de ce locataire est une erreur, et le corps ne contient aucune preuve. Le texte de la requête et de la réponse ne sont pas inclus dans l’événement. La route n’appelle pas RepoMesh. La composition d’Attestia utilise la même variable de journal des événements sur son propre volume. Chaque fichier a un seul rédacteur. L’image de RepoMesh ne monte pas ce journal. `REPOMESH_FAIL_ON` a par défaut `unverified` : seul un PASS est déployé. Définissez-le sur `fail` pour autoriser le déploiement d’une version NON VÉRIFIÉE. L’image ne définit pas d’URL de grand livre. L’image est générée par le flux de publication à partir d’une étiquette `v*`, après la publication du paquet npm, et poussée vers `ghcr.io/mcp-tool-shop-org/cognate` sous les noms `X.Y.Z`, `X.Y` et `sha-*`. `latest` ne se déplace que sur une étiquette `v*`.

---

## Authentification et guide de migration

### Ce qui est appliqué dans la version 1.0.0

- **Signature de requête Ed25519 (`cognate-request-v1`).** Par défaut (`signedRequests: "enforce"`), chaque `POST` et `GET /events/:eventId` doit inclure `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` et `X-Signature` dans la chaîne de requête canonique de 8 lignes (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Les corps de requête `POST` doivent être au format RFC 8785 JCS canonique UTF-8 (`400 auth.body-not-canonical`, sinon). `kid` est la clé publique brute de 32 octets, représentée en hexadécimal et en minuscules, de 64 caractères SHA-256 (Ed25519).
- **Protection contre la relecture ordonnée et authentification uniforme 401.** `X-Timestamp` doit se situer dans une plage de ± 300 s par rapport à l’heure du serveur (`GET /health` expose `serverTime`). Le magasin de relecture en mémoire vérifie `(agentId, nonce)` en lecture seule avant la vérification de la signature, l’enregistre uniquement après la vérification de la signature et le conserve pendant toute la période de validité de 600 s. Chaque échec d’authentification avant la signature renvoie une `401` identique avec `code: "auth.unauthenticated"`.
- **Association d’acteur (`403 auth.actor-mismatch`).** L’acteur sur chaque route (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` et `context.agentCapabilities`) est associé au signataire vérifié avant RepoMesh ou tout ajout d’événement.
- **Garde contre l’escalade de privilèges et amorçage de la clé racine.** L’enregistrement de l’agent (`POST /identity/agents`) et l’approbation de l’autorisation (`POST /identity/grants/:id/approve`) nécessitent une capacité `delegate` active. L’auto-approbation est refusée (`403 auth.self-approval-forbidden`). Les `agent.capabilities` pré-remplis sont refusés, sauf lorsque la clé publique racine fournie par l’opérateur du locataire (`tenantRootsPath` ou `COGNATE_TENANT_ROOTS_PATH`) amorce le premier `delegate` du locataire. La clé racine crée ou approuve une `delegate` directement uniquement lors de l’amorçage, tandis que le locataire n’a aucune `delegate` active ; par conception, la clé racine du locataire conserve ses pouvoirs de récupération après l’amorçage (elle fait pivoter la clé d’un principal humain ou d’un agent, révoque tout principal et approuve les autorisations non déléguées, et la récupération à partir d’une clé racine compromise implique de la remplacer dans la configuration révisée et de resigner les agents délégués du locataire). La rotation d’une clé confère l’autorité de ce principal à celui qui détient la nouvelle clé, et la clé racine choisit la nouvelle clé. Ainsi, après que la clé racine a fait pivoter la clé d’un délégué humain, la clé racine détient l’autorité de ce délégué, y compris la création de nouveaux délégués (enregistrement des agents et approbation des `delegate`). Et si la clé racine révoque toutes les `delegate` actives, le locataire n’a plus de `delegate` active, de sorte que la clé racine peut à nouveau en créer une directement. Une clé racine dérivée d’une clé de test ne doit jamais être configurée en production. Le serveur refuse les propres clés racines de test du référentiel au démarrage (`auth.test-only-root-key-forbidden`), à moins qu’un ensemble de tests ne définisse `allowTestOnlyRoots: true`, mais il ne peut pas reconnaître une clé racine dérivée d’une autre clé connue en dehors du déploiement. Aucune clé racine de locataire n’est incluse dans le référentiel ou l’image Docker, et le serveur refuse de démarrer en mode `enforce` sans les clés racines fournies par l’opérateur (`auth.missing-tenant-roots`). Un principal d’agent (`principal: "agent"`) ne peut pas enregistrer un principal humain (`principal: "human"`) ou accorder une `delegate`, et un `owner` ne peut pas faire pivoter la clé d’un principal humain. La rotation de clé (`POST /identity/agents/:id/key`) et la révocation (`POST /identity/agents/:id/revoke`) invalident immédiatement les anciennes `kid`.

### Pas encore, et limites actuelles

- **Magasin de relecture à instance unique.** Le magasin de relecture `(agentId, nonce)` est en mémoire sur un seul processus `@cognate/node` ; les déploiements multi-instances ne partagent pas l’état de relecture.
- **Les approbations détachées, le flux d’identité et la vérification hors ligne sont prévus pour une version ultérieure.** Aujourd’hui, toute action soumise à une approbation doit être signée directement par le principal autorisant. Les approbations détachées `cognate-approval-v1` (permettant à un agent de soumettre une transition contenant une signature humaine distincte), la consommation durable `approvalId`, le flux d’événements attesté `cognate-<tenant>-identity`, les champs d’événements `submittedBy` / `authorizedBy`, le vérificateur hors ligne autonome et l’ancrage de la clé racine RepoMesh ne sont pas inclus dans la version 1.0.0.
- **Les ID sont globaux pour tous les locataires.** L’enregistrement d’un ID qu’un autre locataire possède déjà est refusé en tant que doublon.

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

Cognate suppose le modèle de menace suivant :

1. **Point de terminaison d’inférence compromis.** Un attaquant obtient un accès à l’API du modèle. Mesures d’atténuation : toutes les requêtes et les réponses sont enregistrées avec des charges utiles chiffrées et des hachages d’intégrité SHA-256. La relecture est déterministe.
2. **Agent malveillant ou usurpation d’identité d’appelant.** Mesures d’atténuation : chaque opération d’écriture HTTP et chaque lecture de `/events/:eventId` sont authentifiées à l’aide d’une signature Ed25519 (`cognate-request-v1`), d’une vérification de l’horodatage (± 300 s) et d’un stockage de nonces pour une durée de 600 s afin d’empêcher la répétition des requêtes ; les capacités sont limitées dans le temps, dans leur portée et peuvent être révoquées (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), et chaque route lie les champs de son corps de requête à l’entité vérifiée qui signe (`403 auth.actor-mismatch`). Limite : le magasin de relecture est stocké en mémoire pour chaque processus, et les approbations multi-parties dissociées (`cognate-approval-v1`) et la vérification hors ligne des signatures du flux d’événements ne sont pas incluses dans la version 1.0.0.
3. **Altération du modèle de la chaîne d’approvisionnement.** Les poids ou les configurations sont modifiés après l’évaluation. Mesure d’atténuation : le registre des modèles calcule les hachages des poids, de la configuration et du manifeste lors de l’enregistrement, et `ModelVersion.repo` est stocké sous la forme de `sha256:<hex>`. Toute divergence invalide la version.
4. **Contournement de la politique par le biais de l’injection d’instructions.** Une instruction malveillante tente de contourner les règles de contenu. Solution : l’évaluation de la politique est déterministe, versionnée et s’effectue avant l’inférence. Aucune instruction n’est exécutée sans qu’une vérification de la politique ne soit effectuée avec succès.
5. **Utilisation abusive des journaux d’audit par un initié.** Un opérateur privilégié manipule les journaux. Solution : le magasin d’événements est en mode ajout uniquement et est protégé par les preuves d’arbres de Merkle d’Attestia. Toute manipulation rompt la chaîne de hachage.
6. **Accès inter-locataires sur le serveur HTTP.** Un agent d’un locataire accède aux données d’un autre locataire. Solution : chaque route opère dans le locataire du signataire authentifié. Un enregistrement qui nomme un autre locataire est refusé, et l’identifiant d’un autre locataire est renvoyé comme étant manquant.
7. **Une clé racine de locataire mal utilisée ou mal configurée.** La clé racine initialise un locataire et conserve les pouvoirs de récupération par la suite. Mesures d’atténuation : aucune clé racine n’est incluse dans le dépôt ou l’image, le serveur refuse de démarrer en mode `enforce` sans les clés racines fournies par l’opérateur, et il refuse les clés racines de test du dépôt lui-même. Limite : les pouvoirs de la clé racine sont étendus par conception (voir ci-dessus), de sorte que l’opérateur doit conserver la clé racine avec autant de soin que le locataire lui-même, et la récupération à partir d’une clé racine compromise implique de la remplacer dans la configuration révisée.

Pas de télémétrie ni d’analyse. Un déploiement sur le serveur HTTP demande RepoMesh si la version nommée est valide. L’état de santé et les autres routes restent dans ce processus. Les rapports de sécurité sont transmis via [SECURITY.md](SECURITY.md).

---

## État

Version 1.0.0, construction en mode public. Tous les packages sont implémentés, testés et en cours de construction. Installez le paquet avec `npm install @mcptoolshop/cognate`. Les noms `@cognate/*` restent dans ce dépôt.

| Porte d’entrée | État |
|------|--------|
| Construction | Réussi |
| Tests | 316 tests réussis (node 147, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Couverture | Lignes : 94,3 % dans node, 93,4 % dans policy, 99,6 % dans model-registry, et 100 % dans agent-identity, prompt-store et repomesh-bridge, avec des seuils de couverture vitest dans ces six packages |
| Vérification de type | Nettoyage |
| Docker | L’image sert l’API de gouvernance. Le volume contient le journal des événements et les trois instantanés |
| Vérification avant déploiement | Manuel, page d’accueil et métadonnées du dépôt dans cette version |

---

Construit par [mcp-tool-shop](https://mcp-tool-shop.github.io/)
