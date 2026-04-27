# Vercel 環境変数設定手順

## 概要

本アプリケーションを Vercel にデプロイする際、以下の環境変数を Vercel ダッシュボードで設定する必要があります。

## 必要な環境変数

### 1. GITHUB_TOKEN

GitHub Advisory Database API の認証に使用するトークンです。

- **用途**: 脆弱性スキャン時の GitHub API 認証（認証済みで 5,000 リクエスト/時間）
- **未設定時の動作**: 認証なしモード（60 リクエスト/時間）で動作。コンソールに警告ログを出力
- **取得方法**:
  1. GitHub の Settings > Developer settings > Personal access tokens > Tokens (classic) にアクセス
  2. 「Generate new token (classic)」をクリック
  3. スコープは不要（パブリックデータのみアクセス）
  4. 生成されたトークンをコピー

### 2. UPSTASH_REDIS_REST_URL

Upstash Redis の REST API エンドポイント URL です。

- **用途**: API レスポンスキャッシュ（TTL: 1時間）およびレート制限のデータストア
- **未設定時の動作**: キャッシュとレート制限が無効化され、外部 API に直接リクエスト
- **取得方法**:
  1. [Upstash Console](https://console.upstash.com/) にログイン
  2. 新しい Redis データベースを作成（リージョン: ap-northeast-1 推奨）
  3. データベースの Details ページから REST URL をコピー

### 3. UPSTASH_REDIS_REST_TOKEN

Upstash Redis の REST API 認証トークンです。

- **用途**: Upstash Redis への認証
- **未設定時の動作**: UPSTASH_REDIS_REST_URL と同様、キャッシュとレート制限が無効化
- **取得方法**:
  1. 上記と同じ Upstash Console のデータベース Details ページから REST Token をコピー

## Vercel ダッシュボードでの設定手順

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. 対象プロジェクトを選択
3. Settings > Environment Variables に移動
4. 以下の変数を追加:

| 変数名 | Environment | 備考 |
|---|---|---|
| `GITHUB_TOKEN` | Production, Preview, Development | GitHub Personal Access Token |
| `UPSTASH_REDIS_REST_URL` | Production, Preview, Development | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Production, Preview, Development | Upstash Redis REST Token |

5. 「Save」をクリックして保存
6. 新しいデプロイを実行して環境変数を反映

## ローカル開発時

ローカル開発では `.env.local` ファイルを `web/` ディレクトリに作成して環境変数を設定できます:

```bash
# web/.env.local
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
UPSTASH_REDIS_REST_URL=https://xxxxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **注意**: `.env.local` は `.gitignore` に含まれており、リポジトリにコミットされません。
> 環境変数が未設定の場合でもアプリケーションは起動可能です（キャッシュとレート制限が無効化されます）。

## デプロイ設定（vercel.json）

`vercel.json` で以下の設定を定義しています:

- **リージョン**: `hnd1`（東京）— 日本からのアクセスに最適化
- **サーバーレス関数タイムアウト**: 60秒（Hobby プラン上限）
- **メモリ**: 1024MB
