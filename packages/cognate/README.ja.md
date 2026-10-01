<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center"><strong>自律型インテリジェンスのための構造的ガバナンス。</strong></p>

Cognateは、[Attestia](https://github.com/mcp-tool-shop-org/attestia)上に構築されたAIガバナンス層です。Attestiaは、何らかの出来事（イベント、トランザクション、状態遷移など）が発生したことを証明し、その証明をチェーンに紐付けます。Cognateは、これらの同じアテステーションの基本要素を使用して、AIシステムを管理します。具体的には、モデルが何を行うことが許可されていたか、実際に何を行ったか、そして誰がそれを承認したかを管理します。

AIの真実を裏付ける要素：モデルの系統、ポリシー決定、エージェントの能力、およびプロンプトと出力の整合性。同じMerkle証明。同じ追加専用イベントストア。異なるドメイン。

Attestiaは、これらの基本的な要素に基づいて金融ドメインを実装します。RepoMeshは、独自のRFC 6962台帳に基づくリリースネットワークです。このパッケージは、検証が必要なリリース時に、証明のためにAttestiaと、`@cognate/repomesh-bridge`を通じてRepoMeshを呼び出します。

## インストール

```bash
npm install @mcptoolshop/cognate
```

ノード22以降が必要です。ライブラリはすべてこの1つのパッケージに含まれており、RepoMeshのリリースチェックも含まれます。内部の`@cognate/*`名は公開されていません。

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
