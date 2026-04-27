# 要件定義書

## はじめに

既存の Flutter Dependency Audit CLI ツールの Web アプリケーション版。Flutter プロジェクトの `pubspec.yaml` と `pubspec.lock` をブラウザからアップロードし、pub.dev API を使用してパッケージのバージョン情報とセキュリティアドバイザリを取得、4カテゴリに分類した監査結果を Web UI で表示する。既存の ReactAndVue Web Audit App（Next.js 15 App Router + Tailwind CSS 4 + Upstash Redis）のアーキテクチャとコンポーネント構成を踏襲し、Flutter/Dart エコシステム向けの監査機能を追加する。CLI ツールの File Mode（Flutter SDK 不要）のロジックを TypeScript に移植し、サーバーサイドで pub.dev API を呼び出す構成とする。Markdown レポートのダウンロード、プライバシー保護（ファイル非保存）、Upstash Redis によるレート制限・API キャッシュも既存パターンに準拠して実装する。

## 用語集

- **Flutter_Web_Audit_App**: Flutter/Dart プロジェクト向けの依存パッケージ監査 Web アプリケーション。既存の ReactAndVue Web Audit App と同一の Next.js プロジェクト内に構築する
- **Web_Audit_Frontend**: Next.js App Router の React コンポーネントで構成されるフロントエンド UI
- **Flutter_Audit_Engine**: pubspec.yaml + pubspec.lock のパース、pub.dev API からのバージョン情報・アドバイザリ取得、4カテゴリ分類を統合した Flutter 向け監査実行エンジン
- **Pubspec_Parser**: pubspec.yaml と pubspec.lock を解析し、パッケージ名・現在バージョン・依存種別を抽出するパーサー
- **PubDev_Client**: pub.dev API（`https://pub.dev/api/packages/{name}`、`https://pub.dev/api/packages/{name}/advisories`）にリクエストを送信し、最新バージョンとセキュリティアドバイザリを取得するクライアント
- **Flutter_Categorizer**: 脆弱性情報とバージョン差分に基づいてパッケージを4カテゴリ（Critical Security、Maintenance Update、Stability、Up to Date）に分類するロジック
- **Flutter_File_Validator**: アップロードされた pubspec.yaml と pubspec.lock の形式・サイズを検証するコンポーネント
- **Flutter_Report_Generator**: 監査結果から Markdown レポートを生成するコンポーネント
- **Rate_Limiter**: Upstash Redis を使用し、IP アドレスごとのリクエスト頻度を制限するミドルウェア
- **API_Cache**: Upstash Redis を使用して pub.dev API のレスポンスをキャッシュするコンポーネント
- **API_Route**: Next.js App Router の Route Handler（app/api/flutter-audit/route.ts）。Vercel 上ではサーバーレス関数として実行される
- **pubspec.yaml**: Flutter/Dart プロジェクトの依存パッケージを宣言するファイル（YAML 形式）
- **pubspec.lock**: Flutter/Dart プロジェクトの全パッケージの正確なインストールバージョンを記録するファイル（YAML-like 形式）
- **pub.dev**: Dart/Flutter パッケージの公式レジストリ。パッケージ情報 API とセキュリティアドバイザリ API を提供する
- **4カテゴリ分類**: 🔴 Critical Security（脆弱性あり）、🟡 Maintenance Update（メジャー更新あり）、🟢 Stability（マイナー/パッチ更新のみ）、✅ Up to Date（最新）の4段階分類
- **SDK_Info**: pubspec.lock から抽出される Dart SDK と Flutter SDK のバージョン情報
- **hosted_package**: pub.dev でホストされているパッケージ。SDK 依存（flutter 等）は除外する

## 要件

### 要件 1: Flutter ファイルアップロード

**ユーザーストーリー:** Flutter 開発者として、ブラウザから pubspec.yaml と pubspec.lock をアップロードしたい。Flutter SDK がインストールされていない環境でも依存パッケージの監査を実行できるようにするため。

#### 受け入れ基準

