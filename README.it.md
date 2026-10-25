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

Pre-registra un’esecuzione (run) prima dell’avvio e registrane l’esito sul flusso `cognate-<tenant>-runs`. Gli identificatori per la denominazione degli account (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) vengono memorizzati solo come hash SHA-256 esadecimali in minuscolo di 64 caratteri e un’esecuzione registra il proprio `cost` (`unitsSpent`, `rate`, `basis`) anziché i saldi degli account.

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

- **Firma delle richieste Ed25519 (`cognate-request-v1`).** Per impostazione predefinita (`signedRequests: "enforce"`), ogni `POST` e `GET /events/:eventId` deve contenere `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` e `X-Signature` nella stringa di richiesta canonica di 8 righe (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). I corpi delle richieste (`POST`) devono essere in formato RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical`, altrimenti). `kid` è l’hash SHA-256 esadecimale in minuscolo di 64 caratteri della chiave pubblica Ed25519 di 32 byte.
- **Protezione contro la riproduzione non autorizzata e risposta uniforme 401.** `X-Timestamp` deve essere entro ±300 secondi rispetto all’ora del server (`GET /health` rivela `serverTime`). Il sistema di memorizzazione temporanea delle richieste effettua un controllo in sola lettura su `(agentId, nonce)` prima della verifica della firma, lo registra solo dopo che la firma è stata verificata e lo conserva per l’intero periodo di validità di 600 secondi. Ogni errore di autenticazione precedente alla firma restituisce un `401` identico con `code: "auth.unauthenticated"`.
- **Associazione dell’attore (`403 auth.actor-mismatch`).** L’attore presente in ogni percorso (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` e `context.agentCapabilities`) viene associato al firmatario verificato prima che RepoMesh o qualsiasi altro evento vengano aggiunti.
- **Misure di sicurezza per la gestione dei privilegi e avvio con chiave principale.** La registrazione dell’agente (`POST /identity/agents`) e l’approvazione della concessione (`POST /identity/grants/:id/approve`) richiedono una capacità attiva `delegate`. L’auto-approvazione viene rifiutata (`403 auth.self-approval-forbidden`). Le configurazioni predefinite `agent.capabilities` vengono rifiutate, ad eccezione dei casi in cui la chiave pubblica principale fornita dall’operatore del tenant (`tenantRootsPath` o `COGNATE_TENANT_ROOTS_PATH`) avvia la prima configurazione `delegate` del tenant. La chiave principale crea o approva direttamente una configurazione `delegate` solo durante l’avvio, mentre il tenant non dispone di una capacità attiva `delegate`; per progettazione, la chiave principale del tenant mantiene i suoi poteri di ripristino dopo l’avvio (modifica la chiave di un utente o agente, revoca qualsiasi utente e approva concessioni non delegate, e il ripristino da una chiave principale compromessa implica la sua sostituzione nella configurazione revisionata e la nuova firma degli agenti delegati del tenant). La modifica di una chiave trasferisce l’autorità di tale utente a chiunque possieda la nuova chiave, e la chiave principale sceglie la nuova chiave. Quindi, dopo che la chiave principale ha modificato la chiave di un utente delegato, la chiave principale detiene l’autorità di tale utente delegato, inclusa la creazione di nuovi utenti delegati (registrazione degli agenti e approvazione delle concessioni `delegate`). E se la chiave principale revoca tutti gli utenti attivi `delegate`, il tenant non dispone nuovamente di utenti attivi `delegate`, quindi la chiave principale può nuovamente crearne uno direttamente. Una chiave principale derivata da un seme di test non deve mai essere configurata in ambiente di produzione. Il server rifiuta le proprie chiavi principali di test del repository all’avvio (`auth.test-only-root-key-forbidden`), a meno che un ambiente di test non imposti `allowTestOnlyRoots: true`, ma non può riconoscere una chiave principale derivata da qualsiasi altro seme noto al di fuori dell’ambiente di distribuzione. Nessuna chiave principale del tenant è inclusa nel repository o nell’immagine Docker, e il server rifiuta di avviarsi in modalità `enforce` senza chiavi principali fornite dall’operatore (`auth.missing-tenant-roots`). Un utente agente (`principal: "agent"`) non può registrare un utente umano (`principal: "human"`) o concedere `delegate`, e un utente `owner` non può modificare la chiave di un utente umano. La modifica della chiave (`POST /identity/agents/:id/key`) e la revoca (`POST /identity/agents/:id/revoke`) invalidano immediatamente le vecchie configurazioni `kid`.

### Non ancora, e limiti attuali

