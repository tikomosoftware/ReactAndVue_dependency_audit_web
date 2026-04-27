# Web Dependency Audit - Webアプリケーション

Next.js 15 App Router で構築された依存パッケージ監査Webアプリケーション。

## 機能

- **ファイルアップロード**: package.json（必須）と lockfile（任意）をブラウザからアップロード
- **4カテゴリ分類**: 🔴 Critical Security / 🟡 Maintenance Update / 🟢 Stability / ✅ Up to Date
- **脆弱性スキャン**: GitHub Advisory Database API による脆弱性検出
- **フレームワーク更新情報**: React, Vue, Next.js 等のメジャーアップデート検出
- **Markdownレポート**: 監査結果をMarkdownファイルとしてダウンロード
- **プライバシー保護**: アップロードファイルはサーバーに保存されない
- **レート制限**: Upstash Redis によるIPベースのレート制限（1時間10リクエスト）
- **APIキャッシュ**: npm registry / GitHub Advisory API のレスポンスを1時間キャッシュ

## セットアップ

### 前提条件

- Node.js 18 以上
- npm

### インストール

```bash
npm install
```

### ローカル開発

```bash
npm run dev
```

http://localhost:3000 にアクセスしてください。

### 環境変数（オプション）

`.env.local` を作成して設定できます。未設定でも動作します。

```bash
# GitHub API 認証（設定すると 5,000 リクエスト/時間、未設定だと 60 リクエスト/時間）
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Upstash Redis（設定するとキャッシュとレート制限が有効化）
UPSTASH_REDIS_REST_URL=https://xxxxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 使い方

### 1. ファイルを準備

監査したいプロジェクトの以下のファイルを用意します：

- **package.json**（必須）: プロジェクトの依存パッケージ定義
- **package-lock.json** または **yarn.lock**（任意）: 正確なインストールバージョン情報

### 2. ファイルをアップロード

1. サイトにアクセス
2. 「ファイルを選択」ボタンで package.json を選択
3. 必要に応じて lockfile も選択
4. 「監査を実行」ボタンをクリック

### 3. 結果を確認

監査結果が4カテゴリに分類されて表示されます：

| カテゴリ | 意味 |
|---|---|
| 🔴 Critical Security | 脆弱性が検出されたパッケージ |
| 🟡 Maintenance Update | メジャーバージョン更新があるパッケージ |
| 🟢 Stability | マイナー/パッチ更新があるパッケージ |
| ✅ Up to Date | 最新バージョンのパッケージ |

### 4. レポートをダウンロード

「Markdown レポートをダウンロード」ボタンで `audit-report.md` をダウンロードできます。

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/audit` | ファイルアップロード＆監査実行 |
| GET | `/api/health` | ヘルスチェック |

## スクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run test` | テスト実行 |

## デプロイ（Vercel）

Vercel へのデプロイ手順は [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md) を参照してください。

## 技術スタック

| 項目 | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS 4 |
| キャッシュ / レート制限 | Upstash Redis |
| デプロイ | Vercel |

## ライセンス

MIT