1. THE Web_Audit_Frontend SHALL ファイル選択 UI を提供し、pubspec.yaml ファイル（必須）と pubspec.lock ファイル（必須）の2つのファイルをアップロードできるようにする
2. THE Web_Audit_Frontend SHALL ドラッグ&ドロップによるファイルアップロードに対応する
3. WHEN ユーザーがファイルをドロップした場合、THE Web_Audit_Frontend SHALL ファイル名（pubspec.yaml、pubspec.lock）を自動判別して適切なフィールドに割り当てる
4. IF アップロードされた pubspec.yaml が有効な YAML 形式でない場合、THEN THE Flutter_File_Validator SHALL 「有効な pubspec.yaml ファイルではありません」というエラーメッセージを返す
5. IF アップロードされた pubspec.yaml に "name" フィールドが存在しない場合、THEN THE Flutter_File_Validator SHALL 「有効な pubspec.yaml ファイルではありません」というエラーメッセージを返す
6. IF アップロードされた pubspec.lock に "packages:" セクションが存在しない場合、THEN THE Flutter_File_Validator SHALL 「有効な pubspec.lock ファイルではありません」というエラーメッセージを返す
7. IF アップロードされたファイルのサイズが 5MB を超える場合、THEN THE Flutter_File_Validator SHALL 「ファイルサイズが上限（5MB）を超えています」というエラーメッセージを返す

### 要件 2: pubspec.yaml / pubspec.lock パーサー

**ユーザーストーリー:** 開発者として、pubspec.yaml と pubspec.lock から正確なパッケージ情報を抽出したい。pub.dev API への問い合わせに必要なパッケージ名とバージョン情報を取得するため。

#### 受け入れ基準

1. WHEN 有効な pubspec.lock が提供された場合、THE Pubspec_Parser SHALL "packages:" セクションを行ベースで解析し、パッケージ名、バージョン、ソース種別（hosted / sdk / path）、依存種別（direct main / direct dev / transitive）を抽出する
2. THE Pubspec_Parser SHALL ソース種別が "hosted" のパッケージのみを監査対象として返す（sdk 依存や path 依存は除外する）
3. THE Pubspec_Parser SHALL デフォルトで direct main と direct dev の依存のみを返し、transitive 依存を除外する
4. WHEN 有効な pubspec.yaml が提供された場合、THE Pubspec_Parser SHALL "name" フィールドからプロジェクト名を抽出する
5. THE Pubspec_Parser SHALL pubspec.lock の "sdks:" セクションから Dart SDK と Flutter SDK のバージョン情報を抽出する
6. THE Pubspec_Parser SHALL バージョン文字列の前後の引用符（シングルクォート、ダブルクォート）を除去して返す
7. FOR ALL 有効な pubspec.lock ファイル、パースしてから再構築した場合に同等のパッケージ情報が得られる（ラウンドトリップ特性）

### 要件 3: pub.dev API バージョン情報取得

**ユーザーストーリー:** 開発者として、各パッケージの最新バージョンを pub.dev API から取得したい。現在のバージョンと最新バージョンを比較してアップデートの必要性を判断するため。

#### 受け入れ基準

1. WHEN パッケージリストが構築された場合、THE PubDev_Client SHALL 各パッケージについて `https://pub.dev/api/packages/{name}` エンドポイントにリクエストを送信し、最新バージョンを取得する
2. THE PubDev_Client SHALL レスポンス JSON の `latest.version` フィールドから最新バージョンを抽出する
3. IF pub.dev API が HTTP 404 を返した場合、THEN THE PubDev_Client SHALL 該当パッケージの最新バージョンを null として記録し、監査を続行する
4. IF pub.dev API が HTTP 429（レート制限）を返した場合、THEN THE PubDev_Client SHALL エラーログを出力し、該当パッケージの最新バージョンを null として記録する
5. IF pub.dev API への接続がタイムアウトした場合、THEN THE PubDev_Client SHALL 該当パッケージの最新バージョンを null として記録し、監査を続行する

### 要件 4: pub.dev セキュリティアドバイザリ取得

**ユーザーストーリー:** 開発者として、各パッケージのセキュリティアドバイザリを pub.dev API から取得したい。脆弱性のあるパッケージを特定し、優先的に対応するため。

