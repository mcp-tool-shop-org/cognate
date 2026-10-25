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

**Versão 1.0.0.** A versão anterior era 0.1.8. As versões 0.2.0 e 0.3.0 nunca foram publicadas separadamente, e suas alterações estão incluídas na 1.0.0. A versão 1.0.0 altera a API HTTP: o servidor agora rejeita solicitações não assinadas. A partir da versão 1.0, as versões seguem o versionamento semântico: uma alteração que interrompe a API HTTP, o formato de solicitação assinada ou o formato de evento e atestado vem com uma nova versão principal. Consulte [O que há de novo na 1.0.0](#o-que-há-de-novo-na-100).

Cognate é a camada de governança de IA construída sobre [Attestia](https://github.com/mcp-tool-shop-org/attestia). Attestia prova que algo aconteceu — um evento, uma transação, uma transição de estado — e vincula essa prova a uma cadeia. Cognate usa os mesmos primitivos de atestado para governar sistemas de IA: o que um modelo tinha permissão para fazer, o que ele realmente fez e quem o autorizou.

Cognate atesta a verdade da IA: linhagem do modelo, decisões de política, capacidades do agente e integridade do prompt e da saída. As mesmas provas de Merkle. O mesmo armazenamento de eventos somente de adição. Domínio diferente.

Attestia, Cognate e RepoMesh são três produtos. Attestia implementa o domínio financeiro (cofre pessoal, tesouraria da organização, registrum) com base nesses primitivos. RepoMesh é a rede de lançamento: eventos assinados, manifestos de nó e um relógio de confiança ancorado no XRPL, em seu próprio livro-razão RFC 6962. Não usa a árvore de Merkle do Attestia. Cognate chama o Attestia quando precisa de uma prova e RepoMesh quando precisa que um lançamento seja verificado. `@cognate/repomesh-bridge` é essa verificação.

---

## O que há de novo na 1.0.0

- **Registros de execução.** `@cognate/model-registry` pré-registra uma execução antes de iniciá-la e registra seu resultado no fluxo `cognate-<tenant>-runs`. Os identificadores de nomeação de conta são armazenados apenas como resumos SHA-256, e uma execução registra seu próprio custo, nunca o saldo de uma conta.
- **Avaliações.** Uma versão do modelo contém qualquer número de avaliações (uma execução, sua replicação, um resultado agregado), e uma transição cita as avaliações em que se baseia. `requireEvaluationCitations` define quais transições devem citar. Uma versão aprovada pode ser rejeitada antes de ser implementada.
- **Escopo do locatário.** Cada rota em `@cognate/node` atua no escopo do locatário que fez a chamada. Um registro que nomeia outro locatário é rejeitado, e o ID de outro locatário recebe a mesma resposta que um ID ausente. Um ID ausente agora é 404, não 400.
- **Solicitações assinadas (interrompimento).** Cada gravação e cada `GET /events/:eventId` devem ser assinadas com a chave Ed25519 do locatário que fez a chamada (`cognate-request-v1`), com uma janela de tempo e proteção contra repetição. O ator em cada rota é o signatário verificado. Registrar agentes e aprovar concessões requer uma capacidade `delegate`, e uma chave raiz de locatário fornecida pelo operador inicializa o primeiro delegado de cada locatário. Consulte [Guia de autenticação e migração](#autenticação-e-guia-de-migração).
- **Os poderes da chave raiz, em palavras simples.** A documentação lista tudo o que a raiz do locatário ainda pode fazer após a inicialização e diz que uma raiz derivada de uma semente de teste nunca deve ser configurada em produção.
- **Conjunto de ferramentas de teste.** vitest 4.1.12 e vite 8.3.5; os avisos de alta e crítica na árvore de desenvolvimento são eliminados na raiz, sem ignorar ou substituir.

A lista completa está em [CHANGELOG.md](CHANGELOG.md).

---

## Missão

Acreditamos que, à medida que os sistemas de IA ganham autonomia, as estruturas que os governam devem ganhar rigor. Os contratos inteligentes são executados. Os modelos inferem. Mas ninguém *atesta* o que a IA tinha permissão para fazer, o que ela realmente fez e se um humano aprovou.

Cognate é a camada ausente: registro de modelos, aplicação de políticas, identidade de agente e auditoria determinística — unificados em modelos, organizações e cadeias.

### O que defendemos

- **Verdade acima da velocidade.** Cada inferência de modelo é somente de adição, reproduzível e reconciliável. Se não puder ser comprovado, não aconteceu.
- **Humanos aprovam; máquinas verificam.** A IA aconselha, os modelos inferem, mas nada é implementado ou age sem autorização humana explícita. Sempre.
- **Governança estrutural, não governança política.** Não votamos sobre o que é válido. Definimos invariantes que se mantêm incondicionalmente — a identidade do modelo é explícita, a linhagem é ininterrupta, a versão da política é monotônica.
- **A intenção não é a execução.** Declarar o que um agente deve fazer e permitir que ele aja são atos separados com portões separados. A lacuna entre eles é onde a confiança reside.
- **Os modelos são testemunhas, não autoridades.** Attestia atesta. As cadeias resolvem. Mas a autoridade flui de regras estruturais, não dos pesos de nenhum modelo.

---

## Arquitetura

Cognate consome os primitivos do Attestia e adiciona uma camada de domínio nativa de IA. Os pacotes são funções puras. Os chamadores fornecem o estado. Nada aqui abre um soquete, grava um arquivo ou lê um relógio, a menos que você forneça o valor.

| Pacote | Propósito | Status |
|---------|---------|--------|
| @cognate/types | Tipos de domínio de governança de IA compartilhados (zero dependências) | Pronto |
| @cognate/policy | Mecanismo de avaliação de políticas semânticas | Pronto |
| @cognate/model-registry | Ciclo de vida do modelo, versionamento, avaliação | Pronto |
| @cognate/agent-identity | Identidade do agente, capacidades, concessões | Pronto |
| @cognate/prompt-store | Registro de prompt/saída com eventos criptografados | Pronto |
| @cognate/repomesh-bridge | Verificação de lançamento RepoMesh (`verifyRelease`) antes da implementação | Pronto |
| @cognate/node | Servidor de API HTTP na porta 4000, com solicitações assinadas e escopo do locatário | Pronto |

`@mcptoolshop/cognate` no npm agrupa as bibliotecas. `@cognate/node` é executado na imagem do Docker.

### Alinhamento regulatório

| Regulamentação | Cognate atende |
|------------|-------------------|
| Artigo 12 da Lei de IA da UE | Registro de eventos somente de adição durante todo o ciclo de vida do sistema |
| Artigo 14(5) da Lei de IA da UE | Identificação de pessoas físicas na verificação |
| NIST AI RMF | Funções de governar, mapear, medir e gerenciar |
| ISO/IEC 42001 | Requisitos do sistema de gerenciamento de IA |

---

## Princípios

| Princípio | Implementação |
|-----------|---------------|
| Registros somente de adição | Sem ATUALIZAR, sem EXCLUIR — apenas novas entradas |
| Falha segura | Incompatibilidade de políticas interrompe o sistema, nunca se resolve silenciosamente. |
| Repetição determinística. | Os mesmos eventos produzem o mesmo estado, sempre. |
| Validações de aprovação humana. | Nenhum modelo é implementado, nenhuma política é alterada, nenhum direito é concedido sem aprovação explícita. |
| Solicitações criptografadas. | Chave AES-256-GCM específica do locatário para privacidade; hash SHA-256 para integridade. |
| Identidade estrutural. | Explícita, imutável, única — para modelos, agentes e políticas. |

---

## Guia de Início Rápido

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

Cada biblioteca é um subcaminho do pacote: `@mcptoolshop/cognate/policy`, `/model-registry`, `/agent-identity`, `/prompt-store`, `/repomesh-bridge` e `/types`. Os exemplos abaixo usam os nomes dos espaços de trabalho (`@cognate/policy` e assim por diante), que são o mesmo código.

### Execute o servidor HTTP deste repositório

`@cognate/node` não está no npm. Execute-o a partir de um clone (Node 22 ou mais recente, pnpm 10.28.2):

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

Em seguida, em outro terminal, `curl http://127.0.0.1:4000/health` responde a `"status": "ok"`. `make-tenant-root.mjs` cria uma nova chave raiz aleatória para o locatário: `tenant-roots.json` contém a chave pública que o servidor lê, e `tenant-root.secret.json` contém a semente privada com a qual você assina o primeiro delegado do locatário. Ambos os nomes estão em `.gitignore`. Mantenha `tenant-root.secret.json` fora do repositório e de qualquer imagem: o servidor precisa apenas de `tenant-roots.json`. O script torna o arquivo secreto legível apenas pelo seu proprietário, onde a plataforma suporta isso (no Windows, mantenha-o em uma pasta que apenas você pode ler). A forma completa é `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`. O script se recusa a substituir um `tenant-roots.json` ou `tenant-root.secret.json` existente: ele não grava nada e sai com o código `exists`. Passe `--force` apenas para substituir ambos intencionalmente, porque a semente privada antiga não pode ser recuperada. Assinar solicitações é abordado no [guia de migração](#autenticação-e-guia-de-migração).

### Desenvolvimento

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

Registre uma versão do modelo e, em seguida, execute-a durante todo o ciclo de vida. Uma versão se move `registered → evaluated → approved → deployed` e pode ser `rejected` ou `retired`. `transitionVersion` move um instantâneo que o chamador possui. No servidor HTTP, `approved → deployed` chama `verifyRelease` no `repo` e `release` registrados quando a versão foi registrada. Uma versão que não passa não é implementada, e nem uma solicitação que nomeia uma versão diferente. A recusa é registrada.

As avaliações são anexadas a uma versão, quantas você tiver: uma execução, sua replicação, um resultado agregado. **Registre uma avaliação e, em seguida, faça a transição citando-a.** `recordEvaluation` (ou `attestEvaluation`, que também anexa `cognate.evaluation.recorded`) nunca move a própria versão, portanto, cada chamada é um acréscimo. O `evaluationIds` de uma transição nomeia as avaliações nas quais a decisão se baseia. Cada uma deve ser registrada nessa versão, e os IDs são vinculados ao hash da linhagem da transição. Uma versão aprovada ainda pode ser rejeitada antes de ser implementada. Se as transições devem citar é uma configuração, `requireEvaluationCitations`: `false` (o padrão), `"decisions"` (aprovar e rejeitar devem citar) ou `"all"`. O servidor HTTP lê isso de `COGNATE_REQUIRE_EVALUATION_CITATIONS` e se recusa a iniciar com qualquer outro valor.

Pré-registre uma execução antes que ela seja iniciada e registre seu resultado no fluxo `cognate-<tenant>-runs`. Os identificadores de nomeação de conta (`ggufRepoSha256`, `hostedRepoSha256`, `repoSha256`, `ggufSourceSha256`, `hfRepoSha256`, `githubOwnerSha256`, `emailSha256`, `homePathSha256`) são armazenados apenas como resumos hexadecimais de 64 caracteres em letras minúsculas SHA-256, e uma execução registra seu próprio `cost` (`unitsSpent`, `rate`, `basis`) em vez de saldos de conta.

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

A imagem executa `@cognate/node` e serve a API de governança.

**O servidor precisa de um arquivo de raízes de locatário antes de iniciar.** No modo padrão `enforce`, ele se recusa a iniciar sem um, e nenhuma chave raiz é enviada na imagem. Crie um com `node scripts/make-tenant-root.mjs my-tenant` (veja [Guia de Início Rápido](#execute-o-servidor-http-deste-repositório)), ou escreva seu próprio JSON no formato `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`. O `docker-compose.yml` enviado define `COGNATE_TENANT_ROOTS_PATH` como `/run/cognate/tenant-roots.json` e mostra o ponto de montagem como uma linha de volume comentada. Descomente essa linha com o caminho do host do seu arquivo ou adicione um `docker-compose.override.yml` ao lado:

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

Sem o arquivo, o servidor imprime uma linha de erro JSON no formato de erro da API (`auth.missing-tenant-roots`, com uma dica) e sai com 1. Defina `COGNATE_DEBUG=1` para adicionar a pilha.

Uma vez que esteja em execução, `/health` retorna:

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

O volume `cognate-data` é montado em `/app/data`. O log de eventos é `/app/data/events.jsonl`. Os instantâneos são `/app/data/cognate/registry.json`, `/app/data/cognate/agents.json` e `/app/data/cognate/prompts.json`. `GET /events/:eventId` lê esse log e retorna o evento registrado com uma prova de inclusão do Attestia e a raiz. O chamador envia os mesmos cabeçalhos assinados `cognate-request-v1` como uma gravação. Um ID que não está no log deste locatário é um erro, e o corpo não tem prova. O texto da solicitação e da saída não são incluídos no evento. A rota não chama RepoMesh. A composição do Attestia usa a mesma variável de log de eventos em seu próprio volume. Cada arquivo tem um escritor. A imagem de RepoMesh não monta este log. `REPOMESH_FAIL_ON` tem como padrão `unverified`: apenas uma versão APROVADA é implementada. Defina-o como `fail` para permitir que uma versão NÃO VERIFICADA seja implementada. A imagem não define uma URL de livro-razão. A imagem é criada pelo fluxo de lançamento a partir de uma tag `v*`, após a publicação do pacote npm, e enviada para `ghcr.io/mcp-tool-shop-org/cognate` como `X.Y.Z`, `X.Y` e `sha-*`. `latest` se move apenas em uma tag `v*`.

---

## Autenticação e Guia de Migração

### O que é imposto na versão 1.0.0

- **Assinatura de requisição Ed25519 (`cognate-request-v1`).** Por padrão (`signedRequests: "enforce"`), cada `POST` e `GET /events/:eventId` deve conter `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id` e `X-Signature` na string de requisição canônica de 8 linhas (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). Os corpos `POST` devem ser JCS canônicos RFC 8785 UTF-8 (`400 auth.body-not-canonical`, caso contrário). `kid` é o hexadecimal de 64 caracteres em letras minúsculas SHA-256 da chave pública bruta de 32 bytes Ed25519.
- **Proteção contra repetição ordenada e autenticação uniforme 401.** `X-Timestamp` deve estar dentro de ±300 s do tempo do servidor (`GET /health` expõe `serverTime`). O armazenamento de repetição na memória verifica `(agentId, nonce)` em modo somente leitura antes da verificação da assinatura, registra-o somente após a verificação da assinatura e o mantém durante todo o período de validade de 600 s. Cada falha de autenticação pré-assinatura retorna um `401` idêntico com `code: "auth.unauthenticated"`.
- **Vinculação do agente (`403 auth.actor-mismatch`).** O agente em cada rota (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId` e `context.agentCapabilities`) é vinculado ao assinante verificado antes de RepoMesh ou de qualquer evento ser anexado.
- **Proteções contra escalada de privilégios e inicialização da chave raiz.** O registro do agente (`POST /identity/agents`) e a aprovação da concessão (`POST /identity/grants/:id/approve`) exigem uma capacidade `delegate` ativa. A autoaprovação é recusada (`403 auth.self-approval-forbidden`). Os `agent.capabilities` pré-populados são recusados, exceto quando a chave pública raiz fornecida pelo operador do locatário (`tenantRootsPath` ou `COGNATE_TENANT_ROOTS_PATH`) inicializa o primeiro `delegate` do locatário. A raiz cria ou aprova um `delegate` diretamente apenas na inicialização, enquanto o locatário não tem nenhuma `delegate` ativa; por design, a raiz do locatário mantém seus poderes de recuperação após a inicialização (ela rotaciona a chave de um principal humano ou agente, revoga qualquer principal e aprova concessões não delegadas, e a recuperação de uma raiz comprometida significa substituí-la na configuração revisada e ressinar os agentes delegados do locatário). A rotação de uma chave transfere a autoridade desse principal para quem possuir a nova chave, e a raiz escolhe a nova chave. Portanto, após a raiz rotacionar a chave de um delegado humano, a raiz detém a autoridade desse delegado, incluindo a criação de novos delegados (registro de agentes e aprovação de `delegate` concessões). E, se a raiz revogar todas as `delegate` ativas, o locatário novamente não terá nenhuma `delegate` ativa, para que a raiz possa novamente criar uma diretamente. Uma raiz derivada de uma semente de teste nunca deve ser configurada em produção. O servidor recusa as próprias chaves raiz de teste do repositório na inicialização (`auth.test-only-root-key-forbidden`), a menos que um conjunto de teste defina `allowTestOnlyRoots: true`, mas não pode reconhecer uma raiz derivada de qualquer outra semente conhecida fora da implantação. Nenhuma chave raiz do locatário é enviada no repositório ou na imagem Docker, e o servidor se recusa a iniciar no modo `enforce` sem as raízes fornecidas pelo operador (`auth.missing-tenant-roots`). Um principal de agente (`principal: "agent"`) não pode registrar um principal humano (`principal: "human"`) ou conceder `delegate`, e um `owner` não pode rotacionar a chave de um principal humano. A rotação de chave (`POST /identity/agents/:id/key`) e a revogação (`POST /identity/agents/:id/revoke`) invalidam imediatamente as antigas `kid`.

### Ainda não, e limites atuais

- **Armazenamento de repetição de instância única.** O armazenamento de repetição `(agentId, nonce)` está na memória em um único processo `@cognate/node`; as implantações de várias instâncias não compartilham o estado de repetição.
- **Aprovações desacopladas, fluxo de identidade e verificação offline estão planejados para uma versão posterior.** Atualmente, qualquer ação sujeita a aprovação deve ser assinada diretamente pelo principal autorizador. As aprovações desacopladas `cognate-approval-v1` (permitindo que um agente envie uma transição contendo uma assinatura humana separada), o consumo durável `approvalId`, o fluxo de eventos atestado `cognate-<tenant>-identity`, os campos de eventos `submittedBy` / `authorizedBy`, o verificador offline independente e a ancoragem da chave raiz RepoMesh não estão na versão 1.0.0.
- **Os IDs são globais entre os locatários.** Registrar um ID que outro locatário já possui é recusado como um duplicado.

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

## Modelo de ameaças

O Cognate assume o seguinte modelo de ameaças:

1. **Ponto de extremidade de inferência comprometido.** Um invasor obtém acesso à API do modelo. Mitigação: todos os prompts e resultados são registrados com cargas criptografadas e hashes de integridade SHA-256. A repetição é determinística.
2. **Agente mal-intencionado ou identificação de chamadas falsificada.** Mitigação: cada operação de escrita HTTP e leitura em `/events/:eventId` é autenticada com uma assinatura Ed25519 (`cognate-request-v1`), verificação de carimbo de data/hora com uma tolerância de ±300 segundos e armazenamento de nonce com validade de 600 segundos para evitar ataques de repetição; as capacidades têm um prazo de validade, um escopo limitado e podem ser revogadas (`POST /identity/agents/:id/revoke`, `POST /identity/agents/:id/key`), e cada rota vincula os campos do ator no corpo da solicitação ao signatário verificado (`403 auth.actor-mismatch`). Limite: o armazenamento contra repetição fica na memória para cada processo, e as aprovações multipartidárias independentes (`cognate-approval-v1`) e a verificação de assinatura do fluxo de eventos offline não estão incluídas na versão 1.0.0.
3. **Manipulação do modelo da cadeia de suprimentos.** Os pesos ou as configurações são alterados após a avaliação. Mitigação: o registro do modelo calcula o hash dos pesos, da configuração e do manifesto no momento do registro, e `ModelVersion.repo` é armazenado como `sha256:<hex>`. Qualquer desvio invalida a versão.
4. **Contorno de política por meio de injeção de prompt.** Um prompt malicioso tenta contornar as regras de conteúdo. Mitigação: a avaliação da política é determinística, utiliza controle de versão e é executada antes da inferência. Nenhum prompt é executado sem passar por uma verificação de política.
5. **Uso indevido de registros de auditoria por um usuário interno.** Um operador com privilégios manipula os registros. Mitigação: o armazenamento de eventos é apenas de acréscimo e é protegido pelas provas de árvore de Merkle da Attestia. A manipulação quebra o hash da cadeia.
6. **Acesso entre diferentes locatários no servidor HTTP.** Um agente de um locatário acessa os registros de outro locatário. Mitigação: cada rota opera no contexto do locatário do assinante autenticado. Uma solicitação que faz referência a outro locatário é rejeitada, e o ID de outro locatário é retornado como inexistente.
7. **Uma chave raiz de locatário mal utilizada ou configurada incorretamente.** A chave raiz inicializa um locatário e mantém os recursos de recuperação posteriormente. Mitigação: nenhuma chave raiz é incluída no repositório ou na imagem, o servidor se recusa a iniciar no modo `enforce` sem as chaves raiz fornecidas pelo operador e rejeita as próprias chaves raiz de teste do repositório. Limitação: os recursos da chave raiz são amplos por design (veja acima), portanto, o operador deve guardar a chave raiz com o mesmo cuidado que o próprio locatário, e a recuperação de uma chave raiz comprometida significa substituí-la na configuração revisada.

Sem telemetria ou análise. Uma implantação no servidor HTTP pergunta RepoMesh se a versão nomeada é aprovada. A saúde e as outras rotas permanecem neste processo. Os relatórios de segurança são enviados para [SECURITY.md](SECURITY.md).

---

## Status

Versão 1.0.0, em construção pública. Todos os pacotes são implementados, testados e estão sendo construídos. Instale o pacote com `npm install @mcptoolshop/cognate`. Os nomes `@cognate/*` permanecem neste repositório.

| Portão | Status |
|------|--------|
| Construção | Aprovado |
| Testes | 316 aprovados (node 147, model-registry 58, policy 47, agent-identity 29, prompt-store 24, repomesh-bridge 9, cognate 2) |
| Cobertura | Linhas: 94,3% em node, 93,4% em policy, 99,6% em model-registry e 100% em agent-identity, prompt-store e repomesh-bridge, com limites de cobertura do vitest nesses seis pacotes |
| Verificação de tipo | Limpeza |
| Docker. | A imagem serve a API de governança. O volume contém o registro de eventos e os três instantâneos |
| Verificação de envio | Manual, página de destino e metadados do repositório nesta versão |

---

Construído por [mcp-tool-shop](https://mcp-tool-shop.github.io/)
