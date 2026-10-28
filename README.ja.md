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

**バージョン1.1.0。** 1.1.0では、エージェントがアクションを実行する前にプランを選択する機能が追加され、npmバンドルの型がTypeScriptユーザー向けに機能するように変更されました。HTTP API、署名付きリクエスト形式、イベントおよびアテステーション形式には変更がないため、1.0.0の呼び出し元は引き続き動作します。バージョンはセマンティックバージョニングに従います。これらのいずれかに影響を与える変更があった場合は、新しいメジャーバージョンがリリースされます。[1.1.0の新機能](#110の新機能)を参照してください。

Cognateは、[Attestia](https://github.com/mcp-tool-shop-org/attestia)上に構築されたAIガバナンスレイヤーです。Attestiaは、何らかのイベント、トランザクション、状態遷移が発生したことを証明し、その証明をチェーンにバインドします。Cognateは、これらの同じアテステーションプリミティブを使用して、AIシステムを管理します。モデルが何を実行することを許可され、実際に何を実行し、誰がそれを承認したかを管理します。

Cognateは、AIの真実性を証明します。モデルの系統、ポリシーの決定、エージェントの機能、プロンプトと出力の整合性。同じMerkle証明。同じ追加専用のイベントストア。異なるドメイン。

Attestia、Cognate、およびRepoMeshは、3つの製品です。Attestiaは、これらのプリミティブの上に、金融ドメイン（個人用ウォレット、組織の資金庫、レジストラム）を実装します。RepoMeshはリリースネットワークです。署名付きイベント、ノードマニフェスト、およびXRPLにアンカーされた信頼クロックを、独自のRFC 6962レジャー上に構築します。AttestiaのMerkleツリーは使用しません。Cognateは、証明が必要な場合にAttestiaを呼び出し、リリースをチェックする必要がある場合にRepoMeshを呼び出します。`@cognate/repomesh-bridge`がそのチェックです。

---

## 1.1.0の新機能

- **エージェントがアクションを実行する前に、プランを選択します。** `@cognate/civility-kernel`（npm、`@mcptoolshop/cognate/civility-kernel`から）は、エージェントの候補プランを取得し、ハード制約に違反するものをすべて削除し、残りをポリシーの優先度の重みでスコアリングし、選択されたプランを伴う`EXECUTE`、`ASK_USER`、または`NO_VALID_PLAN`のいずれかを、その理由のトレースとともに返します。これは、[2つの段階](#2-つの段階プランを選択してから各イベントをゲートする)の最初の段階です。カーネルがプランを選択し、プランが実行されている間は、`@cognate/policy`が各イベントをゲートします。
- **記録および証明できる決定。** `computeDecisionDigests`は、実行前の登録が行われる形式（`planSha256`、`decisionSha256`）で決定をハッシュし、`attestDecision`は`cognate.policy.decided`をテナントのポリシーストリームに追加します。このストリームのイベントは、`GET /events/:eventId`ですでに証明できます。イベントには、結果と、各拒否されたプランが違反したルールが含まれますが、プランのステップは含まれません。`decisionId`と`timestamp`を指定すると、同じ入力からバイト単位で同一のトレースが得られます。
- **Cognateへの取り込み時に行われた、カーネルの3つの修正。** コンパイルキャッシュは、ポリシーのバージョンのみをキーとして使用するため、1つのバージョンを持つが異なる重みを持つ2つのポリシーは、同じルールを取得していました（キャッシュは削除されました）。決定は、これで再現できます。また、失敗したプランは、マイナス無限大ではなく、`null`のスコアになります。これにより、JSONのラウンドトリップ中にトレースが保持されます。
- **npmから解決される型。** 1.0.0バンドルの型宣言は、npmにないワークスペースパッケージを指していたため、TypeScriptプロジェクトでは、すべてのサブパスで型が解決されませんでした。1.1.0では、これらの宣言がバンドル内に含まれており、CIは、パッケージ化されたバンドルを空のプロジェクトにインストールし、すべてのエントリからのインポートの型チェックを実行します。

完全なリストは、[CHANGELOG.md](CHANGELOG.md)にあります。

### 1.0.0で導入された機能

- **実行レコード。** `@cognate/model-registry`は、実行を開始する前に実行を事前登録し、その結果を`cognate-<tenant>-runs`ストリームに記録します。アカウント名の識別子は、SHA-256ダイジェストとしてのみ保存され、実行は独自のコストを記録しますが、アカウント残高は記録しません。
- **評価。** モデルバージョンには、任意の数の評価（実行、そのレプリケーション、プールされた結果）が含まれており、トランジションは、それに基づいて評価されたものを参照します。`requireEvaluationCitations`は、どのトランジションが参照する必要があるかを設定します。承認されたバージョンは、デプロイされる前に拒否できます。
- **テナントのスコープ。** `@cognate/node`のすべてのルートは、呼び出し元のテナント内で動作します。別のテナントを名前で参照するレコードは拒否され、別のテナントのIDは、存在しないIDと同じ結果になります。存在しないIDは、現在404であり、400ではありません。
- **署名付きリクエスト（破壊的変更）。** すべての書き込みとすべての`GET /events/:eventId`は、呼び出し元のEd25519キー（`cognate-request-v1`）で署名する必要があり、タイムスタンプウィンドウとリプレイ保護が必要です。すべてのルートの実行者は、検証済みの署名者です。エージェントの登録と許可の承認には、`delegate`機能が必要であり、オペレーターが提供するテナントのルートキーが、各テナントの最初のデリゲートをブートストラップします。[認証と移行ガイド](#認証と移行ガイド)を参照してください。
- **ルートキーの権限をわかりやすく説明します。** ドキュメントには、ブートストラップ後にテナントのルートが実行できるすべての操作がリストされており、テストシードから派生したルートは、本番環境で構成してはならないことが記載されています。
- **テストツールチェーン。** vitest 4.1.12およびvite 8.3.5。開発ツリー内の高および重大なアドバイザリは、ルートでクリアされ、無視またはオーバーライドは行われません。

---

## ミッション

AIシステムが自律性を獲得するにつれて、それらを管理する構造は、より厳格でなければならないと私たちは考えています。スマートコントラクトは実行されます。モデルは推論します。しかし、AIが何を実行することを許可され、実際に何を実行し、人間がそれを承認したかを*証明*するものは何もありません。

Cognateは、不足しているレイヤーです。モデルレジストリ、ポリシーの適用、エージェントのID、および決定的な監査を、モデル、組織、およびチェーン全体で統合します。

### 私たちの価値観

- **速度よりも真実。** すべてのモデル推論は、追加専用、リプレイ可能、および調整可能です。証明できない場合、それは起こらなかったことになります。
- **人間が承認し、機械が検証します。** AIはアドバイスし、モデルは推論しますが、明示的な人間の承認なしに、何もデプロイまたは実行されることはありません。
- **構造的なガバナンス、政治的なガバナンスではありません。** 有効かどうかを投票で決定することはありません。無条件に保持される不変性を定義します。モデルのIDは明示的であり、系統は途切れておらず、ポリシーバージョンは単調です。
- **意図は実行ではありません。** エージェントが何をするべきかを宣言し、それを実行させることは、別々のゲートを持つ別々の行為です。それらの間のギャップに信頼が存在します。
- **モデルは証人であり、権威ではありません。** Attestiaは証明します。チェーンは決済します。しかし、権限は構造的なルールから流れ、モデルの重みからは流れません。

---

## アーキテクチャ

Cognate は Attestia の基本的な要素を利用し、AI ネイティブのドメイン層を追加します。ライブラリは、渡された状態を受け取ります。いくつかの関数は、この範囲外にアクセスします。具体的には、`transitionVersion`と`feedbackFromMcpResult`は現在の時刻を記録し、カーネルの`decide`と`decideAsync`はクロックを読み取り、両方の`decisionId`と`timestamp`が渡されない限り、ランダムなIDを生成します。また、`verifyRelease`はクロックとRepoMeshの台帳を、ネットワーク経由またはローカルディレクトリから読み取ります。これ以外に、ソケットを開いたり、ファイルに書き込んだり、クロックを読み取ったりする処理はありません。

| パッケージ | 目的 | ステータス |
|---------|---------|--------|
| @cognate/types | 共有 AI ガバナンスドメインタイプ（依存関係なし） | 準備完了 |
| @cognate/policy | セマンティックポリシー評価エンジン | 準備完了 |
| @cognate/civility-kernel | プランの選択：厳格な制約に基づいて候補プランをフィルタリングし、優先度に基づいてスコアリングを行い、実行または問い合わせる | 準備完了（バージョン 1.1.0 で追加） |
| @cognate/model-registry | モデルのライフサイクル、バージョン管理、評価 | 準備完了 |
| @cognate/agent-identity | エージェントの識別情報、機能、権限 | 準備完了 |
| @cognate/prompt-store | 暗号化されたイベントによるプロンプト/出力のロギング | 準備完了 |
| @cognate/repomesh-bridge | RepoMesh リリースチェック（`verifyRelease`）をデプロイ前に実行 | 準備完了 |
| @cognate/node | 署名されたリクエストとテナントのスコープを持つ、ポート 4000 での HTTP API サーバー | 準備完了 |

`@mcptoolshop/cognate` は npm にバンドルされており、その中に型定義が含まれています。`@cognate/node` は Docker イメージ内で実行されます。

### 2 つの段階：プランを選択してから、各イベントをゲートする

Cognate は、エージェントを 2 つのポイントで管理します。

1. **エージェントがアクションを実行する前に、`@cognate/civility-kernel` がプランの中から選択します。** エージェントは候補プランを提案します。厳格な制約により、ルールに違反するプラン（不可逆的な変更、制限を超える支出など）が削除されます。残ったプランは、ポリシーの優先度に基づいてスコアリングされます。最も評価の高いプランが実行されます。ただし、その不確実性がポリシーの閾値を超える場合は、エージェントが問い合わせを行います。いずれのプランも残らない場合、エージェントはユーザーに制約の緩和または別のオプションの提案を求めます。
2. **エージェントがアクションを実行している間、`@cognate/policy` は各イベントをゲートします。** すべてのプロンプト、出力、または支出は、テナントのルール（コンテンツフィルター、レート制限、支出制限、機能）に対してチェックされ、一致したルールのうち最も厳しいものが優先されます。

決定は記録およびハッシュ化できます。`attestDecision` は `cognate.policy.decided` をテナントのポリシー ストリームに追加し、ダイジェストと決定の概要を伝達します。プランのステップは伝達されません。`computeDecisionDigests` は、実行前の登録（`preRegisterRun`）で求められる `planSha256` と `decisionSha256` を提供します。`decisionId` と `timestamp` を渡すと、同じ入力でバイト単位で同一のトレースが生成されます。

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

ポリシーは、カーネル自身のループを通じて変更され、各ステップは人間が承認します。`proposePolicyUpdates` はフィードバックから、次に `diffPolicy`、`lintPolicy`、`explainPolicy` を経て変更が適用されます。

### 規制への準拠

| 規制 | Cognate が準拠する項目 |
|------------|-------------------|
| EU AI 法案第 12 条 | システム全体のライフサイクルにわたる、追加のみを許可するイベントロギング |
| EU AI 法案第 14 条 (5) | 検証における個人の識別 |
| NIST AI RMF | ガバナンス、マッピング、測定、管理機能 |
| ISO/IEC 42001 | AI 管理システム要件 |

---

## 原則

| 原則 | 実装 |
|-----------|---------------|
| 追加のみを許可するレコード | UPDATE や DELETE はなく、新しいエントリのみ |
| フェイルクローズ | ポリシーの不一致はシステムを停止させ、サイレントに回復することはありません |
| 決定的なリプレイ | 同じイベントは常に同じ状態を生成します |
| 人間の承認ゲート | 明示的な承認なしにモデルをデプロイしたり、ポリシーを変更したり、機能を付与したりすることはありません |
| 暗号化されたプロンプト | プライバシーのためのテナントキーによる AES-256-GCM、および整合性のための SHA-256 ハッシュ |
| 構造的な識別 | 明示的、不変、一意 — モデル、エージェント、およびポリシー用 |

---

## クイックスタート

### npm からライブラリを使用する

```bash
npm install @mcptoolshop/cognate
```

ポリシーを評価します。エンジンは状態を取得したり、クロックを読み取ったりしません。ポリシーとコンテキストを渡します。これを `quickstart.mjs` として保存し、`node quickstart.mjs` を実行します。これにより、`deny` が出力されます。

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

各ライブラリは、バンドルのサブパスです。`@mcptoolshop/cognate/policy`、`/civility-kernel`、`/model-registry`、`/agent-identity`、`/prompt-store`、`/repomesh-bridge`、および `/types` です。以下の例では、ワークスペース名（`@cognate/policy` など）を使用しており、これは同じコードです。

### このリポジトリから HTTP サーバーを実行します

`@cognate/node` は npm にはありません。クローンから実行します（Node 22 以降、pnpm 10.28.2）。

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

次に、別のターミナルから、`curl http://127.0.0.1:4000/health` が `"status": "ok"` に応答します。`make-tenant-root.mjs` は、テナントの新しいランダムなルートキーを作成します。`tenant-roots.json` には、サーバーが読み取る公開キーが格納され、`tenant-root.secret.json` には、テナントの最初の委任に署名するために使用する秘密シードが格納されます。両方の名前は `.gitignore` にあります。`tenant-root.secret.json` をリポジトリやイメージに含めないでください。サーバーには `tenant-roots.json` のみが必要です。スクリプトは、プラットフォームがサポートしている場合に、秘密ファイルがその所有者のみが読み取り可能になるようにします（Windows の場合は、読み取り専用のフォルダーに保存します）。完全な形式は `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]` です。スクリプトは、既存の `tenant-roots.json` または `tenant-root.secret.json` を置き換えることを拒否します。何も書き込まず、コード `exists` で 1 を返して終了します。両方を意図的に置き換える場合は、`--force` のみを渡してください。古い秘密シードは復元できません。リクエストへの署名は、[移行ガイド](#認証と移行ガイド) で説明されています。

### 開発

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

モデルのバージョンを登録し、そのライフサイクル全体を処理します。バージョンは`registered → evaluated → approved → deployed`を移動し、`rejected`または`retired`になります。`transitionVersion`は、呼び出し元が保持するスナップショットを移動させます。HTTPサーバーでは、`approved → deployed`が、バージョンが登録されたときに記録された`repo`と`release`に対して`verifyRelease`を呼び出します。承認されないリリースはデプロイされず、異なるリリースを指定するリクエストもデプロイされません。拒否の記録が残ります。

評価は、存在するバージョンの数だけ関連付けられます。実行、その複製、プールされた結果などです。**評価を記録し、次にそれを参照して移行します。** `recordEvaluation`（または`attestEvaluation`、これも`cognate.evaluation.recorded`を追加します）は、バージョン自体を移動させないため、すべての呼び出しは1回の追加操作になります。移行の`evaluationIds`は、決定の根拠となる評価を示します。それぞれは、そのバージョンに記録する必要があり、IDは移行の系統ハッシュにバインドされます。承認されたバージョンでも、デプロイされる前に拒否される可能性があります。移行で参照が必要かどうかは設定項目です。`requireEvaluationCitations`：`false`（デフォルト）、`"decisions"`（承認と拒否の両方で参照が必要）、または`"all"`。HTTPサーバーは、これを`COGNATE_REQUIRE_EVALUATION_CITATIONS`から読み取り、他の値では起動を拒否します。

実行を起動する前に事前に登録し、その結果を`cognate-<tenant>-runs`ストリームに記録します。アカウント名識別子（`ggufRepoSha256`、`hostedRepoSha256`、`repoSha256`、`ggufSourceSha256`、`hfRepoSha256`、`githubOwnerSha256`、`emailSha256`、`homePathSha256`）は、64文字の小文字の16進数SHA-256ダイジェストとしてのみ保存され、実行は自身の`cost`（`unitsSpent`、`rate`、`basis`）をアカウント残高ではなく記録します。

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

このイメージは`@cognate/node`を実行し、ガバナンスAPIを提供します。

**サーバーは起動する前にテナントのルートファイルが必要です。** デフォルトの`enforce`モードでは、ファイルがないと起動を拒否し、イメージにはルートキーは含まれません。`node scripts/make-tenant-root.mjs my-tenant`を使用して作成します（[クイックスタート](#このリポジトリから-http-サーバーを実行します)を参照）、または、次の形式の独自のJSONを記述します。`{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`。同梱されている`docker-compose.yml`は、`COGNATE_TENANT_ROOTS_PATH`を`/run/cognate/tenant-roots.json`に設定し、マウントをコメント付きのボリューム行として表示します。ファイルのホストパスを使用してその行のコメントを解除するか、その横に`docker-compose.override.yml`を追加します。

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

ファイルがない場合、サーバーはAPIのエラー形式（`auth.missing-tenant-roots`、ヒント付き）でJSONエラー行を1つ出力して、終了コード1で終了します。`COGNATE_DEBUG=1`を設定して、スタックを追加します。

実行が開始されると、`/health`は次の値を返します。

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`cognate-data`ボリュームは`/app/data`にマウントされます。イベントログは`/app/data/events.jsonl`です。スナップショットは`/app/data/cognate/registry.json`、`/app/data/cognate/agents.json`、および`/app/data/cognate/prompts.json`です。`GET /events/:eventId`は、そのログを読み取り、記録されたイベントをAttestiaの包含証明とルートとともに返します。呼び出し元は、書き込みと同じ署名された`cognate-request-v1`ヘッダーを送信します。このテナントのログにないIDはエラーであり、本文には証明が含まれません。プロンプトと出力テキストはイベントから除外されます。このルートはRepoMeshを呼び出しません。Attestiaのコンポーズは、独自のボリュームで同じイベントログ変数を使用します。各ファイルには1つの書き込みプログラムがあります。RepoMeshのイメージは、このログをマウントしません。`REPOMESH_FAIL_ON`はデフォルトで`unverified`です。PASSのみがデプロイされます。UNVERIFIEDのリリースを許可するには、これを`fail`に設定します。イメージは、レジスターURLを設定しません。イメージは、npmパッケージが公開された後、`v*`タグからリリースワークフローによって構築され、`ghcr.io/mcp-tool-shop-org/cognate`に`X.Y.Z`、`X.Y`、および`sha-*`としてプッシュされます。`latest`は、`v*`タグでのみ移動します。

---

## 認証と移行ガイド

### 1.1.0で強制されること（1.0.0以降は変更なし）

- **Ed25519リクエスト署名（`cognate-request-v1`）。** デフォルトでは（`signedRequests: "enforce"`）、すべての`POST`と`GET /events/:eventId`は、8行の標準リクエスト文字列（`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`）にわたって、`X-Agent-Id`、`X-Timestamp`、`X-Nonce`、`X-Key-Id`、および`X-Signature`を含める必要があります。`POST`本文は、RFC 8785 JCS標準のUTF-8（それ以外の場合は`400 auth.body-not-canonical`）である必要があります。`kid`は、生の32バイトEd25519公開キーの64文字の小文字の16進数SHA-256です。
- **順序付けられたリプレイ保護と一貫した401。** `X-Timestamp`は、サーバー時間（`GET /health`は`serverTime`を公開します）から±300秒以内である必要があります。インメモリのリプレイストアは、署名の検証前に読み取り専用の`(agentId, nonce)`をチェックし、署名の検証後にのみ記録し、完全な600秒の有効期間にわたって保持します。署名前のすべての認証失敗は、同一の`401`を`code: "auth.unauthenticated"`とともに返します。
- **アクターのバインド（`403 auth.actor-mismatch`）。** すべてのルートのアクター（`transition.actorId`、`evaluation.evaluator`、`grant.requestedBy`、`grant.capability.grantedBy`、`approverId`、`agent.owner`、`prompt.agentId`、`model.owner`、`context.actorId`、`context.agentId`、および`context.agentCapabilities`）は、RepoMeshまたはイベントの追加の前に、検証された署名者にバインドされます。
- **権限昇格のガードとルートキーのブートストラップ。** エージェントの登録（`POST /identity/agents`）と承認の許可（`POST /identity/grants/:id/approve`）には、アクティブな`delegate`機能が必要です。自己承認は拒否されます（`403 auth.self-approval-forbidden`）。事前に設定された`agent.capabilities`は、テナントのオペレーターが提供するルート公開キー（`tenantRootsPath`または`COGNATE_TENANT_ROOTS_PATH`）がテナントの最初の`delegate`をブートストラップする場合を除き、拒否されます。ルートは、ブートストラップ時にのみ、`delegate`を直接ミントまたは承認し、テナントがアクティブな`delegate`を持たないようにします。設計により、テナントのルートは、ブートストラップ後もリカバリ権限を保持します（人間のプリンシパルまたはエージェントのプリンシパルのキーをローテーションし、プリンシパルをすべて取り消し、非委任の許可を承認し、侵害されたルートからのリカバリは、レビューされた構成でそれを置き換え、テナントの委任エージェントに再署名することです）。キーをローテーションすると、そのプリンシパルの権限が新しいキーを保持する人に移り、ルートは新しいキーを選択します。したがって、ルートが人間の委任者のキーをローテーションした後、ルートはその委任者の権限（新しい委任者の登録や`delegate`の許可など）を保持します。また、ルートがアクティブな`delegate`をすべて取り消すと、テナントは再びアクティブな`delegate`を持たなくなるため、ルートは再び直接ミントできます。テストシードから派生したルートは、本番環境で構成してはなりません。サーバーは、テストハーネスが`allowTestOnlyRoots: true`を設定しない限り、起動時にリポジトリ自体のテストルートキーを拒否します（`auth.test-only-root-key-forbidden`）が、デプロイメントの外部で知られている他のシードから派生したルートを認識することはできません。テナントのルートキーはリポジトリまたはDockerイメージに含まれておらず、サーバーはオペレーターが提供するルートがない場合、`enforce`モードで起動を拒否します（`auth.missing-tenant-roots`）。エージェントプリンシパル（`principal: "agent"`）は、人間のプリンシパル（`principal: "human"`）を登録したり、`delegate`を許可したりすることはできません。また、`owner`は、人間のプリンシパルのキーをローテーションすることはできません。キーのローテーション（`POST /identity/agents/:id/key`）と取り消し（`POST /identity/agents/:id/revoke`）は、古い`kid`を直ちに無効にします。

### まだではありません。現在の制限

- **単一インスタンスの再現ストア。** `(agentId, nonce)` 再生ストアは、単一の `@cognate/node` プロセス上でインメモリで実行されます。複数のインスタンスをデプロイした場合、再生状態は共有されません。
- **分離された承認、IDストリーム、オフライン検証は、今後のリリースで提供される予定です。** 現在、承認が必要なアクションは、承認を行う担当者によって直接署名される必要があります。分離された `cognate-approval-v1` 承認（エージェントが、別の人間の署名を含むトランジションを送信できるようにする）、永続的な `approvalId` コンシューマー、認証された `cognate-<tenant>-identity` イベントストリーム、`submittedBy` / `authorizedBy` イベントフィールド、スタンドアロンのオフライン検証ツール、および RepoMesh ルートキーアンカーは、1.1.0には含まれていません。
- **IDは、すべてのテナント間でグローバルです。** 別のテナントがすでに所有しているIDを登録しようとすると、重複として拒否されます。

### 既存のエージェントをEd25519キーに移行する

1. **`@cognate/node` から `generateEd25519KeyPair()` を使用して、Ed25519 キーペアを生成します**（このリポジトリ内。`@cognate/node` は npm にはありません）。
```ts
import { generateEd25519KeyPair, createSignedClient } from "@cognate/node";

const keyPair = generateEd25519KeyPair();
// keyPair.publicKey (43 文字の base64url 生の 32 バイトのキー)、keyPair.kid (64 文字の sha256 16 進数)、keyPair.seedHex
```
2. **オペレーターテナントのルート公開鍵を構成し、テナントの最初の委任をブートストラップします。** JSON ルートキーファイルを `COGNATE_TENANT_ROOTS_PATH`（または `ServerContext.tenantRootsPath` / `ServerContext.tenantRoots`）経由で提供し、テナントにアクティブな `delegate` がない間に、そのテナントのルートキーで `POST /identity/agents` に署名します（または、エージェントを `publicKey` と `kid` でシードし、起動前に `agents.json` に配置します）。 `packages/node/tests/fixtures/` のテスト専用のフィクスチャキーは、`allowTestOnlyRoots: true` が明示的に設定されていない限り、起動時に拒否されます。
3. **`createSignedClient` または `signHttpRequest` でリクエストに署名します。**
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
`createSignedClient` は、RFC 8785 JCS を使用して JSON ボディを正規化し、各リクエストに署名し、`GET /health` の `serverTime` からクロックオフセットを自動的に同期し、クロックのずれが `401` を引き起こす場合は、1 回再試行します。
4. **オプションの移行ウィンドウ（`signedRequests: "log"`）：** 呼び出し元が移行する間に、一時的に署名されていない非 `/identity/*` リクエストを受け入れるには、`COGNATE_SIGNED_REQUESTS=log` と `COGNATE_SIGNED_REQUESTS_LOG_UNTIL=<RFC3339 UTC timestamp <= 14 days ahead>` を設定します。 `log` モードで署名されていないリクエストから記録されたイベントには、`unsigned: true` が含まれます。

---

## 脅威モデル

Cognateは、以下の脅威モデルを想定しています。

1. **侵害された推論エンドポイント。** 攻撃者がモデルAPIへのアクセス権を取得します。軽減策：すべてのプロンプトと出力は、暗号化されたペイロードとSHA-256の整合性ハッシュとともにログに記録されます。再生は決定論的です。
2. **不正なエージェントまたは偽造された呼び出し元ID。** 軽減策：すべてのHTTP書き込みと`/events/:eventId`読み取りは、Ed25519署名（`cognate-request-v1`）、±300秒のタイムスタンプチェック、および600秒のnonce再生ストアで認証されます。機能は、時間制限、範囲制限、および取り消し可能（`POST /identity/agents/:id/revoke`、`POST /identity/agents/:id/key`）であり、すべてのルートは、そのボディのアクターフィールドを検証された署名者にバインドします（`403 auth.actor-mismatch`）。制限：再生ストアはプロセスごとにインメモリにあり、分離されたマルチパーティ承認（`cognate-approval-v1`）とオフラインのイベントストリーム署名検証は、1.1.0には含まれていません。
3. **サプライチェーンにおけるモデルの改ざん。** 評価後に、重みまたは構成が置き換えられます。軽減策：モデルレジストリは、登録時に重み、構成、およびマニフェストにハッシュを付け、`ModelVersion.repo`を`sha256:<hex>`として保存します。逸脱があると、バージョンが無効になります。
4. **プロンプトインジェクションによるポリシーの回避。** 敵対的なプロンプトが、コンテンツルールを回避しようとします。軽減策：ポリシー評価は、決定論的で、バージョン管理されており、推論の前に実行されます。ポリシーチェックに合格しないプロンプトは実行されません。
5. **監査ログの不正な使用。** 特権のあるオペレーターがログを改ざんします。軽減策：イベントストアは、追加専用であり、AttestiaのMerkleツリーの証明によってバックアップされます。改ざんは、チェーンハッシュを壊します。
6. **HTTPサーバーにおけるクロステナントアクセス。** あるテナントのエージェントが、別のテナントのレコードにアクセスします。軽減策：すべてのルートは、認証された署名者のテナント内で動作します。別のテナントの名前が設定されたレコードは拒否され、別のテナントのIDは存在しないものとして回答されます。
7. **誤用または誤って構成されたテナントルートキー。** ルートキーは、テナントをブートストラップし、その後も回復の権限を保持します。軽減策：ルートキーは、リポジトリまたはイメージに同梱されていません。サーバーは、オペレーターが提供するルートがない状態で`enforce`モードで起動することを拒否し、リポジトリ自体のテストルートキーも拒否します。制限：ルートの権限は、設計上広範囲に及ぶため（上記参照）、オペレーターは、テナント自体と同様に、ルートキーを慎重に保持する必要があり、侵害されたルートからの回復は、レビューされた構成でそれを置き換えることを意味します。

テレメトリや分析はありません。HTTPサーバーへのデプロイでは、名前が指定されたリリースが合格するかどうかをRepoMeshに問い合わせます。ヘルスチェックとその他のルートは、このプロセス上で実行されます。セキュリティレポートは、[SECURITY.md](SECURITY.md)を通じて送信されます。

---

## ステータス

バージョン1.1.0、公開ビルド。すべてのパッケージは実装・テスト済みで、ビルドに成功しています。バンドルを`npm install @mcptoolshop/cognate`でインストールします。`@cognate/*`の名前は、このリポジトリに保持されます。

| ゲート | ステータス |
|------|--------|
| ビルド | 合格 |
| テスト | 490個合格（civility-kernel 164、node 157、model-registry 58、policy 47、agent-identity 29、prompt-store 24、repomesh-bridge 9、cognate 2） |
| カバレッジ | 行：civility-kernelでは91.9％、nodeでは94.3％、policyでは93.4％、model-registryでは99.6％、およびagent-identity、prompt-store、repomesh-bridgeでは100％。これらの7つのパッケージそれぞれで、vitestの行の最低基準は90以上。 |
| 型チェック | クリーンで、パックされたバンドルは、空のプロジェクトで、`bundler`と`node16`のモジュール解決の両方で型チェックされます。 |
| Docker | イメージは、ガバナンスAPIを提供します。ボリュームには、イベントログと3つのスナップショットが保存されます。 |
| 出荷チェック | すべてのハードゲートに合格（16/16で確認済み） |

---

[mcp-tool-shop](https://mcp-tool-shop.github.io/)によってビルドされました。
