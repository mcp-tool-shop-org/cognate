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

Attestia 证明金融领域的真实性，而 Cognate 证明 AI 领域的真实性——模型溯源、策略决策、代理能力以及提示/输出的完整性。使用的都是相同的默克尔树。使用的都是相同的只追加事件存储。只是应用领域不同。

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

注册模型版本，然后将其应用于生命周期。一个版本会移动 `registered → evaluated → approved → deployed`，并且它可以是 `rejected` 或 `retired`。部署仍然需要记录在版本上的批准。

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

发布的镜像构建了五个包并提供了一个健康端点。治理 HTTP API 尚未包含在此镜像中。 `/health` 响应，以便可以监视容器，同时该服务仍在开发中。

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`/health` 返回：

```json
{ "status": "ok", "service": "cognate", "mode": "placeholder" }
```

Compose 将提示和代理数据保存在 `cognate-data` 卷上，并将其挂载到 `/app/data`。当发布 GitHub 发布时，镜像会发布到 GHCR。

---

## 威胁模型

Cognate 假定以下威胁模型：

1. **受损的推理端点。** 攻击者获得了对模型 API 的访问权限。缓解措施：所有提示和输出都使用加密有效负载和 SHA-256 完整性哈希进行记录。重放是确定性的。
2. **拥有被盗凭据的恶意代理。** 代理的密钥被泄露。缓解措施：能力具有时间限制、范围限制且可以撤销。每次授予都需要明确的批准。
3. **供应链模型篡改。** 权重或配置在评估后被替换。缓解措施：模型注册表在注册时对权重、配置和清单进行哈希处理。任何偏差都会使版本无效。
4. **通过提示注入绕过策略。** 恶意提示试图规避内容规则。缓解措施：策略评估是确定性的、版本化的，并且在推理之前运行。没有提示会在没有通过策略检查的情况下执行。
5. **滥用审计日志的内部人员。** 具有特权的操作员篡改日志。缓解措施：事件存储是追加写入的，并由 Attestia 的 Merkle 树证明进行支持。篡改会破坏链哈希。

默认情况下，不会进行任何遥测、分析或出站网络调用。

---

## 状态

公开构建。所有核心包都已实现、测试并正在构建。v0.1.0 是第一个发布的版本。这些包是库。它们尚未发布到 npm。

| 门控 | 状态 |
|------|--------|
| 构建 | 通过 |
| 测试 | 72 个通过 |
| 覆盖范围 | 策略覆盖率超过 90% |
| 类型检查 | 清理 |
| Docker | 镜像构建。健康状态端点仅为占位符 |
| 发布检查 | 本版本包含手册、登录页面和代码仓库元数据 |

---

由 [MCP Tool Shop](https://mcp-tool-shop.github.io/) 构建
