<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Governance strutturale per l'intelligenza artificiale autonoma.</strong></p>

**Versione 1.0.0.** La versione precedente era la 0.1.8. Le versioni 0.2.0 e 0.3.0 non sono mai state pubblicate separatamente e le loro modifiche sono incluse nella 1.0.0. La versione 1.0.0 modifica l'API HTTP: il server ora rifiuta le richieste non firmate. A partire dalla versione 1.0, le versioni seguono il versionamento semantico: una modifica che interrompe l'API HTTP, il formato delle richieste firmate o il formato degli eventi e delle attestazioni è accompagnata da una nuova versione principale. Consultare [Novità nella versione 1.0.0](#novità-nella-versione-100).

Cognate è il livello di governance dell'IA costruito su [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia dimostra che qualcosa è accaduto: un evento, una transazione, una transizione di stato, e lega tale prova a una catena. Cognate utilizza gli stessi elementi di attestazione per governare i sistemi di IA: cosa un modello era autorizzato a fare, cosa ha effettivamente fatto e chi lo ha autorizzato.

Cognate attesta la verità dell'IA: la genealogia del modello, le decisioni politiche, le capacità dell'agente e l'integrità dei prompt e degli output. Le stesse prove Merkle. Lo stesso archivio di eventi in sola aggiunta. Un dominio diverso.

Attestia, Cognate e RepoMesh sono tre prodotti. Attestia implementa il dominio finanziario (portafoglio personale, tesoreria dell'organizzazione, registro) basandosi su tali elementi. RepoMesh è la rete di rilascio: eventi firmati, manifesti dei nodi e un orologio di fiducia ancorato a XRPL, sul proprio registro RFC 6962. Non utilizza l'albero Merkle di Attestia. Cognate chiama Attestia quando ha bisogno di una prova e RepoMesh quando ha bisogno che un rilascio venga verificato. `@cognate/repomesh-bridge` è tale verifica.

---

## Novità nella versione 1.0.0

- **Record di esecuzione.** `@cognate/model-registry` preregistra un'esecuzione prima che venga avviata e registra il suo risultato nello stream `cognate-<tenant>-runs`. Gli identificatori di denominazione degli account vengono archiviati solo come hash SHA-256 e un'esecuzione registra i propri costi, mai il saldo di un account.
- **Valutazioni.** Una versione del modello contiene un numero qualsiasi di valutazioni (un'esecuzione, la sua replica, un risultato aggregato) e una transizione cita quelle su cui si basa. `requireEvaluationCitations` definisce quali transizioni devono essere citate. Una versione approvata può essere rifiutata prima della sua implementazione.
- **Definizione dell'ambito del tenant.** Ogni percorso in `@cognate/node` agisce nell'ambito del tenant chiamante. Un record che fa riferimento a un altro tenant viene rifiutato e l'ID di un altro tenant restituisce la stessa risposta di un ID mancante. Un ID mancante ora restituisce 404, non 400.
- **Richieste firmate (modifica).** Ogni operazione di scrittura e ogni operazione `GET /events/:eventId` deve essere firmata con la chiave Ed25519 del chiamante (`cognate-request-v1`), con una finestra temporale e una protezione contro la riproduzione. L'attore in ogni percorso è il firmatario verificato. La registrazione degli agenti e l'approvazione delle autorizzazioni richiedono una capacità `delegate` e una chiave radice del tenant fornita dall'operatore avvia il primo delegato di ciascun tenant. Consultare [Guida all'autenticazione e alla migrazione](#guida-allautenticazione-e-alla-migrazione).
- **I poteri della chiave radice, in parole semplici.** La documentazione elenca tutto ciò che la radice del tenant può ancora fare dopo l'avvio e afferma che una radice derivata da un seme di test non deve mai essere configurata in produzione.
- **Toolchain di test.** vitest 4.1.12 e vite 8.3.5; le avvertenze elevate e critiche nell'albero di sviluppo vengono eliminate alla radice, senza ignorare o sovrascrivere.

L'elenco completo è disponibile in [CHANGELOG.md](CHANGELOG.md).

---

## Missione

Crediamo che, man mano che i sistemi di IA acquisiscono autonomia, le strutture che li governano debbano acquisire maggiore rigore. Gli smart contract vengono eseguiti. I modelli fanno inferenze. Ma nessuno *attesta* cosa l'IA era autorizzata a fare, cosa ha effettivamente fatto e se un essere umano lo ha approvato.

Cognate è il livello mancante: registro dei modelli, applicazione delle politiche, identità dell'agente e audit deterministico, tutto unificato tra modelli, organizzazioni e catene.

### I nostri valori

- **La verità prima della velocità.** Ogni inferenza del modello è in sola aggiunta, riproducibile e riconciliabile. Se non può essere provata, non è accaduta.
- **Gli esseri umani approvano; le macchine verificano.** L'IA fornisce consigli, i modelli fanno inferenze, ma nulla viene implementato o agisce senza un'esplicita autorizzazione umana. Mai.
- **Governance strutturale, non governance politica.** Non votiamo su ciò che è valido. Definiamo invarianti che valgono incondizionatamente: l'identità del modello è esplicita, la genealogia è ininterrotta, la versione della politica è monotona.
- **L'intenzione non è l'esecuzione.** Dichiarare cosa un agente dovrebbe fare e lasciarlo agire sono atti separati con porte separate. Il divario tra di essi è dove risiede la fiducia.
- **I modelli sono testimoni, non autorità.** Attestia attesta. Le catene regolano. Ma l'autorità deriva da regole strutturali, non dai pesi di alcun modello.

---

## Architettura

Cognate utilizza gli elementi di Attestia e aggiunge un livello di dominio nativo dell'IA. I pacchetti sono funzioni pure. I chiamanti forniscono lo stato. Nulla qui apre una socket, scrive un file o legge un orologio a meno che non gli si fornisca il valore.

| Pacchetto | Scopo | Stato |
|---------|---------|--------|
| @cognate/types | Tipi di dominio di governance dell'IA condivisi (nessuna dipendenza) | Pronto |
| @cognate/policy | Motore di valutazione delle politiche semantiche | Pronto |
| @cognate/model-registry | Ciclo di vita del modello, versionamento, valutazione | Pronto |
| @cognate/agent-identity | Identità dell'agente, capacità, autorizzazioni | Pronto |
| @cognate/prompt-store | Registrazione di prompt/output con eventi crittografati | Pronto |
| @cognate/repomesh-bridge | Verifica del rilascio RepoMesh (`verifyRelease`) prima dell'implementazione | Pronto |
| @cognate/node | Server API HTTP sulla porta 4000, con richieste firmate e definizione dell'ambito del tenant | Pronto |

`@mcptoolshop/cognate` su npm include le librerie. `@cognate/node` viene eseguito nell'immagine Docker.

### Allineamento normativo

| Regolamento | Cognate soddisfa |
|------------|-------------------|
| Articolo 12 dell'AI Act dell'UE | Registrazione di eventi in sola aggiunta per tutta la durata del sistema |
| Articolo 14(5) dell'AI Act dell'UE | Identificazione delle persone fisiche nella verifica |
| NIST AI RMF | Funzioni Governare, Mappare, Misurare, Gestire |
| ISO/IEC 42001 | Requisiti del sistema di gestione dell'IA |

---

## Principi

| Principio | Implementazione |
|-----------|---------------|
| Record in sola aggiunta | Nessun UPDATE, nessun DELETE: solo nuove voci |
| Fail-closed | Il disaccordo sulle politiche interrompe il sistema, senza mai risolverlo in silenzio. |
| Riproduzione deterministica | Gli stessi eventi producono lo stesso stato, sempre. |
| Autorizzazioni di approvazione umana | Nessun modello viene distribuito, nessuna politica viene modificata, nessuna autorizzazione viene concessa senza un'approvazione esplicita. |
| Prompt crittografati | Chiave AES-256-GCM specifica per il tenant per la privacy; hash SHA-256 per l'integrità. |
| Identità strutturale | Esplicita, immutabile, univoca: per modelli, agenti e politiche. |

---

## Guida rapida

### Utilizzare le librerie da npm

```bash
npm install @mcptoolshop/cognate
```

Valutare una politica. Il motore non recupera lo stato né legge l'orologio. Si passa la politica e il contesto. Salvare questo come `quickstart.mjs` ed eseguire `node quickstart.mjs`; stampa `deny`.

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

Ogni libreria è un sottopercorso del pacchetto: `@mcptoolshop/cognate/policy`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` e `/types`. Gli esempi seguenti utilizzano i nomi degli spazi di lavoro (`@cognate/policy` e così via), che sono lo stesso codice.

### Eseguire il server HTTP da questo repository

`@cognate/node` non è disponibile su npm. Eseguirlo da una copia (Node 22 o successivo, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Quindi, da un altro terminale, `curl http://127.0.0.1:4000/health` risponde a `"status": "ok"`. `make-tenant-root.mjs` crea una nuova chiave radice casuale per il tenant: `tenant-roots.json` contiene la chiave pubblica che il server legge e `tenant-root.secret.json` contiene il seme privato con cui si firma il primo delegato del tenant. Entrambi i nomi sono in `.gitignore`. Mantenere `tenant-root.secret.json` al di fuori del repository e al di fuori di qualsiasi immagine: il server ha bisogno solo di `tenant-roots.json`. Lo script rende il file segreto leggibile solo dal suo proprietario, dove la piattaforma lo supporta (su Windows, mantenerlo in una cartella che solo tu puoi leggere). La forma completa è `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. Lo script si rifiuta di sostituire un `tenant-roots.json` o `tenant-root.secret.json` esistente: non scrive nulla ed esce con il codice `exists`. Passare `--force` solo per sostituire entrambi intenzionalmente, perché il vecchio seme privato non può essere recuperato. La firma delle richieste è trattata nella [guida alla migrazione](#guida-allautenticazione-e-alla-migrazione).

### Sviluppo

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Registrare una versione del modello, quindi eseguirla attraverso il ciclo di vita. Una versione si sposta `registered → evaluated → approved → deployed` e può essere `rejected` o `retired`. `transitionVersion` sposta uno snapshot che il chiamante possiede. Sul server HTTP, `approved → deployed` chiama `verifyRelease` su `repo` e `release` registrati quando la versione è stata registrata. Un rilascio che non supera il test non viene distribuito, e nemmeno una richiesta che fa riferimento a un rilascio diverso. Il rifiuto viene registrato.

Le valutazioni sono associate a una versione, quante ne hai: un'esecuzione, la sua replica, un risultato aggregato. **Registrare una valutazione, quindi effettuare la transizione citandola.** `recordEvaluation` (o `attestEvaluation`, che aggiunge anche `cognate.evaluation.recorded`) non sposta mai la versione stessa, quindi ogni chiamata è un'aggiunta. Il `evaluationIds` di una transizione indica le valutazioni su cui si basa la decisione. Ognuna deve essere registrata su quella versione e gli ID sono collegati all'hash della cronologia della transizione. Una versione approvata può comunque essere rifiutata prima della distribuzione. Se le transizioni devono citare è un'impostazione, `requireEvaluationCitations`: `false` (il valore predefinito), `"decisions"` (l'approvazione e il rifiuto devono citare) o `"all"`. Il server HTTP lo legge da `COGNATE_REQUIRE_EVALUATION_CITATIONS` e si rifiuta di avviarsi con qualsiasi altro valore.

Pre-register a run before it launches and record its outcome on the `cognate-<tenant>-runs` stream. Account-naming identifiers (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) are stored only as 64-character lowercase hex SHA-256 digests, and a run records its own `cost` (`unitsSpent`, `rate`, `basis`) rather than account balances.

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

L'immagine esegue `@cognate/node` e fornisce l'API di governance.

**Il server ha bisogno di un file delle radici del tenant prima di avviarsi.** Nella modalità `enforce` predefinita, si rifiuta di avviarsi senza, e nessuna chiave radice viene inclusa nell'immagine. Crearne una con `node scripts/make-tenant-root.mjs my-tenant` (vedere [Guida rapida](#eseguire-il-server-http-da-questo-repository)), oppure scrivere il proprio JSON nel formato `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. Il `docker-compose.yml` incluso imposta `COGNATE_TENANT_ROOTS_PATH` su `/run/cognate/tenant-roots.json` e mostra il mount come una riga di volume commentata. Decommentare quella riga con il percorso host del file o aggiungere un `docker-compose.override.yml` accanto:

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

Senza il file, il server stampa una riga di errore JSON nel formato di errore dell'API (`auth.missing-tenant-roots`, con un suggerimento) ed esce con 1. Impostare `COGNATE_DEBUG=1` per aggiungere lo stack.

Una volta in esecuzione, `/health` restituisce:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

Il volume `cognate-data` è montato in `/app/data`. Il registro degli eventi è `/app/data/events.jsonl`. Gli snapshot sono `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` e `/app/data/cognate/prompts.json`. `GET /events/:eventId` legge quel registro e restituisce l'evento registrato con una prova di inclusione di Attestia e la radice. Il chiamante invia le stesse intestazioni `cognate-request-v1` firmate come una scrittura. Un ID che non è nel registro di questo tenant è un errore e il corpo non ha alcuna prova. Il testo del prompt e dell'output non viene incluso nell'evento. Il percorso non chiama RepoMesh. La composizione di Attestia utilizza la stessa variabile del registro eventi sul proprio volume. Ogni file ha un solo scrittore. L'immagine RepoMesh non monta questo registro. `REPOMESH_FAIL_ON` ha come valore predefinito `unverified`: solo un PASS viene distribuito. Impostarlo su `fail` per consentire un rilascio NON VERIFICATO. L'immagine non imposta un URL del ledger. L'immagine viene creata dal flusso di lavoro di rilascio da un tag `v*`, dopo che il pacchetto npm viene pubblicato e inviato a `ghcr.io/mcp-tool-shop-org/cognate` come `X.Y.Z`, `X.Y` e `sha-*`. `latest` si sposta solo su un tag `v*`.

---

## Guida all'autenticazione e alla migrazione

### Cosa viene applicato nella versione 1.0.0

- **Ed25519 request signing (`cognate-request-v1`).** By default (`signedRequests: "enforce"`), every `POST` and `GET /events/:eventId` must carry `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, and `X-Signature` over the 8-line canonical request string (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). `POST` bodies must be RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical` otherwise). `kid` is the 64-character lowercase hex SHA-256 of the raw 32-byte Ed25519 public key.
- **Ordered replay protection and uniform 401.** `X-Timestamp` must be within ±300 s of server time (`GET /health` exposes `serverTime`). The in-memory replay store checks `(agentId, nonce)` read-only before signature verification, records it only after the signature verifies, and retains it across the full 600 s validity span. Every pre-signature authentication failure returns an identical `401` with `code: "auth.unauthenticated"`.
- **Actor binding (`403 auth.actor-mismatch`).** The actor on every route (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) is bound to the verified signer before RepoMesh or any event append.
- **Privilege escalation guards and root key bootstrap.** Agent registration (`POST /identity/agents`) and grant approval (`POST /identity/grants/:id/approve`) require an active `delegate` capability. Self-approval is refused (`403 auth.self-approval-forbidden`). Pre-populated `agent.capabilities` are refused except when the tenant's operator-supplied root public key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`) bootstraps the tenant's first `delegate`. Root mints or approves a `delegate` directly only at bootstrap, while the tenant has no active `delegate`; by design, the tenant root keeps its recovery powers after bootstrap (it rotates a human or agent principal's key, revokes any principal, and approves non-delegate grants, and recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents). Rotating a key hands that principal's authority to whoever holds the new key, and the root chooses the new key. So after the root rotates a human delegate's key, the root holds that delegate's authority, including minting new delegates (registering agents and approving `delegate` grants). And if the root revokes every active `delegate`, the tenant again has no active `delegate`, so the root can again mint one directly. A root derived from a test seed must never be configured in production. The server refuses the repository's own test root keys at startup (`auth.test-only-root-key-forbidden`) unless a test harness sets `allowTestOnlyRoots: true`, but it cannot recognise a root derived from any other seed known outside the deployment. No tenant root key ships in the repository or Docker image, and the server refuses to start in `enforce` mode without operator-supplied roots (`auth.missing-tenant-roots`). An agent principal (`principal: "agent"`) cannot register a human principal (`principal: "human"`) or grant `delegate`, and an `owner` cannot rotate a human principal's key. Key rotation (`POST /identity/agents/:id/key`) and revocation (`POST /identity/agents/:id/revoke`) immediately invalidate old `kid`s.

### Non ancora, e limiti attuali

- **Store di riproduzione a singola istanza.** Lo store di riproduzione (`(agentId, nonce)`) è in memoria su un singolo processo (`@cognate/node`); le distribuzioni multi-istanza non condividono lo stato di riproduzione.
- **Approvazioni separate, flusso di identità e verifica offline sono previsti per una versione successiva.** Oggi, qualsiasi azione soggetta a firma deve essere firmata direttamente dall'entità autorizzante. Le approvazioni separate (`cognate-approval-v1`) (che consentono a un agente di inviare una transizione contenente una firma umana separata), il consumo durevole (`approvalId`), il flusso di eventi attestato (`cognate-<tenant>-identity`), i campi degli eventi (`submittedBy` / `authorizedBy`), il verificatore offline autonomo e l'ancoraggio della chiave principale (RepoMesh) non sono presenti nella versione 1.0.0.
- **Gli ID sono globali tra i tenant.** La registrazione di un ID che un altro tenant possiede già viene rifiutata come duplicato.

### Migrazione degli agenti esistenti alle chiavi Ed25519

1. **Genera una coppia di chiavi Ed25519** utilizzando `generateEd25519KeyPair()` da `@cognate/node` (in questo repository; `@cognate/node` non è su npm):
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

const keyPair = generateEd25519KeyPair();
// keyPair.publicKey (chiave grezza di 32 byte di 43 caratteri base64url), keyPair.kid (esadecimale di 64 caratteri sha256), keyPair.seedHex
```
2. **Configura le chiavi pubbliche principali del tenant dell'operatore e avvia la prima entità delegata del tenant** fornendo un file di chiave principale JSON tramite `COGNATE_TENANT_ROOTS_PATH` (o `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`) e firmando `POST /identity/agents` con tale chiave principale del tenant mentre il tenant non ha alcuna `delegate` attiva (o inizializza l'agente con `publicKey` e `kid` in `agents.json` prima dell'avvio). Le chiavi di fissaggio solo per test sotto `packages/node/tests/fixtures/` vengono rifiutate all'avvio a meno che `allowTestOnlyRoots: true` non sia esplicitamente impostato.
3. **Firma le richieste con `createSignedClient` o `signHttpRequest`**:
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
`createSignedClient` canonizza i corpi JSON con RFC 8785 JCS, firma ogni richiesta e sincronizza automaticamente l'offset dell'orologio da `GET /health`'s `serverTime` e riprova una volta se un orologio distorto causa un `401`.
4. **Finestra di migrazione opzionale (`signedRequests: "log"`):** Per accettare temporaneamente le richieste non `/identity/*` non firmate durante la migrazione, imposta `COGNATE_SIGNED_REQUESTS=log` e `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>`. Gli eventi registrati dalle richieste non firmate in modalità `log` contengono `unsigned: true`.

---

## Modello delle minacce

Cognate presuppone il seguente modello delle minacce:

1. **Compromised inference endpoint.** An attacker gains access to the model API. Mitigation: all prompts and outputs are logged with encrypted payloads and SHA-256 integrity hashes. Replay is deterministic.
2. **Rogue agent or forged caller identity.** Mitigation: every HTTP write and `/events/:eventId` read is authenticated with an Ed25519 signature (`cognate-request-v1`), ±300 s timestamp check, and 600 s nonce replay store; capabilities are time-bound, scope-limited, and revocable (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), and every route binds its body actor fields to the verified signer (`403 auth.actor-mismatch`). Limit: the replay store is in-memory per process, and detached multi-party approvals (`cognate-approval-v1`) and offline event-stream signature verification are not in 1.0.0.
3. **Supply-chain model tampering.** Weights or configs are swapped post-evaluation. Mitigation: the model registry hashes weights, config, and manifest at registration, and `ModelVersion.repo` is stored as `sha256:<hex>`. Any deviation invalidates the version.
4. **Policy bypass via prompt injection.** An adversarial prompt attempts to circumvent content rules. Mitigation: policy evaluation is deterministic, versioned, and runs before inference. No prompt executes without a passing policy check.
5. **Insider abuse of audit logs.** A privileged operator tampers with logs. Mitigation: the event store is append-only and backed by Attestia's Merkle-tree proofs. Tampering breaks the chain hash.
6. **Cross-tenant access on the HTTP server.** An agent of one tenant reaches another tenant's records. Mitigation: every route acts in the authenticated signer's tenant. A record naming another tenant is refused, and another tenant's id is answered as missing.
7. **A misused or misconfigured tenant root key.** The root key bootstraps a tenant and keeps recovery powers afterwards. Mitigation: no root key ships in the repository or the image, the server refuses to start in `enforce` mode without operator-supplied roots, and it refuses the repository's own test root keys. Limit: the root's powers are wide by design (see above), so the operator must hold the root key as carefully as the tenant itself, and recovery from a compromised root means replacing it in the reviewed config.

Nessun telemetria o analisi. Un'implementazione sul server HTTP chiede RepoMesh se la versione specificata è valida. Lo stato di salute e gli altri percorsi rimangono in questo processo. I rapporti sulla sicurezza vengono inviati tramite [SECURITY.md](SECURITY.md).

---

## Stato

Versione 1.0.0, in fase di sviluppo pubblico. Tutti i pacchetti sono implementati, testati e in fase di compilazione. Installare il pacchetto con `npm install @mcptoolshop/cognate`. I nomi `@cognate/*` rimangono in questo repository.

| Gate | Stato |
|------|--------|
| Compilazione | Superato |
| Test | 316 superati (node 147, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Copertura | Righe: 94,3% in node, 93,4% in policy, 99,6% in model-registry e 100% in agent-identity, prompt-store e repomesh-bridge, con soglie di copertura vitest in questi sei pacchetti |
| Controllo del tipo | Pulizia |
| Docker | L'immagine fornisce l'API di governance. Il volume contiene il registro degli eventi e i tre snapshot |
| Controllo prima della distribuzione | Manuale, pagina di destinazione e metadati del repository in questa versione |

---

Creato da [mcp-tool-shop](https://mcp-tool-shop.github.io/)
