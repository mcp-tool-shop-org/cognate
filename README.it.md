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

Cognate è il livello di governance dell’IA, costruito su [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia dimostra che un determinato evento si è verificato (un evento, una transazione, una transizione di stato) e associa tale prova a una catena. Cognate utilizza gli stessi meccanismi di attestazione per governare i sistemi di IA: cosa un modello era autorizzato a fare, cosa ha effettivamente fatto e chi lo ha autorizzato.

Cognate fornisce la prova della veridicità dell’IA: origine del modello, decisioni relative alle politiche, capacità dell’agente e integrità dei prompt e degli output. Le stesse prove Merkle. Lo stesso archivio di eventi con aggiunte consentite. Dominio diverso.

Attestia, Cognate e RepoMesh sono tre prodotti. Attestia implementa il dominio finanziario (portafoglio personale, tesoreria aziendale, registro) basandosi su questi elementi fondamentali. RepoMesh è la rete di distribuzione: eventi firmati, manifesti dei nodi e un orologio di fiducia ancorato a XRPL, sul proprio registro RFC 6962. Non utilizza l’albero Merkle di Attestia. Cognate chiama Attestia quando ha bisogno di una prova e RepoMesh quando ha bisogno che venga verificata una distribuzione. `@cognate/repomesh-bridge` è tale verifica.

---

## Missione

Crediamo che, man mano che i sistemi di IA acquisiscono autonomia, le strutture che li governano debbano diventare più rigorose. Gli smart contract vengono eseguiti. I modelli fanno inferenze. Ma nessuno *attesta* cosa all'IA è stato permesso di fare, cosa ha effettivamente fatto e se un essere umano ha approvato.

Cognate è il livello mancante: registro dei modelli, applicazione delle politiche, identità dell'agente e audit deterministico, tutto unificato tra modelli, organizzazioni e catene.

### Ciò che ci guida

- **La verità prima della velocità.** Ogni inferenza del modello è di sola aggiunta, riproducibile e riconciliabile. Se non può essere provata, non è accaduta.
- **Gli esseri umani approvano; le macchine verificano.** L'IA fornisce consigli, i modelli fanno inferenze, ma nulla viene implementato o agisce senza un'esplicita autorizzazione umana. Mai.
- **Governance strutturale, non governance politica.** Non votiamo su ciò che è valido. Definiamo invarianti che valgono incondizionatamente: l'identità del modello è esplicita, la linea di discendenza è ininterrotta, la versione della politica è monotona.
- **L'intenzione non è l'esecuzione.** Dichiarare cosa dovrebbe fare un agente e lasciarlo agire sono azioni separate con porte separate. Il divario tra loro è dove risiede la fiducia.
- **I modelli sono testimoni, non autorità.** Attestia attesta. Le catene stabiliscono. Ma l'autorità deriva da regole strutturali, non dai pesi di alcun modello.

---

## Architettura

Cognate utilizza le primitive di Attestia e aggiunge un livello di dominio nativo dell'IA. I pacchetti sono funzioni pure. Chi chiama fornisce lo stato. Nulla qui apre una socket, scrive un file o legge un orologio a meno che non gli venga fornito il valore.

| Pacchetto | Scopo | Stato |
|---------|---------|--------|
| @cognate/types | Tipi di dominio di governance dell'IA condivisi (nessuna dipendenza) | Pronto |
| @cognate/policy | Motore di valutazione delle politiche semantiche | Pronto |
| @cognate/model-registry | Ciclo di vita, versionamento e valutazione del modello | Pronto |
| @cognate/agent-identity | Identità dell'agente, capacità, autorizzazioni | Pronto |
| @cognate/prompt-store | Registrazione di prompt/output con eventi crittografati | Pronto |

### Allineamento normativo

| Regolamento | Cognate soddisfa |
|------------|-------------------|
| Articolo 12 dell'AI Act dell'UE | Registrazione di eventi di sola aggiunta durante l'intero ciclo di vita del sistema |
| Articolo 14(5) dell'AI Act dell'UE | Identificazione delle persone fisiche nella verifica |
| NIST AI RMF | Funzioni di governance, mappatura, misurazione e gestione |
| ISO/IEC 42001 | Requisiti del sistema di gestione dell'IA |

---

## Principi

| Principio | Implementazione |
|-----------|---------------|
| Record di sola aggiunta | Nessun AGGIORNAMENTO, nessuna ELIMINAZIONE: solo nuove voci |
| Fail-closed | Il disaccordo sulle politiche interrompe il sistema, non si risolve silenziosamente |
| Riproduzione deterministica | Gli stessi eventi producono lo stesso stato, sempre |
| Porte di approvazione umana | Nessun modello viene implementato, nessuna politica viene modificata, nessuna capacità viene concessa senza un'esplicita approvazione |
| Prompt crittografati | AES-256-GCM con chiave del tenant per la privacy; hash SHA-256 per l'integrità |
| Identità strutturale | Esplicita, immutabile, univoca: per modelli, agenti e politiche |

---

## Avvio rapido

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Valuta una politica. Il motore non recupera lo stato. Si passa la politica e il contesto.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

Registra una versione del modello, quindi esegui il ciclo di vita. Una versione si sposta in `registered → evaluated → approved → deployed` e può essere `rejected` o `retired`. L'implementazione richiede comunque un'approvazione registrata sulla versione.

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

L'immagine pubblicata crea i cinque pacchetti e fornisce un endpoint di controllo dello stato. L'API HTTP di governance non è ancora presente in questa immagine. `/health` risponde in modo che il contenitore possa essere monitorato mentre quel servizio è ancora in fase di sviluppo.

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`/health` restituisce:

```json
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

Compose mantiene i dati di prompt e agente sul volume `cognate-data`, montato in `/app/data`. L'immagine viene pubblicata su GHCR quando viene pubblicata una versione di GitHub.

---

## Modello delle minacce

Cognate presuppone il seguente modello di minaccia:

1. **Endpoint di inferenza compromesso.** Un attaccante ottiene l'accesso all'API del modello. Mitigazione: tutti i prompt e gli output vengono registrati con payload crittografati e hash di integrità SHA-256. La riproduzione è deterministica.
2. **Agente canaglia con credenziali rubate.** Le chiavi di un agente vengono esfiltrate. Mitigazione: le capacità sono limitate nel tempo, limitate nell'ambito e revocabili. Ogni concessione richiede un'esplicita approvazione.
3. **Manomissione del modello nella catena di fornitura.** Pesi o configurazioni vengono modificati dopo la valutazione. Mitigazione: il registro dei modelli esegue l'hash dei pesi, della configurazione e del manifesto al momento della registrazione. Qualsiasi deviazione invalida la versione.
4. **Aggiramento delle politiche tramite l'iniezione di prompt.** Un prompt dannoso tenta di aggirare le regole sui contenuti. Mitigazione: la valutazione delle politiche è deterministica, con versioni e viene eseguita prima dell'inferenza. Nessun prompt viene eseguito senza un controllo delle politiche positivo.
5. **Abuso interno dei log di audit.** Un operatore privilegiato manomette i log. Mitigazione: l'archivio di eventi è di sola aggiunta ed è supportato dalle prove ad albero di Merkle di Attestia. La manomissione interrompe la catena di hash.

Per impostazione predefinita, non vengono effettuate telemetrie, analisi o chiamate di rete in uscita.

---

## Stato

Sviluppo in ambiente pubblico. Tutti i pacchetti principali sono stati implementati, testati e sono in fase di compilazione. Installa il pacchetto con `npm install @mcptoolshop/cognate`. I nomi dei `@cognate/*` rimangono in questo repository.

| Porta | Stato |
|------|--------|
| Costruzione | Superamento |
| Test | 72 superati |
| Copertura | Superiore al 90% per quanto riguarda le politiche |
| Controllo dei tipi | Pulito |
| Docker | Creazione delle immagini. L’endpoint di controllo dello stato è un segnaposto |
| Controllo prima della distribuzione | Manuale, pagina di destinazione e metadati del repository inclusi in questa versione |

---

Realizzato da [MCP Tool Shop](https://mcp-tool-shop.github.io/)
