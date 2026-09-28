<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>Governança estrutural para inteligência autónoma.</strong></p>

Cognate é a camada de governança de IA construída sobre o [Attestia](https://github.com/mcp-tool-shop-org/attestia). O Attestia comprova que algo aconteceu — um evento, uma transação, uma transição de estado — e associa essa prova a uma cadeia. O Cognate utiliza os mesmos elementos básicos de atestação para governar sistemas de IA: o que um modelo tinha permissão para fazer, o que ele realmente fez e quem o autorizou.

Enquanto o Attestia atesta a veracidade financeira, o Cognate atesta a veracidade da IA — linhagem do modelo, decisões de política, capacidades do agente e integridade do prompt/saída. As mesmas árvores de Merkle. O mesmo repositório de eventos de apenas adição. Domínio diferente.

## Instalação

```bash
npm install @mcptoolshop/cognate
```

Node 22 ou versão mais recente. As cinco bibliotecas estão neste único pacote. Os nomes internos `@cognate/*` não são publicados.

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| Importação | O que é |
|--------|------------|
| `@mcptoolshop/cognate` | Espaços de nomes: `types`, `policy`, `modelRegistry`, `agentIdentity`, `promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | Versões do modelo e o mecanismo de aprovação antes da implementação |
| `@mcptoolshop/cognate/agent-identity` | Concessão de capacidades, aprovações, revogações |
| `@mcptoolshop/cognate/prompt-store` | Registo criptografado de apenas adição de prompts e saídas |
| `@mcptoolshop/cognate/types` | Os substantivos partilhados |

Estas são funções puras. Você passa o relógio, a chave do inquilino e o repositório. Este pacote não abre um socket.

Manual: <https://mcp-tool-shop-org.github.io/cognate/handbook/>
