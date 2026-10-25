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

**版本 1.0.0。** 之前的版本是 0.1.8。0.2.0 和 0.3.0 并没有单独发布，它们的更改包含在 1.0.0 中。1.0.0 更改了 HTTP API：服务器现在拒绝未经签名的请求。从 1.0 开始，版本遵循语义化版本控制：如果更改破坏了 HTTP API、签名请求格式或事件和证明格式，则会发布新的主要版本。请参阅 [1.0.0 中的新内容](#100-中的新内容)。

Cognate 是构建在 [Attestia](https://github.com/mcp-tool-shop-org/attestia) 之上的 AI 治理层。Attestia 证明某事发生了——一个事件、一笔交易、一个状态转换——并将该证明绑定到链上。Cognate 使用相同的证明基本元素来治理 AI 系统：模型被允许做什么、它实际做了什么以及谁授权了它。

Cognate 证明 AI 的真实性：模型谱系、策略决策、代理能力以及提示和输出的完整性。相同的 Merkle 证明。相同的仅追加事件存储。不同的领域。

Attestia、Cognate 和 RepoMesh 是三个产品。Attestia 在这些基本要素之上构建了金融领域（个人保险库、组织金库、注册表）。RepoMesh 是发布网络：签名事件、节点清单以及与 XRPL 绑定的信任时钟，它使用自己的 RFC 6962 分布式账本。它不使用 Attestia 的 Merkle 树。当 Cognate 需要证明时，它会调用 Attestia；当它需要检查发布时，它会调用 RepoMesh。`@cognate/repomesh-bridge` 就是该检查。

---

## 1.0.0 中的新内容

- **运行记录。** `@cognate/model-registry` 在启动之前预先注册一个运行，并在 `cognate-<tenant>-runs` 流中记录其结果。帐户名称标识符仅存储为 SHA-256 摘要，并且运行记录其自身的成本，而不是帐户余额。
- **评估。** 一个模型版本可以包含任意数量的评估（一个运行、它的复制、一个汇总结果），并且一个转换会引用它所依赖的评估。`requireEvaluationCitations` 设置哪些转换必须引用。可以在部署之前拒绝一个已批准的版本。
- **租户范围。** `@cognate/node` 上的每个路由都在调用者的租户中运行。拒绝命名另一个租户的记录，并且另一个租户的 ID 将获得与缺失 ID 相同的答案。缺失的 ID 现在是 404，而不是 400。
- **签名请求（破坏性更改）。** 每次写入和每次 `GET /events/:eventId` 必须使用调用者的 Ed25519 密钥（`cognate-request-v1`）进行签名，并带有时间戳窗口和重放保护。每个路由上的参与者都是经过验证的签名者。注册代理和批准授权需要 `delegate` 权限，并且由操作员提供的租户根密钥启动每个租户的第一个委托。请参阅 [身份验证和迁移指南](#身份验证和迁移指南)。
- **以通俗易懂的语言说明根密钥的权限。** 文档列出了租户根密钥在启动后仍然可以执行的所有操作，并指出从测试种子派生的根密钥绝不能在生产环境中配置。
- **测试工具链。** vitest 4.1.12 和 vite 8.3.5；开发树中的高危和严重漏洞已在根目录中清除，没有忽略或覆盖。

完整的列表在 [CHANGELOG.md](CHANGELOG.md) 中。

---

## 使命

我们相信，随着 AI 系统获得自主权，对其进行治理的结构必须更加严格。智能合约执行。模型推断。但是没有人*证明* AI 被允许做什么、它实际做了什么以及是否有人类批准。

Cognate 是缺失的层：模型注册表、策略执行、代理身份和确定性审计——所有这些都统一应用于模型、组织和链。

### 我们的价值观

- **真实性优先于速度。** 每次模型推断都是仅追加、可重放和可调和的。如果无法证明，那么它就没有发生。
- **人类批准；机器验证。** AI 提供建议，模型推断，但没有任何东西可以在没有明确的人类授权的情况下部署或运行。永远如此。
- **结构化治理，而不是政治治理。** 我们不会对什么是有效的进行投票。我们定义了始终成立的不变性——模型身份是明确的，谱系是完整的，策略版本是单调的。
- **意图不是执行。** 声明代理应该做什么以及让它执行是两个独立的步骤，具有独立的门控。这两个步骤之间的差距是信任存在的地方。
- **模型是证人，而不是权威。** Attestia 证明。链结算。但是权威来自结构化规则，而不是来自任何模型的权重。

---

## 架构

Cognate 使用 Attestia 基本元素并添加了一个 AI 原生领域层。这些包是纯函数。调用者提供状态。除非您提供该值，否则这里没有任何东西会打开套接字、写入文件或读取时钟。

| 包 | 目的 | 状态 |
|---------|---------|--------|
| @cognate/types | 共享 AI 治理领域类型（零依赖） | 已准备好 |
| @cognate/policy | 语义策略评估引擎 | 已准备好 |
| @cognate/model-registry | 模型生命周期、版本控制、评估 | 已准备好 |
| @cognate/agent-identity | 代理身份、能力、授权 | 已准备好 |
| @cognate/prompt-store | 使用加密事件进行提示/输出记录 | 已准备好 |
| @cognate/repomesh-bridge | RepoMesh 发布检查（`verifyRelease`）在部署之前 | 已准备好 |
| @cognate/node | HTTP API 服务器在 4000 端口上运行，具有签名请求和租户范围 | 已准备好 |

`@mcptoolshop/cognate` 在 npm 上打包库。`@cognate/node` 在 Docker 镜像中运行。

### 监管合规性

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
| 故障安全 | 策略冲突会停止系统运行，不会悄无声息地恢复。 |
| 确定性回放 | 相同的事件产生相同的结果，始终如此。 |
| 人工审批环节 | 未经明确批准，不得部署任何模型、更改任何策略或授予任何权限。 |
| 加密提示 | 为保护隐私，使用租户密钥 AES-256-GCM；为保证完整性，使用 SHA-256 哈希。 |
| 结构化身份 | 明确、不可变、唯一——适用于模型、代理和策略。 |

---

## 快速入门

### 使用 npm 中的库

```bash
npm install @mcptoolshop/cognate
```

评估一个策略。引擎不会获取状态或读取时钟。您传递策略和上下文。将此保存为 `quickstart.mjs` 并运行 `node quickstart.mjs`；它会打印 `deny`。

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

每个库都是包的一个子路径：`@mcptoolshop/cognate/policy`、`/model-registry`、`/agent-identity`、`/prompt-store`、`/repomesh-bridge` 和 `/types`。下面的示例使用工作区名称（`@cognate/policy` 等），这些是相同的代码。

### 从这个仓库运行 HTTP 服务器

`@cognate/node` 不在 npm 上。从克隆版本运行（Node 22 或更高版本，pnpm 10.28.2）：

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

然后，从另一个终端，`curl http://127.0.0.1:4000/health` 回复 `"status": "ok"`。`make-tenant-root.mjs` 为租户生成一个新的随机根密钥：`tenant-roots.json` 存储服务器读取的公钥，`tenant-root.secret.json` 存储用于签署租户第一个委托的私钥种子。这两个名称都位于 `.gitignore` 中。请勿将 `tenant-root.secret.json` 存储在仓库或任何镜像中：服务器只需要 `tenant-roots.json`。脚本使该秘密文件仅由其所有者可读，前提是平台支持此功能（在 Windows 上，将其保存在只有您可以读取的文件夹中）。完整形式为 `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]`。脚本拒绝替换现有的 `tenant-roots.json` 或 `tenant-root.secret.json`：它不执行任何操作，并以代码 `exists` 退出。仅在有意替换两者时才传递 `--force`，因为无法恢复旧的私钥种子。签署请求的内容在 [迁移指南](#身份验证和迁移指南) 中有说明。

### 开发

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

注册一个模型版本，然后将其应用于生命周期。一个版本会移动 `registered → evaluated → approved → deployed`，它可以是 `rejected` 或 `retired`。`transitionVersion` 移动调用者持有的快照。在 HTTP 服务器上，`approved → deployed` 调用 `verifyRelease`，并使用在版本注册时记录的 `repo` 和 `release`。如果发布未能通过，则不会部署，并且如果请求指定了不同的发布版本，也不会部署。拒绝会被记录。

评估会附加到版本，数量与您拥有的版本一样多：一次运行、其复制、一个汇总结果。**记录一次评估，然后引用它进行过渡。** `recordEvaluation`（或 `attestEvaluation`，它也会附加 `cognate.evaluation.recorded`）绝不会移动版本本身，因此每次调用都是一次附加。一次过渡的 `evaluationIds` 指定了决策所依据的评估。每个评估都必须在该版本上进行记录，并且 ID 会绑定到过渡的谱系哈希中。即使已批准的版本在部署之前仍可能被拒绝。是否必须引用过渡是一个设置，`requireEvaluationCitations`：`false`（默认值）、`"decisions"`（批准和拒绝都必须引用）或 `"all"`。HTTP 服务器从 `COGNATE_REQUIRE_EVALUATION_CITATIONS` 读取它，并且如果值为其他值，则拒绝启动。

在运行开始之前预先注册一次运行，并在 `cognate-<tenant>-runs` 流上记录其结果。帐户命名标识符（`ggufRepoSha256`、`hostedRepoSha256`、`repoSha256`、`ggufSourceSha256`、`hfRepoSha256`、`githubOwnerSha256`、`emailSha256`、`homePathSha256`）仅存储为 64 个字符的小写十六进制 SHA-256 摘要，并且一次运行会记录其自身的 `cost`（`unitsSpent`、`rate`、`basis`），而不是帐户余额。

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

**服务器在启动之前需要一个租户根文件。** 在默认 `enforce` 模式下，如果没有该文件，它将拒绝启动，并且镜像中不包含任何根密钥。使用 `node scripts/make-tenant-root.mjs my-tenant` 创建一个（请参阅 [快速入门](#从这个仓库运行-http-服务器)），或者编写自己的 JSON 格式，如下所示：`{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`。已提供的 `docker-compose.yml` 将 `COGNATE_TENANT_ROOTS_PATH` 设置为 `/run/cognate/tenant-roots.json`，并显示挂载点为注释的卷行。使用您文件的主机路径取消注释该行，或者在其旁边添加一个 `docker-compose.override.yml`：

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

如果没有该文件，服务器将以 JSON 错误行的形式在 API 的错误格式中打印一条错误信息（`auth.missing-tenant-roots`，并提供提示），然后退出，返回代码 1。将 `COGNATE_DEBUG=1` 设置为添加堆栈信息。

一旦运行，`/health` 将返回：

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`cognate-data` 卷挂载在 `/app/data`。事件日志为 `/app/data/events.jsonl`。快照为 `/app/data/cognate/registry.json`、`/app/data/cognate/agents.json` 和 `/app/data/cognate/prompts.json`。`GET /events/:eventId` 读取该日志并返回记录的事件，其中包含 Attestia 包含证明和根。调用者发送与写入相同的已签名的 `cognate-request-v1` 标头。如果 ID 不在此租户的日志中，则表示失败，并且主体不包含任何证明。提示和输出文本不会包含在事件中。该路由不会调用 RepoMesh。Attestia 的组合使用其自身卷上的相同事件日志变量。每个文件只有一个写入器。RepoMesh 的镜像不会挂载此日志。`REPOMESH_FAIL_ON` 默认为 `unverified`：只有 PASS 才会部署。将其设置为 `fail` 以允许通过 UNVERIFIED 发布。镜像不设置账本 URL。镜像由发布工作流程从 `v*` 标签构建，npm 包发布后，推送到 `ghcr.io/mcp-tool-shop-org/cognate`，作为 `X.Y.Z`、`X.Y` 和 `sha-*`。`latest` 仅在 `v*` 标签上移动。

---

## 身份验证和迁移指南

### 1.0.0 中强制执行的内容

- **Ed25519 请求签名 (`cognate-request-v1`)。** 默认情况下 (`signedRequests: "enforce"`)，每个 `POST` 和 `GET /events/:eventId` 必须在 8 行规范请求字符串 (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`) 中携带 `X-Agent-Id`、`X-Timestamp`、`X-Nonce`、`X-Key-Id` 和 `X-Signature`。 `POST` 请求体必须是 RFC 8785 JCS 规范的 UTF-8 (否则为 `400 auth.body-not-canonical`)。 `kid` 是原始 32 字节 Ed25519 公钥的 64 字符小写十六进制 SHA-256。
- **有序重复播放保护和统一的 401 错误。** `X-Timestamp` 必须在服务器时间 (`GET /health`) 的 ±300 秒范围内 (`serverTime`)。 在签名验证之前，内存中的重复播放存储会检查 `(agentId, nonce)` 是否为只读状态，仅在签名验证通过后记录，并在整个 600 秒的有效期内保留。 每次预签名身份验证失败都会返回一个完全相同的 `401`，其中包含 `code: "auth.unauthenticated"`。
- **参与者绑定 (`403 auth.actor-mismatch`)。** 每个路由 (`transition.actorId`、`evaluation.evaluator`、`grant.requestedBy`、`grant.capability.grantedBy`、`approverId`、`agent.owner`、`prompt.agentId`、`model.owner`、`context.actorId`、`context.agentId` 和 `context.agentCapabilities`) 上的参与者在 RepoMesh 或任何事件追加之前，都与经过验证的签名者绑定。
- **权限升级保护和根密钥引导。** 代理注册 (`POST /identity/agents`) 和授权批准 (`POST /identity/grants/:id/approve`) 需要一个活动的 `delegate` 功能。 拒绝自我批准 (`403 auth.self-approval-forbidden`)。 除非租户的操作员提供的根公钥 (`tenantRootsPath` 或 `COGNATE_TENANT_ROOTS_PATH`) 引导租户的第一个 `delegate`，否则拒绝预填充的 `agent.capabilities`。 根密钥仅在引导时直接生成或批准 `delegate`，而租户没有活动的 `delegate`； 按照设计，租户根密钥在引导后保留其恢复能力（它轮换人类或代理主体的密钥，撤销任何主体，并批准非委托授权，并且从受损的根密钥中恢复意味着在审核的配置中替换它并重新签名租户的委托代理）。 轮换密钥会将该主体的权限授予持有新密钥的人，并且根密钥选择新的密钥。 因此，在根密钥轮换人类委托的密钥后，根密钥将拥有该委托的权限，包括生成新的委托（注册代理并批准 `delegate` 授权）。 如果根密钥撤销所有活动的 `delegate`，则租户再次没有活动的 `delegate`，因此根密钥可以再次直接生成一个。 从测试种子派生的根密钥绝不能配置在生产环境中。 除非测试框架设置了 `allowTestOnlyRoots: true`，否则服务器会在启动时拒绝仓库自己的测试根密钥 (`auth.test-only-root-key-forbidden`)，但它无法识别从部署外部的任何其他已知种子派生的根密钥。 仓库或 Docker 镜像中不包含任何租户根密钥，并且服务器拒绝在 `enforce` 模式下启动，除非提供操作员提供的根密钥 (`auth.missing-tenant-roots`)。 代理主体 (`principal: "agent"`) 不能注册人类主体 (`principal: "human"`) 或授予 `delegate`，并且 `owner` 不能轮换人类主体的密钥。 密钥轮换 (`POST /identity/agents/:id/key`) 和撤销 (`POST /identity/agents/:id/revoke`) 会立即使旧的 `kid` 无效。

### 尚未实现，以及当前的限制

- **单实例重复播放存储。** `(agentId, nonce)` 重复播放存储位于单个 `@cognate/node` 进程的内存中；多实例部署不共享重复播放状态。
- **计划在后续版本中实现分离的批准、身份流和离线验证。** 今天，任何需要签名才能执行的操作都必须由授权主体直接签名。 分离的 `cognate-approval-v1` 批准（允许代理提交包含单独的人类签名的转换）、持久的 `approvalId` 消耗、经过验证的 `cognate-<tenant>-identity` 事件流、`submittedBy` / `authorizedBy` 事件字段、独立的离线验证器和 RepoMesh 根密钥锚定，这些都不在 1.0.0 版本中。
- **ID 在所有租户中都是全局的。** 注册另一个租户已经拥有的 ID 会被拒绝，因为这是重复的。

### 将现有的代理迁移到 Ed25519 密钥

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

1. **推理端点遭到破坏。** 攻击者获得了对模型 API 的访问权限。缓解措施：所有提示和输出都使用加密有效负载和 SHA-256 完整性哈希进行记录。重放操作是确定性的。
2. **恶意代理或伪造的调用者身份。** 缓解措施：每个 HTTP 写入和 `/events/:eventId` 读取操作都使用 Ed25519 签名（`cognate-request-v1`）、±300 秒的时间戳检查以及 600 秒的随机数重放存储进行身份验证；权限具有时间限制、范围限制且可撤销（`POST /identity/agents/:id/revoke`、`POST /identity/agents/:id/key`），并且每个路由将其主体字段绑定到经过验证的签名者（`403 auth.actor-mismatch`）。限制：重放存储是每个进程中的内存存储，并且 1.0.0 版本中不包含分离的多方审批（`cognate-approval-v1`）和离线事件流签名验证。
3. **供应链模型篡改。** 权重或配置在评估后被替换。缓解措施：模型注册表在注册时对权重、配置和清单进行哈希处理，并将 `ModelVersion.repo` 存储为 `sha256:<hex>`。任何偏差都会使版本失效。
4. **通过提示注入绕过策略。** 恶意提示试图规避内容规则。缓解措施：策略评估是确定性的、有版本的，并且在推理之前运行。如果没有通过策略检查，则不会执行任何提示。
5. **滥用审计日志。** 具有特权的操作员篡改日志。缓解措施：事件存储是追加写入的，并由 Attestia 的 Merkle 树证明支持。篡改会破坏链哈希。
6. **HTTP 服务器上的跨租户访问。** 一个租户的代理访问了另一个租户的记录。缓解措施：每个路由都在经过身份验证的签名者的租户中运行。拒绝命名另一个租户的记录，并回答另一个租户的 ID 为缺失。
7. **滥用或错误配置的租户根密钥。** 根密钥启动一个租户，并在之后保留恢复权限。缓解措施：根密钥不包含在仓库或镜像中，服务器拒绝在没有操作员提供的根密钥的情况下以 `enforce` 模式启动，并且拒绝仓库自己的测试根密钥。限制：根密钥的权限在设计上是广泛的（参见上文），因此操作员必须像对待租户本身一样小心地保存根密钥，并且从受损的根密钥中恢复意味着在经过审查的配置中替换它。

没有遥测或分析。在 HTTP 服务器上部署时，会询问 RepoMesh 命名的发布版本是否通过。健康状况和其他路由保留在此进程中。安全报告通过 [SECURITY.md](SECURITY.md) 进行。

---

## 状态

版本 1.0.0，公开构建。所有软件包均已实现、测试和构建。使用 `npm install @mcptoolshop/cognate` 安装软件包。 `@cognate/*` 名称保留在此仓库中。

| 门控 | 状态 |
|------|--------|
| 构建 | 通过 |
| 测试 | 316 个通过（node 147，model-registry 58，policy 47，agent-identity 29，prompt-store 24，repomesh-bridge 9，cognate 2） |
| 覆盖率 | 行：node 中为 94.3%，policy 中为 93.4%，model-registry 中为 99.6%，agent-identity、prompt-store 和 repomesh-bridge 中为 100%，并且这六个软件包都具有 vitest 覆盖率下限。 |
| 类型检查 | 清理 |
| Docker | 镜像提供治理 API。卷包含事件日志和三个快照。 |
| 发布检查 | 本版本包含手册、登录页面和仓库元数据。 |

---

由 [mcp-tool-shop](https://mcp-tool-shop.github.io/) 构建。