#### 受け入れ基準

1. WHEN パッケージリストが構築された場合、THE PubDev_Client SHALL 各パッケージについて `https://pub.dev/api/packages/{name}/advisories` エンドポイントにリクエストを送信し、セキュリティアドバイザリを取得する
2. THE PubDev_Client SHALL 取得したアドバイザリのうち、現在インストールされているバージョンに影響するもののみをフィルタリングして返す
3. THE PubDev_Client SHALL アドバイザリから advisoryId、タイトル、深刻度（severity）、CVSSスコア、CVE ID、影響バージョン範囲、修正バージョンを抽出する
4. IF pub.dev API のアドバイザリエンドポイントが HTTP 404 を返した場合、THEN THE PubDev_Client SHALL 該当パッケージにアドバイザリなしとして記録する
5. IF アドバイザリのバージョン範囲情報が不完全な場合、THEN THE PubDev_Client SHALL 安全側に倒して該当バージョンを影響ありとして扱う

### 要件 5: 4カテゴリ分類

**ユーザーストーリー:** 開発者として、パッケージを優先度別に分類してほしい。対応の緊急度を一目で把握し、効率的にアップデート計画を立てるため。

#### 受け入れ基準

1. WHEN パッケージにセキュリティアドバイザリが存在する場合、THE Flutter_Categorizer SHALL 該当パッケージを 🔴 Critical Security カテゴリに分類する
2. WHEN パッケージにアドバイザリがなく、現在バージョンと最新バージョンのメジャーバージョンが異なる場合、THE Flutter_Categorizer SHALL 該当パッケージを 🟡 Maintenance Update カテゴリに分類する
3. WHEN パッケージにアドバイザリがなく、マイナーまたはパッチバージョンのみが異なる場合、THE Flutter_Categorizer SHALL 該当パッケージを 🟢 Stability カテゴリに分類する
4. WHEN パッケージの現在バージョンが最新バージョンと一致する場合、THE Flutter_Categorizer SHALL 該当パッケージを ✅ Up to Date カテゴリに分類する
5. IF 最新バージョンの取得に失敗した場合（null）、THEN THE Flutter_Categorizer SHALL 該当パッケージを ✅ Up to Date カテゴリに分類する（更新状況を判定できないため）
6. THE Flutter_Categorizer SHALL 分類結果を Critical Security → Maintenance Update → Stability → Up to Date の優先度順にソートして返す

### 要件 6: 監査結果の Web 表示

**ユーザーストーリー:** Flutter 開発者として、監査結果をブラウザ上で見やすく確認したい。CLI のコンソール出力よりも視覚的に分かりやすい形式で優先度を把握するため。

#### 受け入れ基準

1. WHEN 監査結果を受信した場合、THE Web_Audit_Frontend SHALL 結果を4カテゴリ（🔴 Critical Security、🟡 Maintenance Update、🟢 Stability、✅ Up to Date）に分けて表示する
2. THE Web_Audit_Frontend SHALL 各カテゴリのパッケージ数をサマリーとして表示する
3. WHEN Critical Security カテゴリのパッケージが存在する場合、THE Web_Audit_Frontend SHALL パッケージ名、現在バージョン、最新バージョン、深刻度、CVSSスコア、脆弱性の概要、GitHub Advisory へのリンクを表示する
4. WHEN Maintenance Update または Stability カテゴリのパッケージが存在する場合、THE Web_Audit_Frontend SHALL パッケージ名、現在バージョン、最新バージョンを表示する
5. THE Web_Audit_Frontend SHALL 監査処理中にローディングインジケーターを表示する
6. IF 監査処理がエラーで失敗した場合、THEN THE Web_Audit_Frontend SHALL エラーメッセージと「もう一度試す」ボタンを表示する
7. THE Web_Audit_Frontend SHALL Dart SDK と Flutter SDK のバージョン情報をレポートヘッダーに表示する
8. THE Web_Audit_Frontend SHALL 各パッケージ名に pub.dev のパッケージページ（`https://pub.dev/packages/{name}`）へのリンクを付与する

