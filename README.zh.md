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

<p align="center"><strong>用于自主智能的结构化治理。</strong></p>

Cognate 是构建在 [Attestia](https://github.com/mcp-tool-shop-org/attestia) 之上的 AI 治理层。Attestia 证明某个事件发生了——例如，某个事件、交易或状态转换——并将该证明与链绑定。Cognate 使用相同的证明机制来管理 AI 系统：模型被允许做什么、实际做了什么以及谁授权了它。

同源性证明了人工智能的真实性：模型血统、策略决策、代理能力以及提示和输出的完整性。相同的默克尔证明。相同的仅追加事件存储。不同的领域。

Attestia、Cognate 和 RepoMesh 是三种产品。Attestia 在这些基本要素之上，为金融领域（个人保险库、组织金库、注册表）提供服务。RepoMesh 是发布网络：签名事件、节点清单以及基于 XRPL 的信任时钟，它使用自己的 RFC 6962 分散账本。它不使用 Attestia 的默克尔树。当 Cognate 需要证明时，它会调用 Attestia；当它需要检查发布时，它会调用 RepoMesh。`@cognate/repomesh-bridge` 就是该检查。

---

## 使命

我们相信，随着 AI 系统获得自主权，对其进行治理的结构必须更加严格。智能合约执行。模型进行推断。但没有人*证明* AI 被允许做什么、实际做了什么以及是否有人类批准。

Cognate 是缺失的一层：模型注册表、策略执行、代理身份和确定性审计——在模型、组织和链之间实现统一。

### 我们的价值观

- **真实性优先于速度。** 每次模型推断都是追加写入、可重现且可调和的。如果无法证明，则它没有发生。
- **人类批准；机器验证。** AI 提供建议，模型进行推断，但没有任何内容会在没有明确的人工授权的情况下进行部署或执行。
- **结构化治理，而非政治治理。** 我们不会对什么是有效的进行投票。我们定义了始终成立的不变性——模型身份是明确的，血缘关系是完整的，策略版本是单调的。
- **意图不是执行。** 声明代理应该做什么以及让它执行是两个独立的步骤，具有独立的门控机制。两者之间的差距是信任的基础。
- **模型是证人，而不是权威。** Attestia 进行证明。链进行结算。但权威来自结构化规则，而不是来自任何模型的权重。

---

## 架构

Cognate 使用 Attestia 原语并添加了一个 AI 原生领域层。这些包是纯函数。调用者提供状态。除非你提供值，否则这里没有任何内容会打开套接字、写入文件或读取时钟。

| 包 | 目的 | 状态 |
|---------|---------|--------|
| @cognate/types | 共享的 AI 治理领域类型（零依赖） | 已准备好 |
| @cognate/policy | 语义策略评估引擎 | 已准备好 |
| @cognate/model-registry | 模型生命周期、版本控制、评估 | 已准备好 |
| @cognate/agent-identity | 代理身份、能力、授权 | 已准备好 |
| @cognate/prompt-store | 使用加密事件进行提示/输出记录 | 已准备好 |

### 法规合规性

| 法规 | Cognate 满足 |
|------------|-------------------|
| 欧盟 AI 法案第 12 条 | 在整个系统生命周期内进行追加写入事件记录 |
| 欧盟 AI 法案第 14(5) 条 | 在验证中识别自然人 |
| NIST AI RMF | 治理、映射、衡量、管理功能 |
| ISO/IEC 42001 | AI 管理系统要求 |

---

## 原则

| 原则 | 实施 |
|-----------|---------------|
| 追加写入记录 | 没有 UPDATE，没有 DELETE——只有新的条目 |
| 失败时关闭 | 策略不一致会停止系统，绝不会静默地恢复 |
| 确定性重放 | 相同的事件始终产生相同的结果 |
| 人工审批门控 | 没有明确的批准，任何模型都不会部署，任何策略都不会更改，任何能力都不会授予 |
| 加密提示 | 租户密钥 AES-256-GCM 用于隐私；SHA-256 哈希用于完整性 |
| 结构化身份 | 明确、不可篡改、唯一——用于模型、代理和策略 |

---

## 快速入门

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

评估策略。引擎不会获取状态。你传递策略和上下文。

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

注册一个模型版本，然后让它经历整个生命周期。一个版本会移动到 `registered → evaluated → approved → deployed`，并且它可以是 `rejected` 或 `retired`。`transitionVersion` 移动调用方持有的快照。在 HTTP 服务器上，`approved → deployed` 会在版本注册时记录的 `repo` 和 `release` 上调用 `verifyRelease`。如果发布未能通过，则不会部署，并且如果请求指定了不同的发布版本，也不会部署。拒绝会被记录。

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

镜像运行 `@cognate/node` 并提供治理 API。`/health` 返回：

```json
{ "status": "ok", "service": "cognate", "mode": "api" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`cognate-data` 卷挂载在 `/app/data`。事件日志是 `/app/data/events.jsonl`。快照是 `/app/data/cognate/registry.json`、`/app/data/cognate/agents.json` 和 `/app/data/cognate/prompts.json`。Attestia 的 compose 使用其自身卷上的相同事件日志变量。每个文件只有一个写入者。RepoMesh 的镜像不会挂载此日志。`REPOMESH_FAIL_ON` 默认设置为 `unverified`：只有通过的发布才能部署。将其设置为 `fail` 以允许未经验证的发布通过。镜像不会设置账本 URL。当发布 GitHub 发布版本时，镜像会发布到 GHCR。

---

## 威胁模型

Cognate 假定以下威胁模型：

1. **受损的推理端点。** 攻击者获得了对模型 API 的访问权限。缓解措施：所有提示和输出都使用加密有效负载和 SHA-256 完整性哈希进行记录。重放是确定性的。
2. **拥有被盗凭据的恶意代理。** 代理的密钥被泄露。缓解措施：能力具有时间限制、范围限制且可以撤销。每次授予都需要明确的批准。
3. **供应链模型篡改。** 权重或配置在评估后被替换。缓解措施：模型注册表在注册时对权重、配置和清单进行哈希处理。任何偏差都会使版本无效。
4. **通过提示注入绕过策略。** 恶意提示试图规避内容规则。缓解措施：策略评估是确定性的、版本化的，并且在推理之前运行。没有提示会在没有通过策略检查的情况下执行。
5. **滥用审计日志的内部人员。** 具有特权的操作员篡改日志。缓解措施：事件存储是追加写入的，并由 Attestia 的 Merkle 树证明进行支持。篡改会破坏链哈希。

不收集遥测数据或分析数据。在 HTTP 服务器上进行的部署会询问 RepoMesh，指定的发布版本是否通过。健康状况和其他路由仍然保留在此进程中。

---

## 状态

公开进行构建。所有核心软件包均已实现、测试并正在构建。使用 `npm install @mcptoolshop/cognate` 安装软件包。`@cognate/*` 中的名称将保留在此仓库中。

| 门控 | 状态 |
|------|--------|
| 构建 | 通过 |
| 测试 | 165 个通过 |
| 覆盖范围 | 策略覆盖率超过 90% |
| 类型检查 | 清理 |
| Docker | 镜像提供治理 API。该卷包含事件日志和三个快照。 |
| 发布检查 | 本版本包含手册、登录页面和代码仓库元数据 |

---

由 [MCP Tool Shop](https://mcp-tool-shop.github.io/) 构建
