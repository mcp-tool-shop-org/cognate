<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>自律型インテリジェンスのための構造的ガバナンス。</strong></p>

Cognateは、[Attestia](https://github.com/mcp-tool-shop-org/attestia)上に構築されたAIガバナンス層です。Attestiaは、何らかの出来事（イベント、トランザクション、状態遷移など）が発生したことを証明し、その証明をチェーンに紐付けます。Cognateは、これらの同じアテステーションの基本要素を使用して、AIシステムを管理します。具体的には、モデルが何を行うことが許可されていたか、実際に何を行ったか、そして誰がそれを承認したかを管理します。

Attestiaが金融に関する真実を証明するのに対し、CognateはAIに関する真実を証明します。具体的には、モデルの系統、ポリシー決定、エージェントの機能、およびプロンプト/出力の整合性を証明します。同じMerkleツリー、同じ追加専用のイベントストアを使用しますが、対象領域は異なります。

## インストール

```bash
npm install @mcptoolshop/cognate
```

Node 22以降が必要です。5つのライブラリは、この1つのパッケージに含まれています。内部の`@cognate/*`名は公開されていません。

```ts
import { policy } from "@mcptoolshop/cognate";
import { evaluatePolicy } from "@mcptoolshop/cognate/policy";

const result = evaluatePolicy(policyDocument, context);
if (result.overall === "deny") {
  // do not call the model
}
```

| インポート | 概要 |
|--------|------------|
| `@mcptoolshop/cognate` | 名前空間：`types`、`policy`、`modelRegistry`、`agentIdentity`、`promptStore` |
| `@mcptoolshop/cognate/policy` | `evaluatePolicy` |
| `@mcptoolshop/cognate/model-registry` | モデルバージョンと、デプロイ前の承認ゲート |
| `@mcptoolshop/cognate/agent-identity` | 機能の付与、承認、取り消し |
| `@mcptoolshop/cognate/prompt-store` | 追加専用の暗号化されたプロンプトと出力ログ |
| `@mcptoolshop/cognate/types` | 共有名詞 |

これらは純粋な関数です。クロック、テナントキー、ストアを渡します。このパッケージはソケットを開きません。

ハンドブック：<https://mcp-tool-shop-org.github.io/cognate/handbook/>