- **Store di riproduzione a singola istanza.** Lo store di riproduzione (`(agentId, nonce)`) è in memoria su un singolo processo (`@cognate/node`); le distribuzioni multi-istanza non condividono lo stato di riproduzione.
- **Approvazioni separate, flusso di identità e verifica offline sono previsti per una versione successiva.** Oggi, qualsiasi azione soggetta a firma deve essere firmata direttamente dall'entità autorizzante. Le approvazioni separate (`cognate-approval-v1`) (che consentono a un agente di inviare una transizione contenente una firma umana separata), il consumo durevole (`approvalId`), il flusso di eventi attestato (`cognate-<tenant>-identity`), i campi degli eventi (`submittedBy` / `authorizedBy`), il verificatore offline autonomo e l'ancoraggio della chiave root (RepoMesh) non sono presenti nella versione 1.0.0.
- **Gli ID sono globali tra i tenant.** La registrazione di un ID che un altro tenant possiede già viene rifiutata come duplicato.

### Migrazione degli agenti esistenti alle chiavi Ed25519

1. **Genera una coppia di chiavi Ed25519** utilizzando `generateEd25519KeyPair()` da `@cognate/node` (in questo repository; `@cognate/node` non è su npm):
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

const keyPair = generateEd25519KeyPair();
// keyPair.publicKey (chiave grezza di 32 byte di 43 caratteri base64url), keyPair.kid (esadecimale di 64 caratteri sha256), keyPair.seedHex
```
2. **Configura le chiavi pubbliche root del tenant dell'operatore e avvia la prima entità delegata del tenant** fornendo un file di chiave root JSON tramite `COGNATE_TENANT_ROOTS_PATH` (o `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`) e firmando `POST /identity/agents` con tale chiave root del tenant mentre il tenant non ha alcuna `delegate` attiva (o inizializza l'agente con `publicKey` e `kid` in `agents.json` prima dell'avvio). Le chiavi fixture solo per test sotto `packages/node/tests/fixtures/` vengono rifiutate all'avvio a meno che `allowTestOnlyRoots: true` non sia esplicitamente impostato.
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

1. **Endpoint di inferenza compromesso.** Un attaccante ottiene l’accesso all’API del modello. Soluzione: tutte le richieste e le risposte vengono registrate con payload crittografati e hash di integrità SHA-256. La ripetizione delle richieste produce risultati deterministici.
2. **Agente non autorizzato o identificativo del chiamante contraffatto.** Misure di mitigazione: ogni operazione di scrittura HTTP e ogni lettura dell’endpoint `/events/:eventId` è autenticata tramite una firma Ed25519 (`cognate-request-v1`), con una verifica del timestamp (±300 secondi) e un archivio di nonce con una durata di 600 secondi per prevenire attacchi di tipo replay; le funzionalità hanno una validità temporale limitata, un ambito di applicazione ristretto e possono essere revocate (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), e ogni endpoint associa i campi relativi all’attore presenti nel corpo della richiesta al firmatario verificato (`403 auth.actor-mismatch`). Limite: l’archivio dei replay è memorizzato in memoria per ogni processo e le approvazioni multi-parte separate (`cognate-approval-v1`) e la verifica offline delle firme del flusso di eventi non sono incluse nella versione 1.0.0.
3. **Manomissione del modello della catena di approvvigionamento.** I pesi o le configurazioni vengono modificati dopo la valutazione. Mitigazione: il registro dei modelli calcola l’hash dei pesi, della configurazione e del file manifest al momento della registrazione e `ModelVersion.repo` viene memorizzato come `sha256:<hex>`. Qualsiasi deviazione invalida la versione.
4. **Aggiramento delle policy tramite iniezione di prompt.** Un prompt malevolo tenta di eludere le regole sui contenuti. Soluzione: la valutazione delle policy è deterministica, basata su versioni e viene eseguita prima dell’inferenza. Nessun prompt viene eseguito senza aver superato il controllo delle policy.
5. **Abuso interno dei registri di controllo.** Un operatore con privilegi modifica i registri. Mitigazione: il registro degli eventi è di sola aggiunta e supportato dalle prove ad albero di Merkle di Attestia. Qualsiasi modifica interrompe la catena di hash.
6. **Accesso tra diversi tenant sul server HTTP.** Un agente di un tenant accede ai dati di un altro tenant. Soluzione: ogni percorso opera all’interno del tenant dell’utente autenticato che ha firmato la richiesta. Viene rifiutata qualsiasi richiesta di dati che faccia riferimento a un altro tenant e viene indicato che l’ID di tale tenant non è disponibile.
7. **Una chiave principale dell’ambiente utilizzata in modo improprio o configurata in modo errato.** La chiave principale avvia l’ambiente e ne mantiene le funzionalità di ripristino. Soluzione: nessuna chiave principale viene inclusa nel repository o nell’immagine; il server si rifiuta di avviarsi in modalità `enforce` senza le chiavi principali fornite dall’operatore e rifiuta le chiavi principali di test del repository stesso. Limitazione: le funzionalità della chiave principale sono ampie per progettazione (vedere sopra), quindi l’operatore deve custodire la chiave principale con la stessa cura con cui custodisce l’ambiente stesso e il ripristino da una chiave principale compromessa implica la sua sostituzione nella configurazione rivista.

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
