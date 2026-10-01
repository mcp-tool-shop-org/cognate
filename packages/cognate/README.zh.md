<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>用于自主智能的结构化治理。</strong></p>

Cognate 是构建在 [Attestia](https://github.com/mcp-tool-shop-org/attestia) 之上的 AI 治理层。Attestia 证明某事发生了——一个事件、一笔交易、一种状态转换——并将该证明与链绑定。Cognate 使用相同的证明基本元素来治理 AI 系统：模型被允许做什么、实际做了什么以及谁授权了它。

同源性证明了人工智能的真实性：模型血统、策略决策、代理能力以及提示和输出的完整性。相同的默克尔证明。相同的仅追加事件存储。不同的领域。

Attestia 在这些基本要素之上构建了金融领域。RepoMesh 是发布网络，它拥有自己的 RFC 6962 分布式账本。当需要检查发布时，此软件包会调用 Attestia 以获取证明，并通过 `@cognate/repomesh-bridge` 调用 RepoMesh。

## 安装

```bash
npm install @mcptoolshop/cognate
```

节点版本为 22 或更高版本。所有库都包含在此软件包中，包括 RepoMesh 发布检查。内部 `@cognate/*` 名称未公开。

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| 导入 | 它的作用 |
|--------|------------|
| `@mcptoolshop/cognate` | 命名空间：`types`、`policy`、`modelRegistry`、`agentIdentity`、`promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | 模型版本以及部署前的审批 |
| `@mcptoolshop/cognate/agent-identity` | 能力授权、批准、撤销 |
| `@mcptoolshop/cognate/prompt-store` | 仅追加的加密提示和输出日志 |
| `@mcptoolshop/cognate/types` | 共享的名词 |

这些是纯函数。您传递时钟、租户密钥和存储。此包不打开套接字。

手册：<https://mcp-tool-shop-org.github.io/cognate/handbook/>
