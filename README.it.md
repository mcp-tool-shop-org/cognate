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

**Versione 1.1.0.** La versione 1.1.0 aggiunge la selezione del piano prima che un agente agisca e fa sì che i tipi del pacchetto npm funzionino per gli utenti TypeScript. Non modifica nulla nell'API HTTP, nel formato delle richieste firmate o nel formato degli eventi e delle attestazioni, quindi un chiamante 1.0.0 continua a funzionare. Le versioni seguono la versione semantica: una modifica che interrompe uno di questi elementi è accompagnata da una nuova versione principale. Vedere [Cosa c'è di nuovo nella versione 1.1.0](#cosa-cè-di-nuovo-nella-versione-110).

Cognate è il livello di governance dell'IA costruito su [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia dimostra che qualcosa è accaduto: un evento, una transazione, una transizione di stato, e lega tale prova a una catena. Cognate utilizza gli stessi elementi di attestazione per governare i sistemi di IA: cosa era autorizzato a fare un modello, cosa ha effettivamente fatto e chi lo ha autorizzato.

Cognate attesta la verità dell'IA: la genealogia del modello, le decisioni politiche, le capacità dell'agente e l'integrità dei prompt e degli output. Le stesse prove Merkle. Lo stesso archivio di eventi in sola aggiunta. Un dominio diverso.

Attestia, Cognate e RepoMesh sono tre prodotti. Attestia implementa il dominio finanziario (portafoglio personale, tesoreria dell'organizzazione, registro) basandosi su tali elementi fondamentali. RepoMesh è la rete di rilascio: eventi firmati, manifesti dei nodi e un orologio di fiducia ancorato a XRPL, sul proprio registro RFC 6962. Non utilizza l'albero Merkle di Attestia. Cognate chiama Attestia quando ha bisogno di una prova e RepoMesh quando ha bisogno che un rilascio venga verificato. `@cognate/repomesh-bridge` è tale verifica.

---

## Cosa c'è di nuovo nella versione 1.1.0

- **Selezione del piano, prima che un agente agisca.** `@cognate/civility-kernel` (da npm, `@mcptoolshop/cognate/civility-kernel`) prende i piani candidati di un agente, elimina quelli che violano un vincolo rigido, valuta gli altri in base ai pesi di preferenza della politica e restituisce uno di tre esiti: `EXECUTE` (con il piano scelto), `ASK_USER` o `NO_VALID_PLAN`, con una traccia del motivo. È il primo dei [due passaggi](#due-fasi-scegli-un-piano-quindi-gestisci-ogni-evento): il kernel sceglie il piano e `@cognate/policy` continua a controllare ogni evento mentre il piano è in esecuzione.
- **Decisioni che possono essere registrate e provate.** `computeDecisionDigests` calcola l'hash di una decisione nella forma in cui si presenta la preregistrazione di un'esecuzione (`planSha256`, `decisionSha256`) e `attestDecision` aggiunge `cognate.policy.decided` al flusso di politiche del tenant, che `GET /events/:eventId` dimostra già. L'evento contiene l'esito e le regole che ogni piano rifiutato ha violato, mai i passaggi del piano. Con un `decisionId` e un `timestamp`, gli stessi input producono una traccia identica byte per byte.
- **Tre correzioni apportate al kernel durante il suo ingresso in Cognate.** La sua cache di compilazione si basa solo sulla versione della politica, quindi due politiche con una versione ma pesi diversi hanno ottenuto le stesse regole (la cache è stata eliminata). Ora è possibile riprodurre una decisione. E un piano fallito ottiene `null` anziché meno infinito, quindi una traccia sopravvive a un ciclo JSON.
- **Tipi che si risolvono da npm.** Le dichiarazioni di tipo del pacchetto 1.0.0 puntavano a pacchetti dell'area di lavoro che non sono su npm, quindi un progetto TypeScript ha ottenuto tipi non risolti su ogni sottopercorso. La versione 1.1.0 include tali dichiarazioni all'interno del pacchetto e CI installa il pacchetto in un progetto vuoto e verifica il tipo di un import da ogni voce.

L'elenco completo è disponibile in [CHANGELOG.md](CHANGELOG.md).

### Cosa è stato introdotto nella versione 1.0.0

- **Record di esecuzione.** `@cognate/model-registry` preregistra un'esecuzione prima di avviarla e registra il suo esito nel flusso `cognate-<tenant>-runs`. Gli identificatori di denominazione dell'account vengono archiviati solo come hash SHA-256 e un'esecuzione registra il proprio costo, mai il saldo di un account.
- **Valutazioni.** Una versione del modello contiene qualsiasi numero di valutazioni (un'esecuzione, la sua replica, un risultato aggregato) e una transizione cita quelle su cui si basa. `requireEvaluationCitations` definisce quali transizioni devono citare. Una versione approvata può essere rifiutata prima della sua implementazione.
- **Ambito del tenant.** Ogni percorso su `@cognate/node` agisce nell'ambito del tenant del chiamante. Un record che fa riferimento a un altro tenant viene rifiutato e l'ID di un altro tenant ottiene la stessa risposta di uno mancante. Un ID mancante ora è 404, non 400.
- **Richieste firmate (modifica).** Ogni scrittura e ogni `GET /events/:eventId` devono essere firmate con la chiave Ed25519 del chiamante (`cognate-request-v1`), con una finestra temporale e una protezione contro la riproduzione. L'attore su ogni percorso è il firmatario verificato. La registrazione degli agenti e l'approvazione delle autorizzazioni richiedono una capacità `delegate` e una chiave radice del tenant fornita dall'operatore avvia il primo delegato di ogni tenant. Vedere [Guida all'autenticazione e alla migrazione](#guida-allautenticazione-e-alla-migrazione).
- **I poteri della chiave radice, in parole semplici.** La documentazione elenca tutto ciò che la radice del tenant può ancora fare dopo l'avvio e afferma che una radice derivata da un seme di test non deve mai essere configurata in produzione.
- **Strumenti di test.** vitest 4.1.12 e vite 8.3.5; le avvertenze elevate e critiche nell'albero di sviluppo vengono eliminate alla radice, senza ignorare o sovrascrivere.

---

## Missione

Crediamo che, man mano che i sistemi di IA acquisiscono autonomia, le strutture che li governano debbano acquisire maggiore rigore. Gli smart contract vengono eseguiti. I modelli deducono. Ma nessuno *attesta* cosa era autorizzato a fare l'IA, cosa ha effettivamente fatto e se un essere umano lo ha approvato.

Cognate è il livello mancante: registro dei modelli, applicazione delle politiche, identità dell'agente e audit deterministico, tutto unificato tra modelli, organizzazioni e catene.

### I nostri valori

- **La verità prima della velocità.** Ogni inferenza del modello è in sola aggiunta, riproducibile e riconciliabile. Se non può essere provata, non è accaduta.
- **Gli esseri umani approvano; le macchine verificano.** L'IA consiglia, i modelli deducono, ma nulla viene implementato o agisce senza un'esplicita autorizzazione umana. Mai.
- **Governance strutturale, non governance politica.** Non votiamo su ciò che è valido. Definiamo invarianti che valgono in modo incondizionato: l'identità del modello è esplicita, la genealogia è ininterrotta, la versione della politica è monotona.
- **L'intenzione non è l'esecuzione.** Dichiarare cosa dovrebbe fare un agente e lasciarlo agire sono azioni separate con porte separate. Il divario tra loro è dove risiede la fiducia.
- **I modelli sono testimoni, non autorità.** Attestia attesta. Le catene regolano. Ma l'autorità deriva da regole strutturali, non dai pesi di alcun modello.

---

## Architettura

Cognate utilizza i componenti primitivi di Attestia e aggiunge un livello di dominio nativo per l'IA. Le librerie utilizzano lo stato che viene loro fornito. Alcune chiamate vanno oltre questo stato: `transitionVersion` e `feedbackFromMcpResult` registrano l’ora corrente, `decide` e `decideAsync` del kernel leggono l’orologio e generano un ID casuale, a meno che non vengano forniti sia `decisionId` che `timestamp`, e `verifyRelease` legge l’orologio e il registro RepoMesh, tramite la rete o da una directory locale. Nessun altro elemento apre una connessione di rete, scrive un file o legge l’orologio.

| Pacchetto | Scopo | Stato |
|---------|---------|--------|
| @cognate/types | Tipi di dominio condivisi per la governance dell'IA (nessuna dipendenza) | Pronto |
| @cognate/policy | Motore di valutazione delle politiche semantiche | Pronto |
| @cognate/civility-kernel | Selezione del piano: filtra i piani candidati in base a vincoli rigidi, li valuta in base ai pesi di preferenza, quindi li esegue o richiede un intervento. | Pronto (novità nella versione 1.1.0) |
| @cognate/model-registry | Ciclo di vita del modello, gestione delle versioni, valutazione | Pronto |
| @cognate/agent-identity | Identità dell'agente, capacità, autorizzazioni | Pronto |
| @cognate/prompt-store | Registrazione di prompt/output con eventi crittografati | Pronto |
| @cognate/repomesh-bridge | Controllo del rilascio RepoMesh (`verifyRelease`) prima del deployment | Pronto |
| @cognate/node | Server API HTTP sulla porta 4000, con richieste firmate e ambito per tenant | Pronto |

`@mcptoolshop/cognate` su npm include le librerie, con le relative dichiarazioni di tipo al suo interno. `@cognate/node` viene eseguito nell'immagine Docker.

### Due fasi: scegli un piano, quindi gestisci ogni evento

Cognate gestisce un agente in due punti.

1. **Prima di agire, `@cognate/civility-kernel` sceglie tra i piani.** L'agente propone piani candidati. I vincoli rigidi eliminano quelli che violano una regola (una modifica irreversibile, una spesa che supera un limite). I piani rimanenti vengono valutati in base ai pesi di preferenza della politica. Il piano con il punteggio più alto viene eseguito, a meno che la sua incertezza non superi la soglia definita dalla politica: in tal caso, l'agente richiede un intervento. Se nessun piano sopravvive, l'agente chiede alla persona di allentare un vincolo o di offrire un'altra opzione.
2. **Durante l'azione, `@cognate/policy` gestisce ogni evento.** Ogni prompt, output o spesa viene controllato rispetto alle regole del tenant (filtri sui contenuti, limiti di frequenza e di spesa, capacità) e, tra le regole che corrispondono, prevale la più restrittiva.

Una decisione può essere registrata e sottoposta a hashing. `attestDecision` aggiunge `cognate.policy.decided` allo stream di politiche del tenant, includendo i digest e la struttura della decisione, ma non i passaggi del piano. `computeDecisionDigests` fornisce il `planSha256` e il `decisionSha256` richiesti dalla pre-registrazione di un'esecuzione (`preRegisterRun`). Passa `decisionId` e `timestamp` e gli stessi input producono una traccia identica.

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

Le politiche vengono modificate tramite il ciclo interno del kernel, con un intervento umano che approva ogni passaggio: `proposePolicyUpdates` dal feedback, quindi `diffPolicy`, `lintPolicy` e `explainPolicy` prima che la modifica venga applicata.

### Allineamento normativo

| Regolamento | Cognate soddisfa |
|------------|-------------------|
| Articolo 12 dell'AI Act dell'UE | Registrazione di eventi in modalità append-only per tutta la durata del sistema |
| Articolo 14(5) dell'AI Act dell'UE | Identificazione di persone fisiche durante la verifica |
| NIST AI RMF | Funzioni di governance, mappatura, misurazione e gestione |
| ISO/IEC 42001 | Requisiti per il sistema di gestione dell'IA |

---

## Principi

| Principio | Implementazione |
|-----------|---------------|
| Record in modalità append-only | Nessun UPDATE, nessun DELETE: solo nuove voci |
| Fail-closed | La mancata corrispondenza delle politiche interrompe il sistema, senza mai risolvere il problema in modo silenzioso |
| Riproduzione deterministica | Gli stessi eventi producono sempre lo stesso stato |
| Interventi umani | Nessun deployment di modello, nessuna modifica delle politiche, nessuna concessione di capacità senza un'approvazione esplicita |
| Prompt crittografati | Chiave AES-256-GCM specifica per il tenant per la privacy; hash SHA-256 per l'integrità |
| Identità strutturale | Esplicita, immutabile, univoca: per modelli, agenti e politiche |

---

## Guida rapida

### Utilizza le librerie da npm

```bash
npm install @mcptoolshop/cognate
```

Valuta una politica. Il motore non recupera lo stato né legge l'ora. Fornisci la politica e il contesto. Salva questo come `quickstart.mjs` ed esegui `node quickstart.mjs`; stamperà `deny`.

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

Ogni libreria è un sottopercorso del bundle: `@mcptoolshop/cognate/policy`, `/civility-kernel`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` e `/types`. Gli esempi seguenti utilizzano i nomi degli spazi di lavoro (`@cognate/policy` e così via), che rappresentano lo stesso codice.

### Esegui il server HTTP da questo repository

`@cognate/node` non è su npm. Esegui il comando da una copia clonata (Node 22 o successivo, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Quindi, da un'altra finestra del terminale, `curl http://127.0.0.1:4000/health` risponde a `"status": "ok"`. `make-tenant-root.mjs` crea una nuova chiave radice casuale per il tenant: `tenant-roots.json` contiene la chiave pubblica che il server legge e `tenant-root.secret.json` contiene il seme privato con cui viene firmato il primo delegato del tenant. Entrambi i nomi sono in `.gitignore`. Mantieni `tenant-root.secret.json` al di fuori del repository e al di fuori di qualsiasi immagine: il server ha bisogno solo di `tenant-roots.json`. Lo script rende il file segreto leggibile solo dal suo proprietario, dove la piattaforma lo supporta (su Windows, conservalo in una cartella a cui solo tu puoi accedere). La forma completa è `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. Lo script si rifiuta di sostituire un `tenant-roots.json` o un `tenant-root.secret.json` esistente: non scrive nulla ed esce con il codice `exists`. Passa `--force` solo per sostituire entrambi intenzionalmente, perché il vecchio seme privato non può essere recuperato. La firma delle richieste è descritta nella [guida alla migrazione](#guida-allautenticazione-e-alla-migrazione).

### Sviluppo

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Registra una versione del modello, quindi esegui i passaggi del suo ciclo di vita. Una versione passa attraverso `registered → evaluated → approved → deployed` e può essere `rejected` o `retired`. `transitionVersion` gestisce uno snapshot che il chiamante conserva. Sul server HTTP, `approved → deployed` chiama `verifyRelease` sui `repo` e `release` registrati quando la versione è stata registrata. Un rilascio che non supera il test non viene distribuito, e nemmeno una richiesta che fa riferimento a un rilascio diverso. Il rifiuto viene registrato.

Le valutazioni sono associate a una versione, e possono essere tante quante ne hai: un'esecuzione, la sua replica, un risultato aggregato. **Registra una valutazione, quindi effettua una transizione citandola.** `recordEvaluation` (o `attestEvaluation`, che aggiunge anche `cognate.evaluation.recorded`) non modifica mai la versione stessa, quindi ogni chiamata è semplicemente un'aggiunta. L'`evaluationIds` di una transizione indica le valutazioni su cui si basa la decisione. Ognuna deve essere registrata per quella versione e gli ID sono collegati all'hash della cronologia della transizione. Una versione approvata può comunque essere rifiutata prima della sua implementazione. Se le transizioni devono citare o meno è un'impostazione, `requireEvaluationCitations`: `false` (impostazione predefinita), `"decisions"` (approvazione e rifiuto devono citare) o `"all"`. Il server HTTP legge questa impostazione da `COGNATE_REQUIRE_EVALUATION_CITATIONS` e si rifiuta di avviarsi con qualsiasi altro valore.

Pre-registra un'esecuzione prima che venga avviata e registra il suo risultato nello stream `cognate-<tenant>-runs`. Gli identificatori per la denominazione degli account (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) sono memorizzati solo come digest esadecimali in minuscolo di 64 caratteri SHA-256, e un'esecuzione registra il proprio `cost` (`unitsSpent`, `rate`, `basis`) invece dei saldi degli account.

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

**Il server necessita di un file di radici tenant prima di avviarsi.** Nella modalità `enforce` predefinita, si rifiuta di avviarsi senza, e nessuna chiave radice è inclusa nell'immagine. Creane una con `node scripts/make-tenant-root.mjs my-tenant` (vedi [Guida rapida](#esegui-il-server-http-da-questo-repository)), oppure scrivi il tuo JSON nel formato `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. Il `docker-compose.yml` incluso imposta `COGNATE_TENANT_ROOTS_PATH` su `/run/cognate/tenant-roots.json` e mostra il mount come una riga di volume commentata. Decommenta quella riga con il percorso host del tuo file, oppure aggiungi un `docker-compose.override.yml` accanto:

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

Senza il file, il server stampa una riga di errore JSON nel formato di errore dell'API (`auth.missing-tenant-roots`, con un suggerimento) ed esce con codice 1. Imposta `COGNATE_DEBUG=1` per aggiungere lo stack.

Una volta avviato, `/health` restituisce:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

Il volume `cognate-data` è montato in `/app/data`. Il registro degli eventi è `/app/data/events.jsonl`. Gli snapshot sono `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` e `/app/data/cognate/prompts.json`. `GET /events/:eventId` legge quel registro e restituisce l'evento registrato con una prova di inclusione Attestia e la radice. Il chiamante invia le stesse intestazioni firmate `cognate-request-v1` di una scrittura. Un ID che non è presente nel registro di questo tenant è un errore e il corpo non contiene alcuna prova. Il testo di richiesta e output non viene incluso nell'evento. Il percorso non chiama RepoMesh. Attestia compose utilizza la stessa variabile del registro eventi nel proprio volume. Ogni file ha un solo scrittore. L'immagine RepoMesh non monta questo registro. `REPOMESH_FAIL_ON` ha come valore predefinito `unverified`: solo un PASS viene implementato. Impostalo su `fail` per consentire un rilascio NON VERIFICATO. L'immagine non imposta un URL del ledger. L'immagine viene creata dal flusso di rilascio da un tag `v*`, dopo che il pacchetto npm è stato pubblicato, e caricata su `ghcr.io/mcp-tool-shop-org/cognate` come `X.Y.Z`, `X.Y` e `sha-*`. `latest` si sposta solo su un tag `v*`.

---

## Guida all'autenticazione e alla migrazione

### Cosa viene applicato nella versione 1.1.0 (invariato rispetto alla 1.0.0)

- **Firma della richiesta Ed25519 (`cognate-request-v1`).** Per impostazione predefinita (`signedRequests: "enforce"`), ogni richiesta `POST` e `GET /events/:eventId` deve contenere `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` e `X-Signature` nella stringa di richiesta canonica di 8 righe (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). I corpi `POST` devono essere RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical` altrimenti). `kid` è l'hash esadecimale in minuscolo di 64 caratteri SHA-256 della chiave pubblica a 32 byte non elaborata Ed25519.
- **Protezione contro la riproduzione ordinata e 401 uniforme.** `X-Timestamp` deve essere entro ±300 secondi rispetto all'ora del server (`GET /health` espone `serverTime`). Lo store di riproduzione in memoria controlla `(agentId, nonce)` in sola lettura prima della verifica della firma, lo registra solo dopo che la firma è stata verificata e lo conserva per l'intero intervallo di validità di 600 secondi. Ogni errore di autenticazione pre-firma restituisce un `401` identico con `code: "auth.unauthenticated"`.
- **Vincolo dell'attore (`403 auth.actor-mismatch`).** L'attore in ogni percorso (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` e `context.agentCapabilities`) è vincolato al firmatario verificato prima di RepoMesh o di qualsiasi aggiunta di evento.
- **Protezioni contro l'escalation dei privilegi e bootstrap della chiave radice.** La registrazione dell'agente (`POST /identity/agents`) e l'approvazione della concessione (`POST /identity/grants/:id/approve`) richiedono una capacità `delegate` attiva. L'auto-approvazione è rifiutata (`403 auth.self-approval-forbidden`). Le `agent.capabilities` pre-popolate sono rifiutate, tranne quando la chiave pubblica radice fornita dall'operatore del tenant (`tenantRootsPath` o `COGNATE_TENANT_ROOTS_PATH`) esegue il bootstrap della prima `delegate` del tenant. La radice crea o approva direttamente una `delegate` solo durante il bootstrap, mentre il tenant non ha alcuna `delegate` attiva; per progettazione, la radice del tenant mantiene i suoi poteri di ripristino dopo il bootstrap (ruota la chiave di un principale umano o agente, revoca qualsiasi principale e approva le concessioni non delegate e il ripristino da una radice compromessa significa sostituirla nella configurazione rivista e ri-firmare gli agenti delegati del tenant). La rotazione di una chiave trasferisce l'autorità di quel principale a chiunque detenga la nuova chiave e la radice sceglie la nuova chiave. Quindi, dopo che la radice ha ruotato la chiave di un delegato umano, la radice detiene l'autorità di quel delegato, inclusa la creazione di nuovi delegati (registrazione di agenti e approvazione delle concessioni `delegate`). E se la radice revoca tutte le `delegate` attive, il tenant non ha più alcuna `delegate` attiva, quindi la radice può nuovamente crearne una direttamente. Una radice derivata da un seme di test non deve mai essere configurata in produzione. Il server rifiuta le proprie chiavi radice di test del repository all'avvio (`auth.test-only-root-key-forbidden`) a meno che un harness di test non imposti `allowTestOnlyRoots: true`, ma non può riconoscere una radice derivata da qualsiasi altro seme noto al di fuori dell'implementazione. Nessuna chiave radice del tenant è inclusa nel repository o nell'immagine Docker e il server si rifiuta di avviarsi in modalità `enforce` senza radici fornite dall'operatore (`auth.missing-tenant-roots`). Un principale agente (`principal: "agent"`) non può registrare un principale umano (`principal: "human"`) o concedere `delegate`, e un `owner` non può ruotare la chiave di un principale umano. La rotazione della chiave (`POST /identity/agents/:id/key`) e la revoca (`POST /identity/agents/:id/revoke`) invalidano immediatamente le vecchie `kid`.

### Non ancora, e limiti attuali

- **Archiviazione di replay a singola istanza.** L'archiviazione di replay `(agentId, nonce)` è in memoria in un singolo processo `@cognate/node`; le implementazioni multi-istanza non condividono lo stato di replay.
- **Approvazioni separate, flusso di identità e verifica offline sono previsti per una versione successiva.** Oggi, qualsiasi azione soggetta ad approvazione deve essere firmata direttamente dal responsabile dell'autorizzazione. Le approvazioni separate `cognate-approval-v1` (che consentono a un agente di inviare una transizione contenente una firma umana separata), l'archiviazione persistente `approvalId`, il flusso di eventi attestato `cognate-<tenant>-identity`, i campi eventi `submittedBy` / `authorizedBy`, il verificatore offline autonomo e l'ancoraggio della chiave principale RepoMesh non sono presenti nella versione 1.1.0.
- **Gli ID sono globali tra i tenant.** La registrazione di un ID che un altro tenant possiede già viene rifiutata in quanto duplicato.

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

## Modello di minaccia

Cognate presuppone il seguente modello di minaccia:

1. **Endpoint di inferenza compromesso.** Un attaccante ottiene l'accesso all'API del modello. Mitigazione: tutti i prompt e gli output vengono registrati con payload crittografati e hash di integrità SHA-256. Il replay è deterministico.
2. **Agente non autorizzato o identità del chiamante contraffatta.** Mitigazione: ogni scrittura HTTP e lettura `/events/:eventId` è autenticata con una firma Ed25519 (`cognate-request-v1`), controllo del timestamp ±300 s e archivio di replay nonce di 600 s; le capacità sono limitate nel tempo, limitate nell'ambito e revocabili (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`) e ogni route associa i campi dell'attore del corpo alla firma verificata (`403 auth.actor-mismatch`). Limite: l'archivio di replay è in memoria per processo e le approvazioni multi-parte separate (`cognate-approval-v1`) e la verifica della firma del flusso di eventi offline non sono presenti nella versione 1.1.0.
3. **Manomissione del modello della catena di fornitura.** I pesi o le configurazioni vengono scambiati dopo la valutazione. Mitigazione: il registro del modello esegue l'hash dei pesi, della configurazione e del manifesto al momento della registrazione e `ModelVersion.repo` viene archiviato come `sha256:<hex>`. Qualsiasi deviazione invalida la versione.
4. **Aggiramento delle policy tramite l'iniezione di prompt.** Un prompt avversario tenta di aggirare le regole sui contenuti. Mitigazione: la valutazione delle policy è deterministica, con controllo delle versioni e viene eseguita prima dell'inferenza. Nessun prompt viene eseguito senza un controllo delle policy positivo.
5. **Abuso interno dei log di controllo.** Un operatore privilegiato manomette i log. Mitigazione: l'archivio di eventi è solo in append-only ed è supportato dalle prove ad albero di Merkle di Attestia. La manomissione interrompe la catena di hash.
6. **Accesso tra tenant sul server HTTP.** Un agente di un tenant accede ai record di un altro tenant. Mitigazione: ogni route agisce nel tenant del firmatario autenticato. Un record che fa riferimento a un altro tenant viene rifiutato e l'ID di un altro tenant viene restituito come mancante.
7. **Chiave principale del tenant utilizzata in modo improprio o configurata in modo errato.** La chiave principale inizializza un tenant e mantiene i poteri di ripristino in seguito. Mitigazione: nessuna chiave principale viene fornita nel repository o nell'immagine, il server rifiuta di avviarsi in modalità `enforce` senza chiavi principali fornite dall'operatore e rifiuta le chiavi principali di test del repository. Limite: i poteri della chiave principale sono ampi per progettazione (vedi sopra), quindi l'operatore deve conservare la chiave principale con la stessa cura del tenant stesso e il ripristino da una chiave principale compromessa significa sostituirla nella configurazione rivista.

Nessun telemetria o analisi. Un'implementazione sul server HTTP chiede a RepoMesh se la versione specificata supera i controlli. La salute e le altre route rimangono in questo processo. I rapporti sulla sicurezza vengono inviati tramite [SECURITY.md](SECURITY.md).

---

## Stato

Versione 1.1.0, in fase di sviluppo pubblico. Tutti i pacchetti sono implementati, testati e in fase di compilazione. Installa il pacchetto con `npm install @mcptoolshop/cognate`. I nomi `@cognate/*` rimangono in questo repository.

| Gate | Stato |
|------|--------|
| Build | Superato |
| Test | 490 superati (civility-kernel 164, node 157, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Copertura | Righe: 91,9% in civility-kernel, 94,3% in node, 93,4% in policy, 99,6% in model-registry e 100% in agent-identity, prompt-store e repomesh-bridge, con un limite minimo di righe vitest di 90 o superiore in ciascuno di questi sette pacchetti |
| Controllo del tipo | Pulito e il pacchetto compilato supera il controllo del tipo in un progetto vuoto con `bundler` e risoluzione `node16` |
| Docker | L'immagine serve l'API di governance. Il volume contiene il log degli eventi e i tre snapshot |
| Controllo finale | Tutti i controlli obbligatori sono superati (16/16 verificato) |

---

Creato da [mcp-tool-shop](https://mcp-tool-shop.github.io/)
