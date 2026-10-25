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

**バージョン1.0.0。** 以前のリリースは0.1.8でした。0.2.0と0.3.0は個別に公開されず、その変更は1.0.0に含まれています。1.0.0ではHTTP APIが変更されました。サーバーは、署名されていないリクエストを拒否するようになりました。1.0以降、バージョンはセマンティックバージョニングに従います。HTTP API、署名付きリクエスト形式、またはイベントとアテステーション形式を破壊する変更には、新しいメジャーバージョンが伴います。[1.0.0の新機能](#100の新機能)を参照してください。

Cognateは、[Attestia](https://github.com/mcp-tool-shop-org/attestia)上に構築されたAIガバナンス層です。Attestiaは、何らかのイベント、トランザクション、状態遷移が発生したことを証明し、その証明をチェーンにバインドします。Cognateは、同じアテステーションプリミティブを使用してAIシステムを管理します。モデルが何を実行することを許可され、実際に何を実行し、誰がそれを承認したかを管理します。

Cognateは、AIの真実性をアテステーションします。モデルの系統、ポリシー決定、エージェントの機能、プロンプトと出力の整合性。同じMerkle証明。同じ追加専用のイベントストア。異なるドメイン。

Attestia、Cognate、およびRepoMeshは、3つの製品です。Attestiaは、これらのプリミティブの上に、金融ドメイン（個人用ウォールト、組織の財務、レジストラム）を構築します。RepoMeshはリリースネットワークです。署名付きイベント、ノードマニフェスト、およびXRPLにアンカーされた信頼クロックが、独自のRFC 6962レジャー上に存在します。AttestiaのMerkleツリーは使用しません。Cognateは、証明が必要な場合にAttestiaを呼び出し、リリースチェックが必要な場合にRepoMeshを呼び出します。`@cognate/repomesh-bridge`がそのチェックです。

---

## 1.0.0の新機能

- **実行レコード。** `@cognate/model-registry`は、実行を開始する前に実行を事前に登録し、その結果を`cognate-<tenant>-runs`ストリームに記録します。アカウント名識別子は、常にSHA-256ダイジェストとしてのみ保存され、実行は独自のコストを記録し、アカウント残高は記録しません。
- **評価。** モデルバージョンは、任意の数の評価（実行、その複製、プールされた結果）を含み、移行は、それが依存する評価を参照します。`requireEvaluationCitations`は、どの移行を参照する必要があるかを定義します。承認されたバージョンは、デプロイされる前に拒否できます。
- **テナントのスコープ。** `@cognate/node`上のすべてのルートは、呼び出し元のテナントのコンテキストで動作します。別のテナントを参照するレコードは拒否され、別のテナントのIDは、存在しないIDと同じ結果になります。存在しないIDは、400ではなく、404になります。
- **署名付きリクエスト（破壊的変更）。** すべての書き込みとすべての`GET /events/:eventId`は、呼び出し元のEd25519キー（`cognate-request-v1`）で署名する必要があり、タイムスタンプウィンドウとリプレイ保護が必要です。すべてのルートの実行者は、検証済みの署名者です。エージェントの登録と許可の承認には、`delegate`機能が必要であり、オペレーターが提供するテナントルートキーが、各テナントの最初のデリゲートをブートストラップします。[認証と移行ガイド](#認証と移行ガイド)を参照してください。
- **ルートキーの権限（平易な言葉で）。** ドキュメントには、ブートストラップ後にテナントルートが実行できるすべての操作がリストされており、テストシードから派生したルートは、本番環境で構成してはならないと記載されています。
- **テストツールチェーン。** vitest 4.1.12とvite 8.3.5。開発ツリー内の高および重大なアドバイザリは、ルートでクリアされ、無視またはオーバーライドは行われません。

完全なリストは、[CHANGELOG.md](CHANGELOG.md)にあります。

---

## ミッション

AIシステムが自律性を獲得するにつれて、それらを管理する構造は、より厳格でなければならないと私たちは考えています。スマートコントラクトは実行されます。モデルは推論します。しかし、AIが何を実行することを許可され、実際に何を実行し、人間がそれを承認したかを*アテステーションする*ものは何もありません。

Cognateは、不足している層です。モデルレジストリ、ポリシーの強制、エージェントのID、および決定的な監査。これらはすべて、モデル、組織、およびチェーン全体で統合されています。

### 私たちが支持するもの

- **速度よりも真実。** すべてのモデル推論は、追加専用、リプレイ可能、および調整可能です。証明できない場合、それは発生しません。
- **人間が承認し、機械が検証します。** AIはアドバイスし、モデルは推論しますが、明示的な人間の承認なしに、何もデプロイまたは実行されることはありません。決して。
- **構造的ガバナンス、政治的ガバナンスではありません。** 私たちは、何が有効であるかを投票で決定しません。私たちは、無条件に保持される不変性を定義します。モデルのIDは明示的であり、系統は途切れておらず、ポリシーバージョンは単調です。
- **意図は実行ではありません。** エージェントが何をするべきかを宣言し、それを実行させることは、別々のゲートを持つ別々の行為です。それらの間のギャップに信頼が存在します。
- **モデルは証人であり、権威ではありません。** Attestiaはアテステーションします。チェーンは決済します。しかし、権限は、構造的なルールから流れ、どのモデルの重みからも流れません。

---

## アーキテクチャ

Cognateは、Attestiaプリミティブを消費し、AIネイティブのドメイン層を追加します。パッケージは純粋な関数です。呼び出し元は状態を提供します。ここに記述されているものの中で、ソケットを開いたり、ファイルに書き込んだり、クロックを読み取ったりするものはありません。ただし、値を渡した場合を除きます。

| パッケージ | 目的 | ステータス |
|---------|---------|--------|
| @cognate/types | 共有AIガバナンスドメインタイプ（依存関係なし） | 準備完了 |
| @cognate/policy | セマンティックポリシー評価エンジン | 準備完了 |
| @cognate/model-registry | モデルライフサイクル、バージョン管理、評価 | 準備完了 |
| @cognate/agent-identity | エージェントのID、機能、許可 | 準備完了 |
| @cognate/prompt-store | 暗号化されたイベントによるプロンプト/出力ロギング | 準備完了 |
| @cognate/repomesh-bridge | RepoMeshリリースチェック（`verifyRelease`）をデプロイ前に実行 | 準備完了 |
| @cognate/node | 署名付きリクエストとテナントのスコープを備えた、ポート4000のHTTP APIサーバー | 準備完了 |

`@mcptoolshop/cognate`はnpmにライブラリをバンドルします。`@cognate/node`はDockerイメージで実行されます。

### 規制への適合

| 規制 | Cognateが満たすもの |
|------------|-------------------|
| EU AI法第12条 | システム全体のライフサイクルにわたる追加専用のイベントロギング |
| EU AI法第14条（5） | 検証における自然人の識別 |
| NIST AI RMF | ガバナンス、マッピング、測定、管理機能 |
| ISO/IEC 42001 | AI管理システム要件 |

---

## 原則

| 原則 | 実装 |
|-----------|---------------|
| 追加専用レコード | UPDATEもDELETEもありません。新しいエントリのみ。 |
| フェイルクローズ | ポリシーの不一致によりシステムが停止し、自動的に解決されることはない |
| 決定論的なリプレイ | 同じイベントは常に同じ状態を生み出す |
| 人間の承認ゲート | 明示的な承認なしに、モデルのデプロイ、ポリシーの変更、機能の付与は行われない |
| 暗号化されたプロンプト | プライバシーのためにテナントキーを使用したAES-256-GCM、整合性のためにSHA-256ハッシュを使用 |
| 構造的なアイデンティティ | 明示的、不変、一意 — モデル、エージェント、ポリシー用 |

---

## クイックスタート

### npmのライブラリを使用する

```bash
npm install @mcptoolshop/cognate
```

ポリシーを評価する。エンジンは状態を取得したり、システム時刻を読み取ったりしない。ポリシーとコンテキストを渡す。これを`quickstart.mjs`として保存し、`node quickstart.mjs`を実行する。結果は`deny`に出力される。

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

各ライブラリは、バンドルのサブパスである：`@mcptoolshop/cognate/policy`、`/model-registry`、`/agent-identity`、`/prompt-store`、`/repomesh-bridge`、および`/types`。以下の例では、ワークスペース名（`@cognate/policy`など）を使用しているが、これらはすべて同じコードである。

### このリポジトリからHTTPサーバーを実行する

`@cognate/node`はnpmにはない。クローンから実行する（Node 22以降、pnpm 10.28.2）：

```bash
pnpm install
pnpm -r build
node scripts/make-tenant-root.mjs my-tenant
COGNATE_TENANT_ROOTS_PATH="$PWD/tenant-roots.json" node packages/node/dist/index.js
```

次に、別のターミナルから、`curl http://127.0.0.1:4000/health` が `"status": "ok"` に応答します。`make-tenant-root.mjs` は、テナントに対して新しいランダムなルートキーを作成します。`tenant-roots.json` には、サーバーが読み取る公開キーが格納され、`tenant-root.secret.json` には、テナントの最初の委任に署名するために使用する秘密シードが格納されます。両方の名前は `.gitignore` にあります。`tenant-root.secret.json` をリポジトリやイメージから除外し、サーバーが必要とするのは `tenant-roots.json` のみです。スクリプトは、プラットフォームがそれをサポートしている場合にのみ、秘密ファイルがその所有者によってのみ読み取り可能になるようにします（Windows の場合は、あなただけが読み取り可能なフォルダーに保存します）。完全な形式は `node scripts/make-tenant-root.mjs <tenantId> [outDir] [--force]` です。スクリプトは、既存の `tenant-roots.json` または `tenant-root.secret.json` を置き換えることを拒否します。何も書き込まず、コード `exists` で 1 を返して終了します。両方を意図的に置き換える場合にのみ、`--force` を渡してください。古い秘密シードは復元できないためです。署名リクエストについては、[移行ガイド](#認証と移行ガイド) を参照してください。

### 開発

```bash
pnpm install
pnpm verify        # build + test + typecheck
pnpm test:coverage # full coverage report
```

モデルバージョンを登録し、ライフサイクル全体で実行する。バージョンは`registered → evaluated → approved → deployed`に移行し、`rejected`または`retired`になる可能性がある。`transitionVersion`は、呼び出し側が保持するスナップショットを移動する。HTTPサーバーでは、`approved → deployed`が、バージョンが登録されたときに記録された`repo`と`release`に対して`verifyRelease`を呼び出す。承認されないリリースはデプロイされず、異なるリリースを参照するリクエストもデプロイされない。拒否は記録される。

評価はバージョンにアタッチされ、バージョンがいくつあるかによって評価の数も変わる：実行、そのレプリケーション、プールされた結果。**評価を記録し、それを参照して移行する。** `recordEvaluation`（または`attestEvaluation`、これも`cognate.evaluation.recorded`を付加する）は、バージョン自体を移動させないため、すべての呼び出しは1つの付加操作となる。移行の`evaluationIds`は、決定の根拠となる評価の名前を示す。それぞれがそのバージョンに記録されており、IDは移行の系統ハッシュにバインドされている。承認されたバージョンでも、デプロイされる前に拒否される可能性がある。移行で参照が必要かどうかは、設定`requireEvaluationCitations`によって決まる：`false`（デフォルト）、`"decisions"`（承認と拒否の両方で参照が必要）、または`"all"`。HTTPサーバーは、これを`COGNATE_REQUIRE_EVALUATION_CITATIONS`から読み取り、他の値で起動しない。

起動前に実行を事前に登録し、その結果を`cognate-<tenant>-runs`ストリームに記録する。アカウント名識別子（`ggufRepoSha256`、`hostedRepoSha256`、`repoSha256`、`ggufSourceSha256`、`hfRepoSha256`、`githubOwnerSha256`、`emailSha256`、`homePathSha256`）は、64文字の小文字の16進数ダイジェストSHA-256としてのみ保存され、実行はアカウント残高ではなく、自身の`cost`（`unitsSpent`、`rate`、`basis`）を記録する。

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

このイメージは`@cognate/node`を実行し、ガバナンスAPIを提供する。

**サーバーは起動する前にテナントのルートファイルが必要。** デフォルトの`enforce`モードでは、ファイルがないと起動を拒否し、イメージにはルートキーは含まれない。`node scripts/make-tenant-root.mjs my-tenant`を使用して作成する（[クイックスタート](#このリポジトリからhttpサーバーを実行する)を参照）か、次のような独自のJSONを作成する：`{ "version": 1, "roots": [{ "tenantId", "actorId", "publicKey", "kid" }] }`。同梱されている`docker-compose.yml`は、`COGNATE_TENANT_ROOTS_PATH`を`/run/cognate/tenant-roots.json`に設定し、マウントをコメント付きのボリューム行として表示する。ファイルが配置されているホストパスでその行のコメントを解除するか、その横に`docker-compose.override.yml`を追加する：

```yaml
services:
  cognate-node:
    volumes:
      - ./tenant-roots.json:/run/cognate/tenant-roots.json:ro
```

ファイルがない場合、サーバーはAPIのエラー形式（`auth.missing-tenant-roots`、ヒント付き）でJSONエラー行を1つ出力し、終了コード1で終了する。`COGNATE_DEBUG=1`を設定してスタックを追加する。

実行すると、`/health`は次を返す：

```json
{ "status": "ok", "service": "cognate", "mode": "api", "serverTime": "2026-10-24T12:00:00.000Z" }
```

```bash
docker compose up -d
curl http://localhost:4000/health
docker compose down
```

`cognate-data`ボリュームは`/app/data`にマウントされる。イベントログは`/app/data/events.jsonl`である。スナップショットは`/app/data/cognate/registry.json`、`/app/data/cognate/agents.json`、および`/app/data/cognate/prompts.json`である。`GET /events/:eventId`は、そのログを読み取り、記録されたイベントをAttestiaのインクルージョン証明とルートとともに返す。呼び出し側は、書き込みとして同じ署名された`cognate-request-v1`ヘッダーを送信する。このテナントのログにないIDはミスであり、本文には証明が含まれない。プロンプトと出力テキストはイベントから除外される。このルートはRepoMeshを呼び出さない。Attestiaのコンポーズは、独自のボリュームで同じイベントログ変数を使用する。各ファイルには1つの書き込み元がある。RepoMeshのイメージは、このログをマウントしない。`REPOMESH_FAIL_ON`はデフォルトで`unverified`である：PASSのみがデプロイされる。`fail`に設定すると、UNVERIFIEDリリースも許可される。イメージは、レジャーURLを設定しない。イメージは、npmパッケージが公開された後、リリースワークフローから`v*`タグでビルドされ、`ghcr.io/mcp-tool-shop-org/cognate`に`X.Y.Z`、`X.Y`、および`sha-*`としてプッシュされる。`latest`は、`v*`タグでのみ移動する。

---

## 認証と移行ガイド

### 1.0.0で強制されること

- **Ed25519 request signing (`cognate-request-v1`).** By default (`signedRequests: "enforce"`), every `POST` and `GET /events/:eventId` must carry `X-Agent-Id`, `X-Timestamp`, `X-Nonce`, `X-Key-Id`, and `X-Signature` over the 8-line canonical request string (`cognate-request-v1\n<METHOD>\n<PATH>\n<BODY_SHA256>\n<X-Timestamp>\n<X-Nonce>\n<X-Agent-Id>\n<X-Key-Id>`). `POST` bodies must be RFC 8785 JCS-canonical UTF-8 (`400 auth.body-not-canonical` otherwise). `kid` is the 64-character lowercase hex SHA-256 of the raw 32-byte Ed25519 public key.
- **Ordered replay protection and uniform 401.** `X-Timestamp` must be within ±300 s of server time (`GET /health` exposes `serverTime`). The in-memory replay store checks `(agentId, nonce)` read-only before signature verification, records it only after the signature verifies, and retains it across the full 600 s validity span. Every pre-signature authentication failure returns an identical `401` with `code: "auth.unauthenticated"`.
- **Actor binding (`403 auth.actor-mismatch`).** The actor on every route (`transition.actorId`, `evaluation.evaluator`, `grant.requestedBy`, `grant.capability.grantedBy`, `approverId`, `agent.owner`, `prompt.agentId`, `model.owner`, `context.actorId`, `context.agentId`, and `context.agentCapabilities`) is bound to the verified signer before RepoMesh or any event append.
- **Privilege escalation guards and root key bootstrap.** Agent registration (`POST /identity/agents`) and grant approval (`POST /identity/grants/:id/approve`) require an active `delegate` capability. Self-approval is refused (`403 auth.self-approval-forbidden`). Pre-populated `agent.capabilities` are refused except when the tenant's operator-supplied root public key (`tenantRootsPath` or `COGNATE_TENANT_ROOTS_PATH`) bootstraps the tenant's first `delegate`. Root mints or approves a `delegate` directly only at bootstrap, while the tenant has no active `delegate`; by design, the tenant root keeps its recovery powers after bootstrap (it rotates a human or agent principal's key, revokes any principal, and approves non-delegate grants, and recovery from a compromised root means replacing it in the reviewed config and re-signing the tenant's delegate agents). Rotating a key hands that principal's authority to whoever holds the new key, and the root chooses the new key. So after the root rotates a human delegate's key, the root holds that delegate's authority, including minting new delegates (registering agents and approving `delegate` grants). And if the root revokes every active `delegate`, the tenant again has no active `delegate`, so the root can again mint one directly. A root derived from a test seed must never be configured in production. The server refuses the repository's own test root keys at startup (`auth.test-only-root-key-forbidden`) unless a test harness sets `allowTestOnlyRoots: true`, but it cannot recognise a root derived from any other seed known outside the deployment. No tenant root key ships in the repository or Docker image, and the server refuses to start in `enforce` mode without operator-supplied roots (`auth.missing-tenant-roots`). An agent principal (`principal: "agent"`) cannot register a human principal (`principal: "human"`) or grant `delegate`, and an `owner` cannot rotate a human principal's key. Key rotation (`POST /identity/agents/:id/key`) and revocation (`POST /identity/agents/:id/revoke`) immediately invalidate old `kid`s.

### まだではありません。現在の制限事項

- **シングルインスタンスのリプレイストア。** `(agentId, nonce)` リプレイストアは、単一の `@cognate/node` プロセスでインメモリに存在します。マルチインスタンスのデプロイメントでは、リプレイ状態は共有されません。
- **分離された承認、アイデンティティストリーム、およびオフライン検証は、今後のリリースで計画されています。** 現在、承認ゲートされたアクションはすべて、承認プリンシパルによって直接署名する必要があります。分離された `cognate-approval-v1` 承認（エージェントが別の人間の署名を含むトランジションを送信できるようにする）、永続的な `approvalId` 消費、アテストされた `cognate-<tenant>-identity` イベントストリーム、`submittedBy` / `authorizedBy` イベントフィールド、スタンドアロンのオフライン検証ツール、および RepoMesh ルートキーアンカーは、1.0.0 には含まれていません。
- **ID はテナント間でグローバルです。** 別のテナントがすでに持っている ID を登録すると、重複として拒否されます。

### 既存のエージェントを Ed25519 キーに移行する

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

Cognate は、次の脅威モデルを想定しています。

1. **推論エンドポイントの侵害。** 攻撃者がモデルAPIへのアクセス権を取得します。 対策：すべてのプロンプトと出力は、暗号化されたペイロードとSHA-256の整合性ハッシュとともに記録されます。リプレイは決定論的です。
2. **不正なエージェントまたは偽装された呼び出し元ID。** 対策：すべてのHTTPの書き込みと`/events/:eventId`の読み取りは、Ed25519の署名（`cognate-request-v1`）、±300秒のタイムスタンプチェック、および600秒のnonceリプレイストアで認証されます。機能は時間制限、範囲制限、および取り消し可能（`POST /identity/agents/:id/revoke`、`POST /identity/agents/:id/key`）であり、すべてのルートは、そのボディのアクターフィールドを検証済みの署名者にバインドします（`403 auth.actor-mismatch`）。制限：リプレイストアはプロセスごとにメモリ内に存在し、分離された複数当事者による承認（`cognate-approval-v1`）およびオフラインのイベントストリーム署名検証は1.0.0には含まれていません。
3. **サプライチェーンにおけるモデルの改ざん。** 重みまたは構成が評価後に置き換えられます。 対策：モデルレジストリは、登録時に重み、構成、およびマニフェストのハッシュを記録し、`ModelVersion.repo`を`sha256:<hex>`として保存します。いずれかの変更は、バージョンを無効にします。
4. **プロンプトインジェクションによるポリシーの回避。** 悪意のあるプロンプトがコンテンツルールを回避しようとします。 対策：ポリシー評価は決定論的であり、バージョン管理され、推論の前に実行されます。ポリシーチェックに合格しないプロンプトは実行されません。
5. **監査ログの不正な内部利用。** 特権を持つオペレーターがログを改ざんします。 対策：イベントストアは追加専用であり、AttestiaのMerkleツリー証明によって保護されています。改ざんはチェーンハッシュを破壊します。
6. **HTTPサーバーにおけるクロステナントアクセス。** あるテナントのエージェントが、別のテナントのレコードにアクセスします。 対策：すべてのルートは、認証された署名者のテナント内で動作します。別のテナントを参照するレコードは拒否され、別のテナントのIDは存在しないものとして回答されます。
7. **誤用または誤った設定のテナントルートキー。** ルートキーはテナントを起動し、その後も復旧権限を保持します。 対策：ルートキーはリポジトリまたはイメージに含まれていません。サーバーは、オペレーターが提供するルートがない場合、`enforce`モードで起動することを拒否し、リポジトリ自身のテストルートキーも拒否します。制限：ルートの権限は設計上広範囲に及ぶため（上記参照）、オペレーターはルートキーをテナント自体と同様に慎重に保持する必要があり、侵害されたルートからの復旧は、レビューされた構成でそれを置き換えることを意味します。

テレメトリや分析は行いません。HTTPサーバーへのデプロイでは、名前が指定されたリリースが合格するかどうかをRepoMeshで確認します。ヘルスチェックとその他のルートは、このプロセスで実行されます。セキュリティレポートは[SECURITY.md](SECURITY.md)を通じて送信されます。

---

## ステータス

バージョン1.0.0、公開環境でのビルド。すべてのパッケージが実装、テスト、およびビルドされています。バンドルを`npm install @mcptoolshop/cognate`でインストールします。`@cognate/*`の名前は、このリポジトリに保持されます。

| ゲート | ステータス |
|------|--------|
| ビルド | 合格 |
| テスト | 316件合格（node 147、model-registry 58、policy 47、agent-identity 29、prompt-store 24、repomesh-bridge 9、cognate 2） |
| カバレッジ | 行：nodeでは94.3%、policyでは93.4%、model-registryでは99.6%、agent-identity、prompt-store、repomesh-bridgeでは100%で、これらの6つのパッケージにはvitestのカバレッジフロアが設定されています。 |
| 型チェック | クリーン |
| Docker | イメージはガバナンスAPIを提供します。ボリュームには、イベントログと3つのスナップショットが保存されます。 |
| 出荷チェック | ハンドブック、ランディングページ、およびこのリリースのリポジトリメタデータ |

---

[mcp-tool-shop](https://mcp-tool-shop.github.io/)によってビルドされました。
