<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>自主智能的结构化治理。</strong></p>

**版本 1.1.0。** 1.1.0 在代理执行操作之前添加了计划选择功能，并使 npm 包的类型适用于 TypeScript 用户。它不会更改 HTTP API、签名请求格式或事件和证明格式，因此 1.0.0 版本的调用者仍然可以正常工作。版本遵循语义版本控制：任何破坏上述任何一项的更改都将伴随新的主要版本。请参阅 [1.1.0 中的新功能](#110-中的新功能)。

Cognate 是构建在 [Attestia](https://github.com/mcp-tool-shop-org/attestia) 之上的 AI 治理层。Attestia 证明某事发生了——一个事件、一笔交易、一个状态转换——并将该证明与链绑定。Cognate 使用相同的证明基本要素来治理 AI 系统：模型被允许做什么、它实际做了什么以及谁授权了它。

Cognate 证明 AI 的真实性：模型谱系、策略决策、代理能力以及提示和输出的完整性。相同的 Merkle 证明。相同的仅追加事件存储。不同的领域。

Attestia、Cognate 和 RepoMesh 是三个产品。Attestia 在这些基本要素之上构建了金融领域（个人保险库、组织金库、注册表）。RepoMesh 是发布网络：签名事件、节点清单和基于 XRPL 的信任时钟，它拥有自己的 RFC 6962 分布式账本。它不使用 Attestia 的 Merkle 树。当 Cognate 需要证明时，它会调用 Attestia；当它需要检查发布时，它会调用 RepoMesh。`@cognate/repomesh-bridge` 就是该检查。

---

## 1.1.0 中的新功能

- **在代理执行操作之前进行计划选择。** `@cognate/civility-kernel`（来自 npm，`@mcptoolshop/cognate/civility-kernel`）获取代理的候选计划，删除任何违反硬性约束的计划，根据策略的偏好权重对剩余的计划进行评分，并返回三种结果之一：`EXECUTE`（附带所选计划）、`ASK_USER` 或 `NO_VALID_PLAN`，以及说明原因的跟踪信息。这是 [两个阶段](#两个阶段选择一个计划然后控制每个事件) 中的第一个阶段：内核选择计划，而 `@cognate/policy` 仍然在计划执行期间对每个事件进行控制。
- **可以记录和证明的决策。** `computeDecisionDigests` 将决策哈希处理，其形式与运行预注册的形式相同（`planSha256`、`decisionSha256`），并且 `attestDecision` 将 `cognate.policy.decided` 追加到租户的策略流中，该流中的事件已可由 `GET /events/:eventId` 证明。该事件包含结果以及每个被拒绝的计划违反的规则，而不是计划步骤。给定 `decisionId` 和 `timestamp`，相同的输入会生成逐字节相同的跟踪信息。
- **内核并入 Cognate 时完成的三项修复。** 其编译缓存仅基于策略的版本，因此两个具有一个版本但权重不同的策略会获得相同的规则（缓存已删除）。现在可以重现决策。并且，如果计划失败，则其得分将为 `null`，而不是负无穷大，因此即使在 JSON 循环中，跟踪信息也能保留。
- **可以从 npm 解析的类型。** 1.0.0 包的类型声明指向 npm 上不存在的工作区包，因此 TypeScript 项目会在每个子路径上获得未解析的类型。1.1.0 将这些声明包含在包中，并且 CI 将打包的包安装到空项目中，并对从每个条目导入的内容进行类型检查。

完整的列表请参见 [CHANGELOG.md](CHANGELOG.md)。

### 1.0.0 中的内容

- **运行记录。** `@cognate/model-registry` 在启动运行之前对其进行预注册，并在 `cognate-<tenant>-runs` 流中记录其结果。帐户命名标识符仅存储为 SHA-256 摘要，并且运行记录其自身的成本，而不是帐户余额。
- **评估。** 模型版本可以包含任意数量的评估（一次运行、其复制、一个池化结果），并且一次转换会引用其所依赖的评估。`requireEvaluationCitations` 设置哪些转换必须引用。在部署之前，可以拒绝已批准的版本。
- **租户范围。** `@cognate/node` 上的每个路由都在调用者的租户中运行。拒绝命名另一个租户的记录，并且另一个租户的 ID 将获得与缺失的 ID 相同的答案。缺失的 ID 现在是 404，而不是 400。
- **签名请求（破坏性更改）。** 每个写入操作和每个 `GET /events/:eventId` 必须使用调用者的 Ed25519 密钥（`cognate-request-v1`）进行签名，并带有时间戳窗口和重放保护。每个路由上的参与者都是经过验证的签名者。注册代理和批准授权需要 `delegate` 功能，并且由操作员提供的租户根密钥启动每个租户的第一个委托。请参阅 [身份验证和迁移指南](#身份验证和迁移指南)。
- **以简单易懂的方式说明根密钥的权限。** 文档列出了租户根密钥在启动后仍然可以执行的所有操作，并指出从测试种子派生的根密钥绝不能在生产环境中配置。
- **测试工具链。** vitest 4.1.12 和 vite 8.3.5；开发树中的高危和严重漏洞已在根目录中清除，没有忽略或覆盖。

---

## 使命

我们相信，随着 AI 系统的自主性增强，对其进行治理的结构也必须更加严格。智能合约执行。模型进行推断。但是，没有人 *证明* AI 被允许做什么、它实际做了什么以及是否有人类批准。

Cognate 是缺失的层：模型注册表、策略执行、代理身份和确定性审计——所有这些都统一应用于模型、组织和链。

### 我们的价值观

- **真实性优先于速度。** 每次模型推断都是仅追加的、可重放的和可调和的。如果无法证明，则它就没有发生。
- **人类批准；机器验证。** AI 提供建议，模型进行推断，但没有任何内容可以在没有明确的人类授权的情况下部署或执行。永远如此。
- **结构化治理，而非政治治理。** 我们不会对什么是有效的进行投票。我们定义了始终成立的不变性——模型身份是明确的，谱系是完整的，策略版本是单调的。
- **意图不是执行。** 声明代理应该做什么以及让它执行操作是两个独立的步骤，并且具有独立的控制。这两个步骤之间的差距是信任所在。
- **模型是证人，而不是权威。** Attestia 证明。链进行结算。但是，权威来自结构化规则，而不是任何模型的权重。

---

## 架构

Cognate 消耗 Attestia 的基本组件，并添加了一个 AI 原生的领域层。这些包是纯函数。调用者提供状态。除非你提供值，否则这里没有任何代码会打开套接字、写入文件或读取时钟。

| 包 | 目的 | 状态 |
|---------|---------|--------|
| @cognate/types | 共享的 AI 治理领域类型（无依赖） | 已准备好 |
| @cognate/policy | 语义策略评估引擎 | 已准备好 |
| @cognate/civility-kernel | 计划选择：通过硬性约束过滤候选计划，通过偏好权重对其进行评分，然后执行或询问 | 已准备好（1.1.0 版本新增） |
| @cognate/model-registry | 模型生命周期、版本控制、评估 | 已准备好 |
| @cognate/agent-identity | 代理身份、能力、授权 | 已准备好 |
| @cognate/prompt-store | 使用加密事件进行提示/输出记录 | 已准备好 |
| @cognate/repomesh-bridge | RepoMesh 发布检查（`verifyRelease`），在部署之前 | 已准备好 |
| @cognate/node | 端口 4000 上的 HTTP API 服务器，具有签名请求和租户范围 | 已准备好 |

`@mcptoolshop/cognate` 在 npm 上打包库，并将类型声明包含在其中。`@cognate/node` 在 Docker 镜像中运行。

### 两个阶段：选择一个计划，然后控制每个事件

Cognate 在两个关键点控制一个代理。

1. **在它采取行动之前，`@cognate/civility-kernel` 在计划中进行选择。** 代理提出候选计划。硬性约束会删除违反规则的计划（不可逆转的更改、超出限制的支出）。幸存的计划会根据策略的偏好权重进行评分。如果其不确定性超过策略的阈值，则执行最佳计划，否则代理会询问。如果没有计划能够幸存，代理会要求用户放宽约束或提供另一个选项。
2. **在它采取行动时，`@cognate/policy` 控制每个事件。** 每个提示、输出或支出都会对照租户的规则（内容过滤器、速率和支出限制、能力）进行检查，在匹配的规则中，最严格的那条生效。

可以记录并哈希一个决策。`attestDecision` 将 `cognate.policy.decided` 附加到租户的策略流中，其中包含摘要和决策概要，而不是计划步骤。`computeDecisionDigests` 提供 `planSha256` 和 `decisionSha256`，这是在预注册 (`preRegisterRun`) 时请求的。传递 `decisionId` 和 `timestamp`，并且相同的输入将产生完全相同的跟踪记录。

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

策略通过内核自身的循环进行更改，并且需要人工批准每个步骤：从 `proposePolicyUpdates` 反馈开始，然后是 `diffPolicy`、`lintPolicy` 和 `explainPolicy`，然后应用更改。

### 法规合规性

| 法规 | Cognate 满足 |
|------------|-------------------|
| 欧盟 AI 法案第 12 条 | 在整个系统生命周期内进行仅追加事件记录 |
| 欧盟 AI 法案第 14(5) 条 | 在验证中识别自然人 |
| NIST AI RMF | 治理、映射、衡量、管理功能 |
| ISO/IEC 42001 | AI 管理系统要求 |

---

## 原则

| 原则 | 实施 |
|-----------|---------------|
| 仅追加记录 | 没有 UPDATE，没有 DELETE——只有新的条目 |
| 默认拒绝 | 策略不一致会停止系统，绝不会静默地恢复 |
| 确定性回放 | 相同的事件始终产生相同的结果 |
| 人工批准门控 | 没有明确批准，就不会部署模型、更改策略或授予能力 |
| 加密提示 | 租户密钥 AES-256-GCM 用于保护隐私；SHA-256 哈希用于确保完整性 |
| 结构化身份 | 明确、不可变、唯一——用于模型、代理和策略 |

---

## 快速入门

### 使用 npm 中的库

```bash
npm install @mcptoolshop/cognate
```

评估一个策略。引擎不会获取状态或读取时钟。你传递策略和上下文。将其保存为 `quickstart.mjs` 并运行 `node quickstart.mjs`；它会打印 `deny`。

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

每个库都是包的一个子路径：`@mcptoolshop/cognate/policy`、`/civility-kernel`、`/model-registry`、`/agent-identity`、`/prompt-store`、`/repomesh-bridge` 和 `/types`。下面的示例使用工作区名称（`@cognate/policy` 等），这些是相同的代码。

### 从这个仓库运行 HTTP 服务器

`@cognate/node` 不在 npm 上。从克隆版本运行（Node 22 或更高版本，pnpm 10.28.2）：

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

然后，从另一个终端，`curl http://127.0.0.1:4000/health` 响应 `"status": "ok"`。`make-tenant-root.mjs` 为租户创建一个新的随机根密钥：`tenant-roots.json` 包含服务器读取的公钥，而 `tenant-root.secret.json` 包含用于对租户的第一个委托进行签名的私有种子。这两个名称都在 `.gitignore` 中。将 `tenant-root.secret.json` 放在仓库之外，并且不要将其放在任何镜像中：服务器只需要 `tenant-roots.json`。该脚本使秘密文件仅对其所有者可读，前提是平台支持（在 Windows 上，将其放在只有你可以读取的文件夹中）。完整形式为 `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`。该脚本拒绝替换现有的 `tenant-roots.json` 或 `tenant-root.secret.json`：它不写入任何内容并以代码 `exists` 退出。仅传递 `--force` 以有意替换两者，因为无法恢复旧的私有种子。在 [迁移指南](#身份验证和迁移指南) 中介绍了签名请求。

### 开发

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

注册一个模型版本，然后将其应用于生命周期。一个版本会移动 `registered → evaluated → approved → deployed`，并且它可以是 `rejected` 或 `retired`。`transitionVersion` 移动调用者持有的一个快照。在 HTTP 服务器上，`approved → deployed` 调用 `verifyRelease`，该调用使用在注册版本时记录的 `repo` 和 `release`。如果发布未能通过，则不会部署，并且也不会部署命名了不同发布的请求。拒绝情况将被记录。

评估结果会附加到某个版本上，具体数量取决于您有多少：一次运行、其复制、一个汇总结果。**记录一次评估，然后引用它进行过渡。** `recordEvaluation`（或 `attestEvaluation`，它也会附加 `cognate.evaluation.recorded`）不会移动版本本身，因此每次调用都是一次附加操作。一次过渡的 `evaluationIds` 指明了决策所依据的评估结果。每个结果都必须记录在该版本上，并且这些 ID 会绑定到过渡的血缘关系哈希中。即使已批准的版本，在部署之前仍有可能被拒绝。过渡是否必须引用评估结果是一个设置，`requireEvaluationCitations`：`false`（默认值）、`"decisions"`（批准和拒绝都必须引用）或 `"all"`。HTTP 服务器会从 `COGNATE_REQUIRE_EVALUATION_CITATIONS` 读取该设置，并且如果设置为其他值，则会拒绝启动。

在运行之前预先注册，并在 `cognate-<tenant>-runs` 流中记录其结果。帐户名称标识符（`ggufRepoSha256`、`hostedRepoSha256`、`repoSha256`、`ggufSourceSha256`、`hfRepoSha256`、`githubOwnerSha256`、`emailSha256`、`homePathSha256`）仅存储为 64 个字符的小写十六进制 SHA-256 摘要，并且一次运行会记录自己的 `cost`（`unitsSpent`、`rate`、`basis`），而不是帐户余额。

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

该镜像运行 `@cognate/node` 并提供治理 API。

**服务器在启动之前需要一个租户根文件。** 在默认 `enforce` 模式下，如果没有该文件，它将拒绝启动，并且镜像中不包含任何根密钥。使用 `node scripts/make-tenant-root.mjs my-tenant` 创建一个（请参阅[快速入门](#从这个仓库运行-http-服务器)），或者编写自己的 JSON 格式文件，格式为 `{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`。 提供的 `docker-compose.yml` 将 `COGNATE_TENANT_ROOTS_PATH` 设置为 `/run/cognate/tenant-roots.json`，并将挂载点显示为注释掉的卷行。使用您文件的主机路径取消注释该行，或者在其旁边添加一个 `docker-compose.override.yml`：

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

如果没有该文件，服务器将在 API 的错误格式中（`auth.missing-tenant-roots`，并附带提示）打印一行 JSON 错误，然后退出，返回代码 1。将 `COGNATE_DEBUG=1` 设置为添加堆栈信息。

一旦运行，`/health` 将返回：

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`cognate-data` 卷挂载在 `/app/data`。事件日志为 `/app/data/events.jsonl`。快照为 `/app/data/cognate/registry.json`、`/app/data/cognate/agents.json` 和 `/app/data/cognate/prompts.json`。 `GET /events/:eventId` 读取该日志并返回记录的事件，其中包含 Attestia 包含证明和根。调用者发送与写入时相同的已签名的 `cognate-request-v1` 标头。如果某个 ID 不在此租户的日志中，则表示未找到，并且主体不包含任何证明。提示和输出文本不包含在事件中。该路由不会调用 RepoMesh。Attestia 的组合使用其自身卷上的相同事件日志变量。每个文件只有一个写入器。 RepoMesh 的镜像不会挂载此日志。 `REPOMESH_FAIL_ON` 默认设置为 `unverified`：只有 PASS 才能部署。将其设置为 `fail` 以允许发布 UNVERIFIED 版本。镜像不设置账本 URL。该镜像由发布工作流程从 `v*` 标签构建，在 npm 包发布后，并推送到 `ghcr.io/mcp-tool-shop-org/cognate`，作为 `X.Y.Z`、`X.Y` 和 `sha-*`。 `latest` 仅在 `v*` 标签上移动。

---

## 身份验证和迁移指南

### 1.1.0 中强制执行的内容（自 1.0.0 以来未更改）

- **Ed25519 请求签名（`cognate-request-v1`）。** 默认情况下（`signedRequests: "enforce"`），每个 `POST` 和 `GET /events/:eventId` 必须携带 `X-Agent-Id`、`X-Timestamp`、`X-Nonce`、`X-Key-Id` 和 `X-Signature`，这些信息位于 8 行的规范请求字符串（`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`）中。 `POST` 主体必须是 RFC 8785 JCS 规范的 UTF-8（否则为 `400 auth.body-not-canonical`）。 `kid` 是原始 32 字节 Ed25519 公钥的 64 个字符的小写十六进制 SHA-256 摘要。
- **有序重放保护和统一的 401。** `X-Timestamp` 必须在服务器时间的 ±300 秒范围内（`GET /health` 公开了 `serverTime`）。内存中的重放存储在签名验证之前检查 `(agentId, nonce)`（只读），仅在签名验证后记录它，并在整个 600 秒的有效期内保留它。每次预签名身份验证失败都会返回一个完全相同的 `401`，其中包含 `code: "auth.unauthenticated"`。
- **参与者绑定（`403 auth.actor-mismatch`）。** 在 RepoMesh 或任何事件附加之前，每个路由（`transition.actorId`、`evaluation.evaluator`、`grant.requestedBy`、`grant.capability.grantedBy`、`approverId`、`agent.owner`、`prompt.agentId`、`model.owner`、`context.actorId`、`context.agentId` 和 `context.agentCapabilities`）上的参与者都绑定到经过验证的签名者。
- **权限升级保护和根密钥引导。** 代理注册（`POST /identity/agents`）和授权批准（`POST /identity/grants/:id/approve`）需要一个活动的 `delegate` 功能。拒绝自我批准（`403 auth.self-approval-forbidden`）。除非租户的操作员提供的根公钥（`tenantRootsPath` 或 `COGNATE_TENANT_ROOTS_PATH`）引导租户的第一个 `delegate`，否则拒绝预填充的 `agent.capabilities`。根密钥仅在引导时直接创建或批准 `delegate`，而租户没有活动的 `delegate`；按照设计，租户根在引导后保留其恢复权限（它轮换人类或代理主体的密钥，撤销任何主体，并批准非委托授权，并且从受损的根进行恢复意味着在经过审查的配置中替换它并重新签名租户的委托代理）。轮换密钥会将该主体的权限授予持有新密钥的人，并且根密钥选择新的密钥。因此，在根密钥轮换了人类委托的密钥之后，根密钥将拥有该委托的权限，包括创建新的委托（注册代理并批准 `delegate` 授权）。如果根密钥撤销了所有活动的 `delegate`，则租户再次没有活动的 `delegate`，因此根密钥可以再次直接创建一个。从测试种子派生的根密钥绝不能配置在生产环境中。服务器在启动时拒绝存储库自己的测试根密钥（`auth.test-only-root-key-forbidden`），除非测试框架设置了 `allowTestOnlyRoots: true`，但它无法识别从部署外部已知的所有其他种子派生的根密钥。没有租户根密钥存储在存储库或 Docker 镜像中，并且服务器拒绝在 `enforce` 模式下启动，除非操作员提供了根密钥（`auth.missing-tenant-roots`）。代理主体（`principal: "agent"`）不能注册人类主体（`principal: "human"`）或授予 `delegate` 授权，并且 `owner` 不能轮换人类主体的密钥。密钥轮换（`POST /identity/agents/:id/key`）和撤销（`POST /identity/agents/:id/revoke`）会立即使旧的 `kid` 密钥失效。

### 尚未实现，以及当前限制

- **单实例回放存储。** `(agentId, nonce)` 回放存储在单个 `@cognate/node` 进程的内存中；多实例部署不共享回放状态。
- **计划在后续版本中提供分离的审批、身份流和离线验证。** 目前，任何需要授权才能执行的操作都必须由授权主体直接签名。分离的 `cognate-approval-v1` 审批（允许代理提交包含单独的人工签名的转换）、持久的 `approvalId` 消耗、经过验证的 `cognate-<tenant>-identity` 事件流、`submittedBy` / `authorizedBy` 事件字段、独立的离线验证器和 RepoMesh 根密钥锚定功能均未包含在 1.1.0 版本中。
- **ID 在所有租户中都是全局唯一的。** 注册另一个租户已经拥有的 ID 会被拒绝，因为这会产生重复项。

### 将现有代理迁移到 Ed25519 密钥

1. **使用 `@cognate/node` 中的 `generateEd25519KeyPair()` 生成一个 Ed25519 密钥对**（在本仓库中；`@cognate/node` 不在 npm 上）：
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

const keyPair = generateEd25519KeyPair();
// keyPair.publicKey (43 字符 base64url 原始 32 字节密钥)，keyPair.kid (64 字符 sha256 十六进制)，keyPair.seedHex
```
2. **通过 `COGNATE_TENANT_ROOTS_PATH`（或 `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`）提供 JSON 根密钥文件，并配置操作员租户根公钥，并引导租户的第一个委托**，同时使用该租户根密钥对 `POST /identity/agents` 进行签名，而租户没有活动的 `delegate`（或者在启动之前，使用 `publicKey` 和 `kid` 在 `agents.json` 中设置代理）。 除非显式设置了 `allowTestOnlyRoots: true`，否则在启动时会拒绝 `packages/node/tests/fixtures/` 下的仅用于测试的固定密钥。
3. **使用 `createSignedClient` 或 `signHttpRequest` 签名请求：**
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
`createSignedClient` 使用 RFC 8785 JCS 规范化 JSON 请求体，对每个请求进行签名，并自动从 `GET /health` 的 `serverTime` 同步时钟偏移，并在倾斜的时钟导致 `401` 时重试一次。
4. **可选的迁移窗口 (`signedRequests: "log"`)：** 为了在调用者迁移时暂时接受未签名的非 `/identity/*` 请求，请设置 `COGNATE_SIGNED_REQUESTS=log` 和 `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>`。 从 `log` 模式下的未签名请求记录的事件包含 `unsigned: true`。

---

## 威胁模型

Cognate 假定以下威胁模型：

1. **受损的推理端点。** 攻击者获得了对模型 API 的访问权限。缓解措施：所有提示和输出都使用加密的有效负载和 SHA-256 完整性哈希进行记录。回放是确定性的。
2. **恶意代理或伪造的调用者身份。** 缓解措施：每个 HTTP 写入和 `/events/:eventId` 读取都使用 Ed25519 签名（`cognate-request-v1`）、±300 秒的时间戳检查和 600 秒的 nonce 回放存储进行身份验证；能力具有时间限制、范围限制且可撤销（`POST /identity/agents/:id/revoke`、`POST /identity/agents/:id/key`），并且每个路由都将其主体字段绑定到经过验证的签名者（`403 auth.actor-mismatch`）。限制：回放存储是每个进程的内存存储，分离的多方审批（`cognate-approval-v1`）和离线事件流签名验证功能均未包含在 1.1.0 版本中。
3. **供应链模型篡改。** 权重或配置在评估后被替换。缓解措施：模型注册表在注册时对权重、配置和清单进行哈希处理，并将 `ModelVersion.repo` 存储为 `sha256:<hex>`。任何偏差都会使版本失效。
4. **通过提示注入绕过策略。** 恶意提示试图规避内容规则。缓解措施：策略评估是确定性的、版本化的，并且在推理之前运行。没有提示可以在通过策略检查后执行。
5. **滥用审计日志。** 具有特权的操作员篡改日志。缓解措施：事件存储是追加写入的，并由 Attestia 的 Merkle 树证明支持。篡改会破坏链哈希。
6. **HTTP 服务器上的跨租户访问。** 一个租户的代理访问到另一个租户的记录。缓解措施：每个路由都在经过身份验证的签名者的租户中运行。命名另一个租户的记录会被拒绝，并且另一个租户的 ID 会被回答为不存在。
7. **滥用或配置错误的租户根密钥。** 根密钥引导租户，并在之后保留恢复权限。缓解措施：没有根密钥包含在仓库或镜像中，服务器拒绝在 `enforce` 模式下启动，除非操作员提供了根密钥，并且它拒绝仓库自己的测试根密钥。限制：根密钥的权限在设计上是广泛的（参见上文），因此操作员必须像对待租户本身一样小心地保存根密钥，并且从受损的根密钥中恢复意味着在经过审查的配置中替换它。

没有遥测或分析。在 HTTP 服务器上部署时，会询问 RepoMesh 是否命名版本通过。健康状况和其他路由都保留在此进程中。安全报告通过 [SECURITY.md](SECURITY.md) 进行。

---

## 状态

版本 1.1.0，正在公开构建。所有软件包都已实现、测试并正在构建。使用 `npm install @mcptoolshop/cognate` 安装该软件包。`@cognate/*` 名称保留在此仓库中。

| 门控 | 状态 |
|------|--------|
| 构建 | 通过 |
| 测试 | 490 个通过（civility-kernel 164，node 157，model-registry 58，policy 47，agent-identity 29，prompt-store 24，repomesh-bridge 9，cognate 2） |
| 覆盖率 | 行：civility-kernel 的 91.9%，node 的 94.3%，policy 的 93.4%，model-registry 的 99.6%，以及 agent-identity、prompt-store 和 repomesh-bridge 的 100%，其中 vitest 行的下限为 90 或以上，这七个软件包均满足此要求。 |
| 类型检查 | 干净，并且打包的软件包在 `bundler` 和 `node16` 解析器下的空项目中通过了类型检查。 |
| Docker | 镜像提供治理 API。卷存储事件日志和三个快照。 |
| 出货检查 | 所有硬性门控都已通过（16/16 已检查） |

---

由 [mcp-tool-shop](https://mcp-tool-shop.github.io/) 构建
