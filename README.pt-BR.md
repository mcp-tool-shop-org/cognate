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

**Versão 1.1.0.** A versão 1.1.0 adiciona a seleção de plano antes que um agente aja e faz com que os tipos do pacote npm funcionem para usuários TypeScript. Não altera nada na API HTTP, no formato de solicitação assinada ou no formato de evento e atestado, portanto, um chamador da versão 1.0.0 continua funcionando. As versões seguem o versionamento semântico: uma alteração que quebre qualquer um desses elementos vem com uma nova versão principal. Consulte [O que há de novo na versão 1.1.0](#o-que-há-de-novo-na-versão-110).

Cognate é a camada de governança de IA construída sobre [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prova que algo aconteceu — um evento, uma transação, uma transição de estado — e vincula essa prova a uma cadeia. Cognate usa os mesmos primitivos de atestado para governar os sistemas de IA: o que um modelo tinha permissão para fazer, o que ele realmente fez e quem o autorizou.

Cognate atesta a verdade da IA: linhagem do modelo, decisões de política, capacidades do agente e integridade do prompt e da saída. As mesmas provas de Merkle. O mesmo armazenamento de eventos somente de adição. Domínio diferente.

Attestia, Cognate e RepoMesh são três produtos. Attestia implementa o domínio financeiro (cofre pessoal, tesouraria da organização, registrum) com base nesses primitivos. RepoMesh é a rede de lançamento: eventos assinados, manifestos de nó e um relógio de confiança ancorado no XRPL, em seu próprio livro-razão RFC 6962. Não usa a árvore de Merkle do Attestia. Cognate chama o Attestia quando precisa de uma prova e RepoMesh quando precisa que um lançamento seja verificado. `@cognate/repomesh-bridge` é essa verificação.

---

## O que há de novo na versão 1.1.0

- **Seleção de plano, antes que um agente aja.** `@cognate/civility-kernel` (do npm, `@mcptoolshop/cognate/civility-kernel`) recebe os planos candidatos de um agente, descarta quaisquer que violem uma restrição rígida, avalia o restante com base nos pesos de preferência da política e retorna um de três resultados: `EXECUTE` (com o plano escolhido), `ASK_USER` ou `NO_VALID_PLAN`, com um rastreamento do motivo. É o primeiro de [dois estágios](#duas-etapas-escolher-um-plano-e-em-seguida-controlar-cada-evento): o kernel escolhe o plano e `@cognate/policy` ainda controla cada evento enquanto o plano é executado.
- **Decisões que podem ser registradas e comprovadas.** `computeDecisionDigests` calcula o hash de uma decisão no formato de um pré-registro de execução (`planSha256`, `decisionSha256`), e `attestDecision` anexa `cognate.policy.decided` ao fluxo de política do locatário, que `GET /events/:eventId` já comprova. O evento contém o resultado e as regras que cada plano rejeitado violou, nunca os passos do plano. Com um `decisionId` e um `timestamp`, as mesmas entradas fornecem um rastreamento idêntico byte a byte.
- **Três correções feitas no kernel ao incorporá-lo ao Cognate.** Seu cache de compilação é baseado apenas na versão da política, portanto, duas políticas com uma versão, mas pesos diferentes, obtiveram as mesmas regras (o cache foi removido). Agora, uma decisão pode ser reproduzida. E um plano com falha obtém `null` em vez de menos infinito, para que um rastreamento sobreviva a uma passagem JSON.
- **Tipos que são resolvidos do npm.** As declarações de tipo do pacote 1.0.0 apontavam para pacotes de espaço de trabalho que não estão no npm, portanto, um projeto TypeScript obteve tipos não resolvidos em cada subcaminho. A versão 1.1.0 envia essas declarações dentro do pacote e o CI instala o pacote em um projeto vazio e verifica os tipos de uma importação de cada entrada.

A lista completa está em [CHANGELOG.md](CHANGELOG.md).

### O que foi incluído na versão 1.0.0

- **Registros de execução.** `@cognate/model-registry` pré-registra uma execução antes de iniciá-la e registra seu resultado no fluxo `cognate-<tenant>-runs`. Os identificadores de nomenclatura de conta são armazenados apenas como resumos SHA-256, e uma execução registra seu próprio custo, nunca o saldo de uma conta.
- **Avaliações.** Uma versão do modelo contém qualquer número de avaliações (uma execução, sua replicação, um resultado agrupado), e uma transição cita as avaliações em que se baseia. `requireEvaluationCitations` define quais transições devem citar. Uma versão aprovada pode ser rejeitada antes de ser implantada.
- **Escopo do locatário.** Cada rota em `@cognate/node` atua no escopo do locatário do chamador. Um registro que nomeia outro locatário é recusado, e o ID de outro locatário obtém a mesma resposta que um ID ausente. Um ID ausente agora é 404, não 400.
- **Solicitações assinadas (quebra a compatibilidade).** Cada gravação e cada `GET /events/:eventId` devem ser assinadas com a chave Ed25519 do chamador (`cognate-request-v1`), com uma janela de tempo e proteção contra repetição. O ator em cada rota é o assinante verificado. O registro de agentes e a aprovação de concessões exigem uma capacidade `delegate`, e uma chave raiz de locatário fornecida pelo operador inicializa o primeiro delegado de cada locatário. Consulte [Guia de autenticação e migração](#guia-de-autenticação-e-migração).
- **Os poderes da chave raiz, em palavras simples.** A documentação lista tudo o que a raiz do locatário ainda pode fazer após a inicialização e diz que uma raiz derivada de uma semente de teste nunca deve ser configurada em produção.
- **Conjunto de ferramentas de teste.** vitest 4.1.12 e vite 8.3.5; os avisos de alto e crítico na árvore de desenvolvimento são removidos na raiz, sem ignorar ou substituir.

---

## Missão

Acreditamos que, à medida que os sistemas de IA ganham autonomia, as estruturas que os governam devem ganhar rigor. Os contratos inteligentes são executados. Os modelos inferem. Mas ninguém *atesta* o que a IA tinha permissão para fazer, o que ela realmente fez e se um humano aprovou.

Cognate é a camada ausente: registro de modelo, aplicação de política, identidade de agente e auditoria determinística — unificados em modelos, organizações e cadeias.

### O que defendemos

- **Verdade acima da velocidade.** Cada inferência de modelo é somente de adição, reproduzível e reconciliável. Se não puder ser comprovada, não aconteceu.
- **Humanos aprovam; máquinas verificam.** A IA aconselha, os modelos inferem, mas nada é implantado ou age sem autorização humana explícita. Sempre.
- **Governança estrutural, não governança política.** Não votamos sobre o que é válido. Definimos invariantes que se mantêm incondicionalmente — a identidade do modelo é explícita, a linhagem é ininterrupta, a versão da política é monotônica.
- **A intenção não é a execução.** Declarar o que um agente deve fazer e permitir que ele aja são atos separados com portões separados. A lacuna entre eles é onde a confiança reside.
- **Os modelos são testemunhas, não autoridades.** Attestia atesta. As cadeias resolvem. Mas a autoridade flui de regras estruturais, não dos pesos de nenhum modelo.

---

## Arquitetura

Cognate consome os elementos básicos de Attestia e adiciona uma camada de domínio nativa de IA. Os pacotes são funções puras. Os chamadores fornecem o estado. Nada aqui abre um socket, grava um arquivo ou lê um relógio, a menos que você forneça o valor.

| Pacote | Objetivo | Status |
|---------|---------|--------|
| @cognate/types | Tipos de domínio de governança de IA compartilhados (sem dependências) | Pronto |
| @cognate/policy | Mecanismo de avaliação de políticas semânticas | Pronto |
| @cognate/civility-kernel | Seleção de plano: filtrar planos candidatos por restrições rígidas, classificá-los por pesos de preferência e, em seguida, executar ou solicitar | Pronto (novo na versão 1.1.0) |
| @cognate/model-registry | Ciclo de vida do modelo, versionamento, avaliação | Pronto |
| @cognate/agent-identity | Identidade do agente, capacidades, permissões | Pronto |
| @cognate/prompt-store | Registro de prompts/saídas com eventos criptografados | Pronto |
| @cognate/repomesh-bridge | Verificação de lançamento RepoMesh (`verifyRelease`) antes de uma implantação | Pronto |
| @cognate/node | Servidor de API HTTP na porta 4000, com solicitações assinadas e escopo de locatário | Pronto |

`@mcptoolshop/cognate` no npm agrupa as bibliotecas, com suas declarações de tipo dentro dela. `@cognate/node` é executado na imagem Docker.

### Duas etapas: escolher um plano e, em seguida, controlar cada evento

Cognate governa um agente em dois pontos.

1. **Antes de agir, `@cognate/civility-kernel` escolhe entre os planos.** O agente propõe planos candidatos. Restrições rígidas removem aqueles que violam uma regra (uma mudança irreversível, um gasto acima de um limite). Os sobreviventes são classificados pelos pesos de preferência da política. O melhor plano é executado, a menos que sua incerteza esteja acima do limite da política: então o agente solicita. Se nenhum plano sobreviver, o agente pede à pessoa para relaxar uma restrição ou oferecer outra opção.
2. **Enquanto age, `@cognate/policy` controla cada evento.** Cada prompt, saída ou gasto é verificado em relação às regras do locatário (filtros de conteúdo, limites de taxa e gasto, capacidades), e, entre as regras que correspondem, prevalece a mais restritiva.

Uma decisão pode ser registrada e transformada em hash. `attestDecision` anexa `cognate.policy.decided` ao fluxo de políticas do locatário, carregando resumos e o esboço da decisão, nunca os passos do plano. `computeDecisionDigests` fornece o `planSha256` e o `decisionSha256` que um pré-registro de execução (`preRegisterRun`) solicita. Passe `decisionId` e `timestamp` e as mesmas entradas fornecem um rastreamento idêntico em bytes.

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

As políticas são alteradas por meio do próprio loop do kernel, com um humano aprovando cada etapa: `proposePolicyUpdates` a partir do feedback, depois `diffPolicy`, `lintPolicy` e `explainPolicy` antes que a alteração seja aplicada.

### Alinhamento regulatório

| Regulamentação | Cognate satisfaz |
|------------|-------------------|
| Artigo 12 da Lei de IA da UE | Registro de eventos somente em anexo durante todo o ciclo de vida do sistema |
| Artigo 14(5) da Lei de IA da UE | Identificação de pessoas físicas na verificação |
| NIST AI RMF | Funções de governança, mapeamento, medição e gerenciamento |
| ISO/IEC 42001 | Requisitos do sistema de gerenciamento de IA |

---

## Princípios

| Princípio | Implementação |
|-----------|---------------|
| Registros somente em anexo | Sem ATUALIZAÇÃO, sem EXCLUSÃO — apenas novas entradas |
| Falha segura | Discordância de política interrompe o sistema, nunca se corrige silenciosamente |
| Reprodução determinística | Os mesmos eventos produzem o mesmo estado, sempre |
| Controles de aprovação humana | Nenhuma implantação de modelo, nenhuma alteração de política, nenhuma concessão de capacidade sem aprovação explícita |
| Prompts criptografados | Chave de locatário AES-256-GCM para privacidade; hash SHA-256 para integridade |
| Identidade estrutural | Explícita, imutável, única — para modelos, agentes e políticas |

---

## Guia rápido

### Use as bibliotecas do npm

```bash
npm install @mcptoolshop/cognate
```

Avalie uma política. O mecanismo não busca o estado nem lê o relógio. Você passa a política e o contexto. Salve isso como `quickstart.mjs` e execute `node quickstart.mjs`; ele imprime `deny`.

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

Cada biblioteca é um subcaminho do pacote: `@mcptoolshop/cognate/policy`, `/civility-kernel`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` e `/types`. Os exemplos abaixo usam os nomes dos espaços de trabalho (`@cognate/policy` e assim por diante), que são o mesmo código.

### Execute o servidor HTTP deste repositório

`@cognate/node` não está no npm. Execute-o a partir de um clone (Node 22 ou mais recente, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Em seguida, de outro terminal, `curl http://127.0.0.1:4000/health` responde a `"status": "ok"`. `make-tenant-root.mjs` cria uma nova chave raiz aleatória para o locatário: `tenant-roots.json` contém a chave pública que o servidor lê, e `tenant-root.secret.json` contém a semente privada com a qual você assina o primeiro delegado do locatário. Ambos os nomes estão em `.gitignore`. Mantenha `tenant-root.secret.json` fora do repositório e fora de qualquer imagem: o servidor precisa apenas de `tenant-roots.json`. O script torna o arquivo secreto legível apenas pelo seu proprietário, onde a plataforma suporta isso (no Windows, mantenha-o em uma pasta que apenas você possa ler). A forma completa é `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. O script se recusa a substituir um `tenant-roots.json` ou `tenant-root.secret.json` existente: ele não grava nada e sai com o código `exists`. Passe `--force` apenas para substituir ambos intencionalmente, porque a semente privada antiga não pode ser recuperada. A assinatura de solicitações é abordada no [guia de migração](#guia-de-autenticação-e-migração).

### Desenvolvimento

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Registre uma versão do modelo e, em seguida, execute-a durante o ciclo de vida. Uma versão se move `registered → evaluated → approved → deployed` e pode ser `rejected` ou `retired`. `transitionVersion` move um instantâneo que o chamador mantém. No servidor HTTP, `approved → deployed` chama `verifyRelease` no `repo` e `release` registrados quando a versão foi registrada. Um lançamento que não passa não é implantado, nem uma solicitação que nomeia um lançamento diferente. A recusa é registrada.

As avaliações são associadas a uma versão, tantas quantas existam: uma execução, sua replicação, um resultado agregado. **Registre uma avaliação e, em seguida, faça a transição citando-a.** `recordEvaluation` (ou `attestEvaluation`, que também anexa `cognate.evaluation.recorded`) nunca altera a própria versão, portanto, cada chamada é apenas uma adição. O `evaluationIds` de uma transição indica as avaliações nas quais a decisão se baseia. Cada uma deve ser registrada nessa versão, e os IDs são vinculados ao hash da linhagem da transição. Uma versão aprovada ainda pode ser rejeitada antes de ser implementada. Se as transições devem citar é uma configuração: `requireEvaluationCitations`: `false` (o padrão), `"decisions"` (aprovar e rejeitar devem citar) ou `"all"`. O servidor HTTP lê isso de `COGNATE_REQUIRE_EVALUATION_CITATIONS` e se recusa a iniciar com qualquer outro valor.

Pré-registre uma execução antes de iniciá-la e registre seu resultado no fluxo `cognate-<tenant>-runs`. Os identificadores de nome de conta (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) são armazenados apenas como resumos hexadecimais minúsculos de 64 caracteres SHA-256, e uma execução registra seu próprio `cost` (`unitsSpent`, `rate`, `basis`) em vez de saldos de conta.

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

A imagem executa `@cognate/node` e fornece a API de governança.

**O servidor precisa de um arquivo de raízes de locatário antes de iniciar.** No modo padrão `enforce`, ele se recusa a iniciar sem um, e nenhuma chave raiz é incluída na imagem. Crie um com `node scripts/make-tenant-root.mjs my-tenant` (veja [Guia de Início Rápido](#execute-o-servidor-http-deste-repositório)), ou escreva seu próprio JSON no formato `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. O `docker-compose.yml` incluído define `COGNATE_TENANT_ROOTS_PATH` para `/run/cognate/tenant-roots.json` e mostra o ponto de montagem como uma linha de volume comentada. Descomente essa linha com o caminho do host do seu arquivo ou adicione um `docker-compose.override.yml` ao lado:

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

Sem o arquivo, o servidor imprime uma linha de erro JSON no formato de erro da API (`auth.missing-tenant-roots`, com uma dica) e sai com o código 1. Defina `COGNATE_DEBUG=1` para adicionar a pilha.

Uma vez em execução, `/health` retorna:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

O volume `cognate-data` é montado em `/app/data`. O log de eventos é `/app/data/events.jsonl`. Os snapshots são `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` e `/app/data/cognate/prompts.json`. `GET /events/:eventId` lê esse log e retorna o evento registrado com uma prova de inclusão do Attestia e a raiz. O chamador envia os mesmos cabeçalhos assinados `cognate-request-v1` como uma gravação. Um ID que não está no log deste locatário é um erro, e o corpo não tem prova. O texto de solicitação e saída não são incluídos no evento. A rota não chama RepoMesh. O compose do Attestia usa a mesma variável de log de eventos em seu próprio volume. Cada arquivo tem um escritor. A imagem de RepoMesh não monta este log. `REPOMESH_FAIL_ON` tem como padrão `unverified`: apenas uma execução BEM-SUCEDIDA é implementada. Defina-o como `fail` para permitir uma execução NÃO VERIFICADA. A imagem não define uma URL de livro-razão. A imagem é criada pelo fluxo de trabalho de lançamento a partir de uma tag `v*`, após a publicação do pacote npm, e enviada para `ghcr.io/mcp-tool-shop-org/cognate` como `X.Y.Z`, `X.Y` e `sha-*`. `latest` se move apenas em uma tag `v*`.

---

## Guia de Autenticação e Migração

### O que é imposto na versão 1.1.0 (inalterado desde a versão 1.0.0)

- **Assinatura de solicitação Ed25519 (`cognate-request-v1`).** Por padrão (`signedRequests: "enforce"`), cada solicitação `POST` e `GET /events/:eventId` deve conter `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` e `X-Signature` na string de solicitação canônica de 8 linhas (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Os corpos `POST` devem ser JCS canônicos RFC 8785 UTF-8 (`400 auth.body-not-canonical`, caso contrário). `kid` é o resumo hexadecimal minúsculo de 64 caracteres SHA-256 da chave pública de 32 bytes bruta Ed25519.
- **Proteção de reprodução ordenada e 401 uniforme.** `X-Timestamp` deve estar dentro de ±300 s da hora do servidor (`GET /health` expõe `serverTime`). O armazenamento de reprodução na memória verifica `(agentId, nonce)` somente leitura antes da verificação da assinatura, registra-o somente após a verificação da assinatura e o mantém durante todo o período de validade de 600 s. Cada falha de autenticação pré-assinatura retorna um `401` idêntico com `code: "auth.unauthenticated"`.
- **Vinculação de ator (`403 auth.actor-mismatch`).** O ator em cada rota (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` e `context.agentCapabilities`) é vinculado ao assinante verificado antes de RepoMesh ou qualquer adição de evento.
- **Proteções contra escalada de privilégios e inicialização da chave raiz.** O registro de agente (`POST /identity/agents`) e a aprovação de concessão (`POST /identity/grants/:id/approve`) exigem uma capacidade `delegate` ativa. A autoaprovação é recusada (`403 auth.self-approval-forbidden`). Os `agent.capabilities` pré-populados são recusados, exceto quando a chave pública raiz fornecida pelo operador do locatário (`tenantRootsPath` ou `COGNATE_TENANT_ROOTS_PATH`) inicializa o primeiro `delegate` do locatário. A raiz cria ou aprova um `delegate` diretamente apenas na inicialização, enquanto o locatário não tem nenhum `delegate` ativo; por design, a raiz do locatário mantém seus poderes de recuperação após a inicialização (ela gira a chave de um principal humano ou agente, revoga qualquer principal e aprova concessões não delegadas, e a recuperação de uma raiz comprometida significa substituí-la na configuração revisada e ressinar os agentes delegados do locatário). Girar uma chave transfere a autoridade desse principal para quem detém a nova chave, e a raiz escolhe a nova chave. Portanto, depois que a raiz gira a chave de um delegado humano, a raiz detém a autoridade desse delegado, incluindo a criação de novos delegados (registro de agentes e aprovação de concessões `delegate`). E se a raiz revogar todos os `delegate` ativos, o locatário novamente não terá nenhum `delegate` ativo, para que a raiz possa novamente criar um diretamente. Uma raiz derivada de uma semente de teste nunca deve ser configurada em produção. O servidor recusa as próprias chaves raiz de teste do repositório na inicialização (`auth.test-only-root-key-forbidden`), a menos que um conjunto de teste defina `allowTestOnlyRoots: true`, mas não pode reconhecer uma raiz derivada de qualquer outra semente conhecida fora da implantação. Nenhuma chave raiz de locatário é incluída no repositório ou na imagem do Docker, e o servidor se recusa a iniciar no modo `enforce` sem raízes fornecidas pelo operador (`auth.missing-tenant-roots`). Um principal de agente (`principal: "agent"`) não pode registrar um principal humano (`principal: "human"`) ou conceder `delegate`, e um `owner` não pode girar a chave de um principal humano. A rotação de chave (`POST /identity/agents/:id/key`) e a revogação (`POST /identity/agents/:id/revoke`) invalidam imediatamente os `kid` antigos.

### Ainda não, e limites atuais

- **Armazenamento de replicação de instância única.** O armazenamento de replicação `(agentId, nonce)` está na memória em um único `@cognate/node` processo; as implantações de várias instâncias não compartilham o estado de replicação.
- **Aprovações separadas, fluxo de identidade e verificação offline estão planejados para uma versão posterior.** Atualmente, qualquer ação sujeita a aprovação deve ser assinada diretamente pelo responsável pela autorização. As aprovações `cognate-approval-v1` separadas (permitindo que um agente envie uma transição contendo uma assinatura humana separada), o consumo durável `approvalId`, o fluxo de eventos autenticado `cognate-<tenant>-identity`, os campos de eventos `submittedBy` / `authorizedBy`, o verificador offline independente e a ancoragem da chave raiz RepoMesh não estão na versão 1.1.0.
- **Os IDs são globais em todos os locatários.** Registrar um ID que outro locatário já possui é recusado como um duplicado.

### Migrando agentes existentes para chaves Ed25519

1. **Gere um par de chaves Ed25519** usando `generateEd25519KeyPair()` de `@cognate/node` (neste repositório; `@cognate/node` não está no npm):
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

   const keyPair = generateEd25519KeyPair();
   // keyPair.publicKey (43-char base64url raw 32-byte key), keyPair.kid (64-char sha256 hex), keyPair.seedHex
   ```
2. **Configure as chaves públicas raiz do locatário do operador e inicialize o primeiro delegado do locatário** fornecendo um arquivo de chave raiz em formato JSON por meio de `COGNATE_TENANT_ROOTS_PATH` (ou `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`) e assinando `POST /identity/agents` com essa chave raiz do locatário enquanto o locatário não tiver nenhum `delegate` ativo (ou inicialize o agente com `publicKey` e `kid` em `agents.json` antes da inicialização). As chaves de teste, localizadas em `packages/node/tests/fixtures/`, são rejeitadas na inicialização, a menos que `allowTestOnlyRoots: true` seja definido explicitamente.
3. **Sign requests with `createSignedClient` or `signHttpRequest`**:
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
   `createSignedClient` normaliza os corpos JSON com o JCS da RFC 8785, assina cada solicitação e sincroniza automaticamente o desvio de horário a partir do `serverTime` de `GET /health` e tenta novamente uma vez se um horário incorreto causar um `401`.
4. **Janela de migração opcional (`signedRequests: "log"`):** Para aceitar temporariamente solicitações não assinadas que não sejam do tipo `/identity/*`, enquanto os chamadores fazem a migração, defina `COGNATE_SIGNED_REQUESTS=log` e `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>`. Os eventos registrados a partir de solicitações não assinadas no modo `log` carregam `unsigned: true`.

---

## Modelo de Ameaças

A Cognate assume o seguinte modelo de ameaças:

1. **Ponto de extremidade de inferência comprometido.** Um invasor obtém acesso à API do modelo. Mitigação: todos os prompts e resultados são registrados com cargas criptografadas e hashes de integridade SHA-256. A replicação é determinística.
2. **Agente mal-intencionado ou identidade de chamador falsificada.** Mitigação: cada gravação HTTP e leitura `/events/:eventId` é autenticada com uma assinatura Ed25519 (`cognate-request-v1`), verificação de carimbo de data/hora de ±300 segundos e armazenamento de replicação de nonce de 600 segundos; as capacidades são limitadas no tempo, limitadas no escopo e revogáveis (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), e cada rota vincula seus campos de ator do corpo ao assinante verificado (`403 auth.actor-mismatch`). Limitação: o armazenamento de replicação está na memória por processo, e as aprovações separadas de várias partes (`cognate-approval-v1`) e a verificação de assinatura do fluxo de eventos offline não estão na versão 1.1.0.
3. **Manipulação do modelo da cadeia de suprimentos.** Os pesos ou configurações são trocados após a avaliação. Mitigação: o registro do modelo calcula os hashes dos pesos, da configuração e do manifesto no registro, e `ModelVersion.repo` é armazenado como `sha256:<hex>`. Qualquer desvio invalida a versão.
4. **Contorno de política por meio de injeção de prompt.** Um prompt adversarial tenta contornar as regras de conteúdo. Mitigação: a avaliação de política é determinística, versionada e executada antes da inferência. Nenhum prompt é executado sem uma verificação de política aprovada.
5. **Abuso interno dos logs de auditoria.** Um operador privilegiado manipula os logs. Mitigação: o armazenamento de eventos é apenas de acréscimo e é baseado em provas de árvore de Merkle do Attestia. A manipulação quebra a cadeia de hash.
6. **Acesso entre locatários no servidor HTTP.** Um agente de um locatário acessa os registros de outro locatário. Mitigação: cada rota atua no locatário do assinante autenticado. Um registro que nomeia outro locatário é recusado, e o ID de outro locatário é respondido como ausente.
7. **Uma chave raiz de locatário mal utilizada ou mal configurada.** A chave raiz inicializa um locatário e mantém os poderes de recuperação posteriormente. Mitigação: nenhuma chave raiz é enviada no repositório ou na imagem, o servidor se recusa a iniciar no modo `enforce` sem as chaves raiz fornecidas pelo operador e se recusa às próprias chaves raiz de teste do repositório. Limitação: os poderes da raiz são amplos por design (veja acima), portanto, o operador deve manter a chave raiz com o mesmo cuidado que o próprio locatário, e a recuperação de uma raiz comprometida significa substituí-la na configuração revisada.

Nenhuma telemetria ou análise. Uma implantação no servidor HTTP pergunta a RepoMesh se a versão nomeada é aprovada. A saúde e as outras rotas permanecem neste processo. Os relatórios de segurança são enviados para [SECURITY.md](SECURITY.md).

---

## Status

Versão 1.1.0, em construção para o público. Todos os pacotes são implementados, testados e estão sendo construídos. Instale o pacote com `npm install @mcptoolshop/cognate`. Os nomes `@cognate/*` permanecem neste repositório.

| Portão | Status |
|------|--------|
| Construção | Aprovado |
| Testes | 490 aprovados (civility-kernel 164, node 157, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Cobertura | Linhas: 91,9% em civility-kernel, 94,3% em node, 93,4% em policy, 99,6% em model-registry e 100% em agent-identity, prompt-store e repomesh-bridge, com um limite de linha vitest de 90 ou superior em cada um desses sete pacotes |
| Verificação de tipo | Limpo, e o pacote construído verifica o tipo em um projeto vazio sob resolução `bundler` e `node16` |
| Docker | A imagem serve a API de governança. O volume contém o log de eventos e os três instantâneos |
| Verificação de envio | Todos os portões rígidos são aprovados (16/16 verificado) |

---

Construído por [mcp-tool-shop](https://mcp-tool-shop.github.io/)
