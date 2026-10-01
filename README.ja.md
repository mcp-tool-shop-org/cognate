<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/cognate/readme.png" alt="Cognate" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/cognate/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://mcp-tool-shop-org.github.io/cognate/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
  <a href="https://opensource.org/license/mit/"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"></a>
</p>

<p align="center"><strong>自律型インテリジェンスのための構造的ガバナンス。</strong></p>

Cognateは、[Attestia](https://github.com/mcp-tool-shop-org/attestia)を基盤として構築されたAIガバナンス層です。Attestiaは、何らかの出来事（イベント、トランザクション、状態遷移など）が発生したことを証明し、その証明をチェーンに紐付けます。Cognateは、同じ証明の基本要素を使用して、AIシステムを管理します。具体的には、モデルが何を行うことが許可されていたか、実際に何を行ったか、そして誰がそれを承認したかを管理します。

コグネートは、AIの真実性を証明します。具体的には、モデルの系統、ポリシー決定、エージェントの能力、およびプロンプトと出力の整合性です。同じMerkle証明を使用し、同じ追記専用のイベントストアを使用します。ただし、対象となるドメインは異なります。

アテスティア、コグネート、リポメッシュは、3つの製品です。アテスティアは、上記の基本的な要素の上に、金融ドメイン（個人用ウォールト、組織の財務、レジストラム）を構築します。リポメッシュはリリースネットワークであり、署名されたイベント、ノードマニフェスト、およびXRPLに固定された信頼クロックを、独自のRFC 6962台帳上に展開します。リポメッシュは、アテスティアのMerkleツリーを使用しません。コグネートは、証明が必要な場合にアテスティアを呼び出し、リリースチェックが必要な場合にリポメッシュを呼び出します。`@cognate/repomesh-bridge`がそのチェックです。

---

## ミッション

AIシステムが自律性を獲得するにつれて、それらを管理する構造は、より厳格でなければならないと私たちは考えています。スマートコントラクトが実行され、モデルが推論を行います。しかし、AIが何を実行することを許可され、実際に何を実行し、人間が承認したかを*証明*するものは存在しません。

Cognateは、不足している層です。モデルレジストリ、ポリシーの強制、エージェントのID、および決定的な監査を、モデル、組織、およびチェーン全体で統合します。

### 私たちが重視すること

- **速度よりも真実を優先。** すべてのモデル推論は、追加専用で、再現可能で、調整可能です。証明できない場合、それは起こらなかったことになります。
- **人間が承認し、機械が検証します。** AIはアドバイスを提供し、モデルは推論しますが、明示的な人間の承認なしにデプロイまたは実行されることはありません。決して。
- **構造的ガバナンス、政治的ガバナンスではありません。** 私たちは、何が有効であるかを投票で決定しません。無条件に成立する不変性を定義します。モデルのIDは明示的であり、系統は途切れておらず、ポリシーバージョンは単調です。
- **意図は実行ではありません。** エージェントが何をするべきかを宣言し、それを実行させることは、それぞれ異なるゲートを持つ別々の行為です。それらの間のギャップこそが、信頼の基盤です。
- **モデルは証人であり、権威ではありません。** Attestiaが証明します。チェーンが決済します。しかし、権限は、特定のモデルの重みではなく、構造的なルールから生じます。

---

## アーキテクチャ

Cognateは、Attestiaのプリミティブを消費し、AIネイティブのドメイン層を追加します。パッケージは純粋な関数です。呼び出し元は状態を提供します。ここに、ソケットを開いたり、ファイルに書き込んだり、クロックを読み取ったりするものは何もありません。ただし、値を渡した場合を除きます。

| パッケージ | 目的 | ステータス |
|---------|---------|--------|
| @cognate/types | 共有AIガバナンスドメインタイプ（依存関係なし） | 準備完了 |
| @cognate/policy | セマンティックポリシー評価エンジン | 準備完了 |
| @cognate/model-registry | モデルライフサイクル、バージョン管理、評価 | 準備完了 |
| @cognate/agent-identity | エージェントID、機能、許可 | 準備完了 |
| @cognate/prompt-store | 暗号化されたイベントによるプロンプト/出力ロギング | 準備完了 |

### 規制への準拠

| 規制 | Cognateが満たすもの |
|------------|-------------------|
| EU AI法第12条 | システム全体のライフサイクルにわたる追加専用のイベントロギング |
| EU AI法第14条(5) | 検証における個人の識別 |
| NIST AI RMF | ガバナンス、マッピング、測定、管理機能 |
| ISO/IEC 42001 | AI管理システム要件 |

---

## 原則

| 原則 | 実装 |
|-----------|---------------|
| 追加専用レコード | UPDATE、DELETEはなし。新しいエントリのみ |
| フェイルクローズ | ポリシーの不一致はシステムを停止させ、決してサイレントに修復することはありません |
| 決定的な再現 | 同じイベントは常に同じ状態を生成します |
| 人間の承認ゲート | 明示的な承認なしに、モデルのデプロイ、ポリシーの変更、機能の許可は行われません |
| 暗号化されたプロンプト | プライバシーのためのテナントキーAES-256-GCM、および整合性のためのSHA-256ハッシュ |
| 構造的ID | 明示的、不変、一意。モデル、エージェント、およびポリシー用 |

---

## クイックスタート

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

ポリシーを評価します。エンジンは状態を取得しません。ポリシーとコンテキストを渡します。

```ts
import { evaluatePolicy } from "@cognate/policy";

const result = evaluatePolicy(policy, context);
if (result.overall === "deny") {
  // block the request
}
```

モデルのバージョンを登録し、そのライフサイクル全体を管理します。バージョンは`registered → evaluated → approved → deployed`を移動し、`rejected`または`retired`の状態になります。`transitionVersion`は、呼び出し元が保持するスナップショットを移動させます。HTTPサーバーでは、`approved → deployed`が、バージョンが登録されたときに記録された`repo`と`release`に対して`verifyRelease`を呼び出します。合格しないリリースはデプロイされず、異なるリリースを指定するリクエストもデプロイされません。拒否の記録が残ります。

```ts
import { createRegistry, registerModel, registerVersion, transitionVersion } from "@cognate/model-registry";
```

---

## Docker

イメージは`@cognate/node`を実行し、ガバナンスAPIを提供します。`/health`は以下を返します。

```json
{ "status": "ok", "service": "cognate", "mode": "api" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`cognate-data`ボリュームは`/app/data`にマウントされます。イベントログは`/app/data/events.jsonl`です。スナップショットは`/app/data/cognate/registry.json`、`/app/data/cognate/agents.json`、および`/app/data/cognate/prompts.json`です。Attestiaのコンポーズは、独自のボリュームで同じイベントログ変数を使用します。各ファイルには1つの書き込み元があります。RepoMeshのイメージは、このログをマウントしません。`REPOMESH_FAIL_ON`はデフォルトで`unverified`に設定されており、合格したリリースのみがデプロイされます。未検証のリリースを許可するには、`fail`に設定します。イメージは、台帳のURLを設定しません。イメージは、GitHubリリースが公開されるとGHCRに公開されます。

---

## 脅威モデル

Cognateは、次の脅威モデルを想定しています。

1. **侵害された推論エンドポイント。** 攻撃者がモデルAPIへのアクセス権を取得します。軽減策：すべてのプロンプトと出力は、暗号化されたペイロードとSHA-256整合性ハッシュでログに記録されます。再現は決定論的です。
2. **盗まれた認証情報を持つ不正なエージェント。** エージェントのキーが外部に流出します。軽減策：機能は、時間制限、範囲制限、および取り消し可能です。すべての許可には、明示的な承認が必要です。
3. **サプライチェーンにおけるモデルの改ざん。** 評価後に、重みまたは構成が置き換えられます。軽減策：モデルレジストリは、登録時に重み、構成、およびマニフェストをハッシュします。逸脱があると、バージョンが無効になります。
4. **プロンプトインジェクションによるポリシーの回避。** 敵対的なプロンプトが、コンテンツルールを回避しようとします。軽減策：ポリシー評価は、決定論的で、バージョン管理されており、推論の前に実行されます。ポリシーチェックに合格しないプロンプトは実行されません。
5. **監査ログの不正な操作。** 特権のあるオペレーターがログを改ざんします。軽減策：イベントストアは追加専用であり、AttestiaのMerkleツリー証明によってバックアップされます。改ざんはチェーンハッシュを壊します。

テレメトリーや分析は行いません。HTTPサーバーでのデプロイは、RepoMeshに対して、指定されたリリースが合格するかどうかを問い合わせます。ヘルスチェックやその他のルートは、このプロセスで処理されます。

---

## ステータス

公開環境でビルドを行います。すべての主要パッケージが実装され、テストされ、ビルドされています。バンドルを`npm install @mcptoolshop/cognate`でインストールしてください。`@cognate/*`という名前は、このリポジトリに保持されます。

| ゲート | ステータス |
|------|--------|
| ビルド | 合格 |
| テスト | 165件の合格 |
| カバレッジ | ポリシーの90%以上 |
| 型チェック | クリーン |
| Docker | イメージはガバナンスAPIを提供します。ボリュームには、イベントログと3つのスナップショットが格納されます。 |
| 出荷チェック | このリリースに含まれるハンドブック、ランディングページ、およびリポジトリのメタデータ |

---

[MCP Tool Shop](https://mcp-tool-shop.github.io/)によってビルド