### 要件 7: Markdown レポートのダウンロード

**ユーザーストーリー:** Flutter 開発者として、監査結果を Markdown ファイルとしてダウンロードしたい。チームへの共有やお客さまへの定期報告に使用するため。

#### 受け入れ基準

1. WHEN 監査結果が表示されている場合、THE Web_Audit_Frontend SHALL 「Markdown レポートをダウンロード」ボタンを表示する
2. WHEN ユーザーがダウンロードボタンをクリックした場合、THE Flutter_Report_Generator SHALL CLI ツールの Markdown レポートと同等の形式でレポートを生成する
3. THE Flutter_Report_Generator SHALL レポートに以下のセクションを含める: はじめに、Critical Security、Maintenance Update、Stability、Up to Date、Security Advisories（参考リンク付き）、Summary
4. THE Web_Audit_Frontend SHALL 生成された Markdown レポートを `flutter-audit-report.md` というファイル名でダウンロードさせる

### 要件 8: プライバシー保護

**ユーザーストーリー:** Flutter 開発者として、アップロードしたファイルがサーバーに保存されないことを保証してほしい。プロジェクトの依存情報はセンシティブな情報であるため。

#### 受け入れ基準

1. THE API_Route SHALL アップロードされたファイルの内容をサーバーレス関数のメモリ上でのみ処理し、永続ストレージに書き込まない
2. WHEN 監査処理が完了または失敗した場合、THE API_Route SHALL サーバーレス関数の実行終了とともにメモリ上のファイルデータを破棄する
3. THE Web_Audit_Frontend SHALL プライバシーポリシーとして「アップロードされたファイルはサーバーに保存されません。監査処理完了後、メモリ上のデータは即座に破棄されます。」という説明を表示する

### 要件 9: レート制限と API キャッシュ

**ユーザーストーリー:** 運用者として、リクエスト頻度の制限と pub.dev API レスポンスのキャッシュを実装したい。pub.dev API のレート制限超過を防ぎ、レスポンス速度を向上させるため。

#### 受け入れ基準

1. THE Rate_Limiter SHALL 既存の Upstash Redis ベースのレート制限ミドルウェアを再利用し、Flutter 監査 API エンドポイントにも適用する
2. THE Rate_Limiter SHALL 1つの IP アドレスからの Flutter 監査リクエストを1時間あたり最大10回に制限する
3. IF レート制限を超過したリクエストを受信した場合、THEN THE Rate_Limiter SHALL HTTP 429 ステータスコードと「リクエスト回数の上限に達しました。しばらく時間をおいてから再度お試しください」というメッセージを返す
4. THE API_Cache SHALL Upstash Redis を使用して pub.dev API のバージョン情報レスポンスをパッケージ名をキーとして1時間キャッシュする
5. THE API_Cache SHALL Upstash Redis を使用して pub.dev API のアドバイザリレスポンスをパッケージ名をキーとして1時間キャッシュする
6. IF Upstash Redis への接続が失敗した場合、THEN THE API_Cache SHALL キャッシュを使用せずに pub.dev API へ直接リクエストを送信する

### 要件 10: API エンドポイント設計

**ユーザーストーリー:** 開発者として、Flutter 監査用の API エンドポイントを通じて監査機能にアクセスしたい。既存の npm/yarn 監査エンドポイントと共存させるため。

#### 受け入れ基準

1. THE Flutter_Web_Audit_App SHALL Next.js App Router の Route Handler として POST /api/flutter-audit エンドポイント（app/api/flutter-audit/route.ts）で pubspec.yaml と pubspec.lock のアップロードと監査実行を受け付ける
2. WHEN 有効なファイルがアップロードされた場合、THE API_Route SHALL FormData から pubspec.yaml（必須）と pubspec.lock（必須）を取得し、Flutter_Audit_Engine に渡す
3. THE API_Route SHALL 監査結果を FlutterAuditReport 型の JSON 形式でレスポンスとして返す
4. IF リクエストボディのサイズが 10MB を超える場合、THEN THE API_Route SHALL HTTP 413 ステータスコードを返す
5. IF ファイルバリデーションに失敗した場合、THEN THE API_Route SHALL HTTP 400 ステータスコードとエラーメッセージを返す

