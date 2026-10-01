<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>Governance strutturale per l’intelligenza artificiale autonoma.</strong></p>

Cognate è il livello di governance dell’IA, costruito su [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia dimostra che qualcosa è accaduto: un evento, una transazione, una transizione di stato, e lega tale prova a una catena. Cognate utilizza gli stessi elementi di attestazione per governare i sistemi di IA: cosa un modello era autorizzato a fare, cosa ha effettivamente fatto e chi lo ha autorizzato.

Un elemento correlato attesta la veridicità dell’IA: la genealogia del modello, le decisioni politiche, le capacità dell’agente e l’integrità dei prompt e degli output. Gli stessi proof di Merkle. Lo stesso archivio di eventi con aggiunte consentite. Dominio diverso.

Attestia implementa il dominio finanziario utilizzando questi elementi di base. RepoMesh è la rete di rilascio, con il proprio registro basato su RFC 6962. Questo pacchetto chiama Attestia per ottenere una prova e RepoMesh, tramite `@cognate/repomesh-bridge`, quando è necessario verificare un rilascio.

## Installazione

```bash
npm install @mcptoolshop/cognate
```

Nodo 22 o successivo. Le librerie sono contenute in questo unico pacchetto, inclusa la verifica dei rilasci di RepoMesh. I nomi interni `@cognate/*` non vengono pubblicati.

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| Importazione | Cos’è |
|--------|------------|
| `@mcptoolshop/cognate` | Spazi dei nomi: `types`, `policy`, `modelRegistry`, `agentIdentity`, `promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | Versioni del modello e il controllo di approvazione prima del deployment |
| `@mcptoolshop/cognate/agent-identity` | Concessione di capacità, approvazioni, revoche |
| `@mcptoolshop/cognate/prompt-store` | Registro di prompt e output crittografato in sola aggiunta |
| `@mcptoolshop/cognate/types` | I sostantivi condivisi |

Queste sono funzioni pure. Si passano l’orologio, la chiave del tenant e l’archivio. Questo pacchetto non apre una socket.

Manuale: <https://mcp-tool-shop-org.github.io/cognate/handbook/>
