<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>Governança estrutural para inteligência autônoma.</strong></p>

Cognate é a camada de governança de IA construída sobre o [Attestia](https://github.com/mcp-tool-shop-org/attestia). O Attestia comprova que algo aconteceu — um evento, uma transação, uma mudança de estado — e vincula essa prova a uma cadeia. O Cognate utiliza os mesmos princípios de atestação para governar sistemas de IA: o que um modelo tinha permissão para fazer, o que ele realmente fez e quem o autorizou.

Cognate comprova a veracidade da IA: linhagem do modelo, decisões de política, capacidades do agente e integridade do prompt e da saída. As mesmas provas de Merkle. O mesmo repositório de eventos com apenas anexação. Domínio diferente.

Attestia, Cognate e RepoMesh são três produtos. Attestia implementa o domínio financeiro (cofre pessoal, tesouraria da organização, registo) com base nesses elementos básicos. RepoMesh é a rede de lançamento: eventos assinados, manifestos de nó e um relógio de confiança ancorado no XRPL, em seu próprio livro-razão RFC 6962. Não utiliza a árvore de Merkle do Attestia. Cognate chama o Attestia quando precisa de uma prova e o RepoMesh quando precisa que um lançamento seja verificado. `@cognate/repomesh-bridge` é essa verificação.

---

## Missão

Acreditamos que, à medida que os sistemas de IA ganham autonomia, as estruturas que os governam devem ganhar rigor. Os contratos inteligentes são executados. Os modelos fazem inferências. Mas ninguém *atesta* o que a IA foi autorizada a fazer, o que ela realmente fez e se um humano aprovou.

Cognate é a camada que faltava: registro de modelos, aplicação de políticas, identidade de agentes e auditoria determinística — tudo unificado em modelos, organizações e cadeias.

### O que defendemos

- **Verdade acima da velocidade.** Cada inferência de modelo é apenas anexada, reproduzível e reconciliável. Se não puder ser comprovado, não aconteceu.
- **Humanos aprovam; máquinas verificam.** A IA aconselha, os modelos fazem inferências, mas nada é implementado ou age sem autorização humana explícita. Nunca.
- **Governança estrutural, não governança política.** Não votamos sobre o que é válido. Definimos invariantes que se mantêm incondicionalmente — a identidade do modelo é explícita, a linhagem é ininterrupta, a versão da política é monotônica.
- **A intenção não é a execução.** Declarar o que um agente deve fazer e permitir que ele aja são atos separados com portões separados. A lacuna entre eles é onde a confiança reside.
- **Os modelos são testemunhas, não autoridades.** O Attestia atesta. As cadeias validam. Mas a autoridade emana de regras estruturais, não dos pesos de nenhum modelo.

---

## Arquitetura

Cognate utiliza os primitivos do Attestia e adiciona uma camada de domínio nativa de IA. Os pacotes são funções puras. Os chamadores fornecem o estado. Nada aqui abre um socket, grava um arquivo ou lê um relógio, a menos que você forneça o valor.

| Pacote | Propósito | Status |
|---------|---------|--------|
| @cognate/types | Tipos de domínio de governança de IA compartilhados (zero dependências) | Pronto |
| @cognate/policy | Mecanismo de avaliação de políticas semânticas | Pronto |
| @cognate/model-registry | Ciclo de vida do modelo, versionamento, avaliação | Pronto |
| @cognate/agent-identity | Identidade do agente, capacidades, permissões | Pronto |
| @cognate/prompt-store | Registro de prompts/saídas com eventos criptografados | Pronto |

### Alinhamento regulatório

| Regulamentação | Cognate atende |
|------------|-------------------|
| Artigo 12 da Lei de IA da UE | Registro de eventos apenas anexado durante todo o ciclo de vida do sistema |
| Artigo 14(5) da Lei de IA da UE | Identificação de pessoas físicas na verificação |
| NIST AI RMF | Funções de governança, mapeamento, medição e gerenciamento |
| ISO/IEC 42001 | Requisitos do sistema de gerenciamento de IA |

---

## Princípios

| Princípio | Implementação |
|-----------|---------------|
| Registros apenas anexados | Sem ATUALIZAÇÃO, sem EXCLUSÃO — apenas novas entradas |
| Falha segura | A divergência de políticas interrompe o sistema, nunca se corrige silenciosamente |
| Reprodução determinística | Os mesmos eventos produzem o mesmo estado, sempre |
| Portões de aprovação humana | Nenhum modelo é implementado, nenhuma política é alterada, nenhuma capacidade é concedida sem aprovação explícita |
| Prompts criptografados | AES-256-GCM com chave do locatário para privacidade; hash SHA-256 para integridade |
| Identidade estrutural | Explícita, imutável, única — para modelos, agentes e políticas |

---

## Guia rápido

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Avalie uma política. O mecanismo não busca o estado. Você passa a política e o contexto.

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

Registe uma versão do modelo e, em seguida, execute-a ao longo do seu ciclo de vida. Uma versão é movida para `registered → evaluated → approved → deployed` e pode ser `rejected` ou `retired`. `transitionVersion` move um instantâneo que o chamador possui. No servidor HTTP, `approved → deployed` chama `verifyRelease` no `repo` e `release` registados quando a versão foi registada. Uma versão que não passa não é implementada, nem o é um pedido que nomeia uma versão diferente. A recusa é registada.

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

A imagem executa `@cognate/node` e disponibiliza a API de governação. `/health` retorna:

```json
{ "status": "ok", "service": "cognate", "mode": "api" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

O volume `cognate-data` está montado em `/app/data`. O registo de eventos é `/app/data/events.jsonl`. As capturas de ecrã são `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` e `/app/data/cognate/prompts.json`. `GET /events/:eventId` lê esse registo e devolve o evento registado com uma prova de inclusão da Attestia e a raiz. O chamador envia os mesmos cabeçalhos de agente que numa operação de escrita. Um ID que não está no registo deste inquilino é considerado um erro, e o corpo não contém prova. O texto do pedido e da resposta não são incluídos no evento. A rota não chama o RepoMesh. A composição da Attestia utiliza a mesma variável de registo de eventos no seu próprio volume. Cada ficheiro tem um único escritor. A imagem do RepoMesh não monta este registo. `REPOMESH_FAIL_ON` tem como valor predefinido `unverified`: apenas uma operação PASS é permitida. Defina-o para `fail` para permitir uma versão NÃO VERIFICADA. A imagem não define uma URL de livro-razão. A imagem é publicada no GHCR quando uma versão do GitHub é publicada.

---

## Modelo de ameaças

Cognate assume o seguinte modelo de ameaças:

1. **Endpoint de inferência comprometido.** Um invasor obtém acesso à API do modelo. Mitigação: todos os prompts e saídas são registrados com cargas úteis criptografadas e hashes de integridade SHA-256. A reprodução é determinística.
2. **Agente desonesto com credenciais roubadas.** As chaves de um agente são exfiltradas. Mitigação: as capacidades são limitadas no tempo, limitadas no escopo e revogáveis. Cada concessão requer aprovação explícita.
3. **Adulteração do modelo na cadeia de suprimentos.** Pesos ou configurações são trocados após a avaliação. Mitigação: o registro de modelos faz hash dos pesos, da configuração e do manifesto no registro. Qualquer desvio invalida a versão.
4. **Desvio da política por meio de injeção de prompt.** Um prompt adversário tenta contornar as regras de conteúdo. Mitigação: a avaliação da política é determinística, versionada e ocorre antes da inferência. Nenhum prompt é executado sem uma verificação de política aprovada.
5. **Abuso interno dos logs de auditoria.** Um operador privilegiado adultera os logs. Mitigação: o armazenamento de eventos é apenas anexado e apoiado pelas provas de árvore de Merkle do Attestia. A adulteração quebra o hash da cadeia.

Sem telemetria ou análise. Uma implementação no servidor HTTP pergunta ao RepoMesh se a versão nomeada passa. A saúde e as outras rotas permanecem neste processo.

---

## Status

Desenvolvimento em modo aberto. Todos os pacotes principais estão implementados, testados e em fase de construção. Instale o conjunto de pacotes com `npm install @mcptoolshop/cognate`. Os nomes dos `@cognate/*` permanecem neste repositório.

| Portão | Status |
|------|--------|
| Construção | Passando |
| Testes | 178 aprovados |
| Cobertura | Mais de 90% da política |
| Verificação de tipo | Limpo |
| Docker | A imagem disponibiliza a API de governação. O volume contém o registo de eventos e os três instantâneos. |
| Verificação de envio | Manual, página de destino e metadados do repositório nesta versão |

---

Criado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