### 要件 11: セマンティックバージョニング比較

**ユーザーストーリー:** 開発者として、パッケージのバージョン差分を正確に判定してほしい。メジャー・マイナー・パッチの区別に基づいて適切なカテゴリに分類するため。

#### 受け入れ基準

1. THE Flutter_Categorizer SHALL セマンティックバージョニング（major.minor.patch）形式のバージョン文字列を解析する
2. THE Flutter_Categorizer SHALL プレリリースタグ（例: 1.0.0-beta.1）やビルドメタデータ（例: 1.0.0+1）を含むバージョン文字列を正しく処理する
3. WHEN 現在バージョンと最新バージョンのメジャー番号が異なる場合、THE Flutter_Categorizer SHALL バージョン差分を "major" と判定する
4. WHEN メジャー番号が同一でマイナー番号が異なる場合、THE Flutter_Categorizer SHALL バージョン差分を "minor" と判定する
5. WHEN メジャー番号とマイナー番号が同一でパッチ番号が異なる場合、THE Flutter_Categorizer SHALL バージョン差分を "patch" と判定する
6. FOR ALL 有効なセマンティックバージョン文字列のペア、バージョン差分の判定結果は一貫性を持つ（同じ入力に対して同じ結果を返す）

### 要件 12: パッケージ数上限

**ユーザーストーリー:** 運用者として、処理対象パッケージ数に上限を設けたい。Vercel サーバーレス関数のタイムアウト制限内に処理を完了させるため。

#### 受け入れ基準

1. THE Flutter_Audit_Engine SHALL 監査対象パッケージ数の上限を200パッケージに設定する
2. IF パッケージ数が上限を超える場合、THEN THE Flutter_Audit_Engine SHALL 先頭200パッケージのみを監査対象とし、上限超過の警告メッセージを結果に含める
3. THE Flutter_Audit_Engine SHALL Vercel Hobby プランのサーバーレス関数タイムアウト（60秒）内に処理を完了する

### 要件 13: セキュリティ対策

**ユーザーストーリー:** 運用者として、Flutter 監査エンドポイントの基本的なセキュリティ対策を実装したい。悪意のあるリクエストからアプリケーションを保護するため。

#### 受け入れ基準

1. THE API_Route SHALL リクエストボディのサイズを最大 10MB に制限する
2. THE Flutter_File_Validator SHALL アップロードされたファイルの MIME タイプが text/plain、text/yaml、application/x-yaml、application/octet-stream のいずれかであることを検証する
3. THE Flutter_File_Validator SHALL ファイル内容の構造検証（pubspec.yaml の "name" フィールド存在確認、pubspec.lock の "packages:" セクション存在確認）を実施する
4. THE API_Route SHALL 既存の Next.js セキュリティヘッダー設定（X-Content-Type-Options、X-Frame-Options、Content-Security-Policy）の保護下で動作する

### 要件 14: 既存 Web アプリとの統合

**ユーザーストーリー:** 開発者として、Flutter 監査機能を既存の Web Audit App に統合したい。npm/yarn 監査と Flutter 監査を同一アプリケーションから利用できるようにするため。

#### 受け入れ基準

1. THE Web_Audit_Frontend SHALL トップページにエコシステム選択 UI（npm/yarn または Flutter/Dart）を表示する
2. WHEN ユーザーが Flutter/Dart を選択した場合、THE Web_Audit_Frontend SHALL pubspec.yaml と pubspec.lock のアップロード UI を表示する
3. WHEN ユーザーが npm/yarn を選択した場合、THE Web_Audit_Frontend SHALL 既存の package.json と lockfile のアップロード UI を表示する
4. THE Flutter_Web_Audit_App SHALL 既存の npm/yarn 監査機能（POST /api/audit）に影響を与えない
5. THE Flutter_Web_Audit_App SHALL 既存のコンポーネント構成（Summary、CategorySection 等）を可能な限り再利用する
