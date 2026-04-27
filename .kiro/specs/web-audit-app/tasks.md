# Implementation Plan: Flutter/Dart 依存パッケージ監査 Web アプリ

## Overview

既存の ReactAndVue Web Audit App（Next.js 15 App Router）に Flutter/Dart エコシステム向けの依存パッケージ監査機能を追加する。Flutter CLI ツールの File Mode ロジックを TypeScript に移植し、`web/lib/flutter/` ディレクトリに独立したモジュール群として実装する。フロントエンドはエコシステム選択 UI を追加し、既存の Summary / CategorySection コンポーネントを再利用する。

## Tasks

- [ ] 1. Flutter 監査の型定義とコアインターフェースを作成する
  - [ ] 1.1 `web/lib/flutter/types.ts` を作成する
    - `FlutterDependencyKind` 型（`'direct' | 'dev' | 'transitive'`）を定義する
    - `FlutterAuditCategory` enum（`CriticalSecurity`, `MaintenanceUpdate`, `Stability`, `UpToDate`）を定義する
    - `FlutterAuditResult` インターフェース（package, category, versionInfo, advisories）を定義する
    - `SdkInfo` インターフェース（dart?, flutter?）を定義する
    - `FlutterAuditReport` インターフェース（projectName, mode, sdkInfo, generatedAt, results）を定義する
    - `PubspecPackage`, `ParsedPubspecLock`, `PubspecYamlInfo` インターフェースを定義する
    - `PubDevVersionInfo`, `PubDevAdvisory` インターフェースを定義する
    - _Requirements: 2.1, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4_

- [ ] 2. pubspec.yaml / pubspec.lock パーサーを実装する
  - [ ] 2.1 `web/lib/flutter/pubspec-parser.ts` を作成する
    - `parsePubspecLock(content: string): ParsedPubspecLock` を実装する（Dart CLI の `PubspecAnalyzer.parseLockFile()` を TypeScript に移植）
    - 行ベースのパーサーで "packages:" セクションを解析し、パッケージ名・バージョン・ソース種別・依存種別を抽出する
    - "sdks:" セクションから Dart SDK / Flutter SDK バージョンを抽出する
    - バージョン文字列の前後の引用符（シングルクォート、ダブルクォート）を除去する
    - `parsePubspecYaml(content: string): PubspecYamlInfo` を実装する（"name:" フィールドからプロジェクト名を抽出）
    - `extractAuditTargets(parsed, options?)` を実装する（hosted + direct main/dev のみ抽出、transitive 除外がデフォルト）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Property 1: pubspec.lock パースのラウンドトリップテストを書く
    - **Property 1: pubspec.lock パースのラウンドトリップ**
    - 任意の有効なパッケージエントリ集合を pubspec.lock 形式にシリアライズし、`parsePubspecLock` でパースした結果が元のパッケージ情報と一致することを検証する
    - SDK バージョン情報のラウンドトリップも検証する
    - 引用符付きバージョン文字列の除去を検証する
    - テストファイル: `web/__tests__/properties/pubspec-parser.property.test.ts`
    - **Validates: Requirements 2.1, 2.5, 2.6, 2.7**

  - [ ]* 2.3 Property 2: pubspec.yaml プロジェクト名抽出テストを書く
    - **Property 2: pubspec.yaml プロジェクト名抽出**
    - 任意の有効なプロジェクト名を pubspec.yaml 形式に埋め込み、`parsePubspecYaml` でパースした結果が元のプロジェクト名と一致することを検証する
    - テストファイル: `web/__tests__/properties/pubspec-parser.property.test.ts`
    - **Validates: Requirements 2.4**

  - [ ]* 2.4 Property 3: 監査対象パッケージのフィルタリングテストを書く
    - **Property 3: 監査対象パッケージのフィルタリング**
    - hosted/sdk/path/git ソースと direct main/direct dev/transitive 依存の混合パッケージリストに対して、`extractAuditTargets` が正しくフィルタリングすることを検証する
    - `includeTransitive: true` の場合は hosted パッケージ全てが返ることを検証する
    - テストファイル: `web/__tests__/properties/pubspec-parser.property.test.ts`
    - **Validates: Requirements 2.2, 2.3**

- [ ] 3. Checkpoint - パーサーのテストが通ることを確認する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. pub.dev API クライアントを実装する
  - [ ] 4.1 `web/lib/flutter/pubdev-client.ts` を作成する
    - `fetchVersionInfos(packages): Promise<PubDevVersionInfo[]>` を実装する（`https://pub.dev/api/packages/{name}` から最新バージョンを取得）
    - `fetchAdvisories(packages): Promise<Map<string, PubDevAdvisory[]>>` を実装する（`https://pub.dev/api/packages/{name}/advisories` からアドバイザリを取得）
    - `isVersionAffected(currentVersion, introducedVersion, fixedVersion): boolean` を実装する（Dart CLI の `AdvisoryInfo.isVersionAffected()` を移植）
    - HTTP 404 / 429 / タイムアウト時のエラーハンドリングを実装する（latestVersion を null として記録し監査続行）
    - アドバイザリから advisoryId, title, severity, cvssScore, cveId, affectedVersions, fixedVersion を抽出する
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 4.2 Property 4: アドバイザリ影響バージョン判定テストを書く
    - **Property 4: アドバイザリ影響バージョン判定**
    - 任意の current version C, introduced version I, fixed version F（I < F）に対して、`isVersionAffected(C, I, F)` が C >= I AND C < F の場合のみ true を返すことを検証する
    - introduced / fixed が null の場合は true（安全側）を返すことを検証する
    - テストファイル: `web/__tests__/properties/pubdev-client.property.test.ts`
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 4.3 pub.dev API クライアントのユニットテストを書く
    - モック HTTP レスポンスを使った API クライアントテスト（200, 404, 429, タイムアウト）
    - テストファイル: `web/__tests__/unit/pubdev-client.test.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.4_

- [ ] 5. 4カテゴリ分類ロジックを実装する
  - [ ] 5.1 `web/lib/flutter/flutter-categorizer.ts` を作成する
    - `categorize(packages, versionInfos, advisories): FlutterAuditResult[]` を実装する（Dart CLI の `Categorizer` を移植）
    - 分類ルール: アドバイザリあり → CriticalSecurity、メジャー差分 → MaintenanceUpdate、マイナー/パッチ差分 → Stability、最新 or null → UpToDate
    - 結果を CriticalSecurity → MaintenanceUpdate → Stability → UpToDate の優先度順にソートする
    - `parseSemver(version: string)` を実装する（プレリリースタグ・ビルドメタデータ対応）
    - `getVersionDiffType(current, latest)` を実装する（major / minor / patch / none / unknown）
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 5.2 Property 5: 4カテゴリ分類の正確性テストを書く
    - **Property 5: 4カテゴリ分類の正確性**
    - 任意のパッケージ・バージョン情報・アドバイザリデータに対して、`categorize` が正しいカテゴリに分類することを検証する
    - テストファイル: `web/__tests__/properties/flutter-categorizer.property.test.ts`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [ ]* 5.3 Property 6: 分類結果のソート順序テストを書く
    - **Property 6: 分類結果のソート順序**
    - 任意のパッケージ集合に対して、`categorize` の返却配列が CriticalSecurity → MaintenanceUpdate → Stability → UpToDate の順序であることを検証する
    - テストファイル: `web/__tests__/properties/flutter-categorizer.property.test.ts`
    - **Validates: Requirements 5.6**

  - [ ]* 5.4 Property 7: セマンティックバージョン解析テストを書く
    - **Property 7: セマンティックバージョン解析**
    - 任意の有効な semver 文字列に対して、`parseSemver` が major, minor, patch を正しく抽出することを検証する
    - プレリリースタグ（-beta.1）やビルドメタデータ（+1）を無視することを検証する
    - テストファイル: `web/__tests__/properties/flutter-categorizer.property.test.ts`
    - **Validates: Requirements 11.1, 11.2**

  - [ ]* 5.5 Property 8: バージョン差分分類テストを書く
    - **Property 8: バージョン差分分類**
    - 任意の有効な semver ペアに対して、`getVersionDiffType` が major / minor / patch / none を正しく返すことを検証する
    - テストファイル: `web/__tests__/properties/flutter-categorizer.property.test.ts`
    - **Validates: Requirements 11.3, 11.4, 11.5, 11.6**

- [ ] 6. Checkpoint - 分類ロジックのテストが通ることを確認する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. ファイルバリデーションを実装する
  - [ ] 7.1 `web/lib/flutter/flutter-file-validator.ts` を作成する
    - `validatePubspecYaml(file: File): Promise<FlutterValidationResult>` を実装する（MIME タイプ検証、5MB サイズ上限、"name:" フィールド存在確認）
    - `validatePubspecLock(file: File): Promise<FlutterValidationResult>` を実装する（MIME タイプ検証、5MB サイズ上限、"packages:" セクション存在確認）
    - `validateAndExtractFlutterFiles(formData: FormData): Promise<FlutterValidatedFiles>` を実装する
    - 許可 MIME タイプ: text/plain, text/yaml, application/x-yaml, application/octet-stream
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 13.2, 13.3_

  - [ ]* 7.2 Property 11: ファイルバリデーションの不正入力拒否テストを書く
    - **Property 11: ファイルバリデーションの不正入力拒否**
    - "name:" を含まない文字列に対して `validatePubspecYaml` が `{ valid: false }` を返すことを検証する
    - "packages:" を含まない文字列に対して `validatePubspecLock` が `{ valid: false }` を返すことを検証する
    - テストファイル: `web/__tests__/properties/flutter-file-validator.property.test.ts`
    - **Validates: Requirements 1.4, 1.5, 1.6, 13.2, 13.3**

- [ ] 8. pub.dev API キャッシュを実装する
  - [ ] 8.1 `web/lib/flutter/flutter-cache.ts` を作成する
    - 既存の `cache.ts` パターンに準拠して Upstash Redis ベースのキャッシュを実装する
    - `getCachedPubDevVersionInfo` / `setCachedPubDevVersionInfo`（キー: `pubdev:{packageName}`、TTL: 3600秒）
    - `getCachedPubDevAdvisories` / `setCachedPubDevAdvisories`（キー: `pubdev-advisory:{packageName}`、TTL: 3600秒）
    - `cachedFetchVersionInfos` / `cachedFetchAdvisories`（キャッシュ付きラッパー）
    - Redis 接続失敗時はキャッシュをスキップして pub.dev API に直接リクエスト（フェイルオープン）
    - _Requirements: 9.4, 9.5, 9.6_

- [ ] 9. Flutter 監査エンジンを実装する
  - [ ] 9.1 `web/lib/flutter/flutter-audit-engine.ts` を作成する
    - `runFlutterAudit(options: FlutterAuditOptions): Promise<FlutterAuditReportWithWarnings>` を実装する
    - 処理フロー: pubspec パース → 監査対象抽出 → パッケージ数上限チェック（200） → pub.dev API 並列呼び出し（Promise.allSettled） → 4カテゴリ分類 → FlutterAuditReport 構築
    - グレースフルデグラデーション: バージョン情報取得失敗時は latestVersion を null に、アドバイザリ取得失敗時は空配列に
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 9.2 Property 10: パッケージ数上限の適用テストを書く
    - **Property 10: パッケージ数上限の適用**
    - 200 を超える hosted direct パッケージを含む pubspec.lock に対して、`runFlutterAudit` が最大 200 パッケージのみ処理し、警告メッセージを含めることを検証する
    - テストファイル: `web/__tests__/properties/flutter-audit-engine.property.test.ts`
    - **Validates: Requirements 12.1, 12.2**

- [ ] 10. Markdown レポート生成を実装する
  - [ ] 10.1 `web/lib/flutter/flutter-report-generator.ts` を作成する
    - `generateFlutterMarkdownReport(report: FlutterAuditReport): string` を実装する
    - Dart CLI の MarkdownReporter と同等の形式でレポートを生成する
    - セクション: はじめに、Critical Security、Maintenance Update、Stability、Up to Date、Security Advisories（参考リンク付き）、Summary
    - _Requirements: 7.2, 7.3_

  - [ ]* 10.2 Property 9: Markdown レポートの完全性テストを書く
    - **Property 9: Markdown レポートの完全性**
    - 任意の有効な `FlutterAuditReport` に対して、`generateFlutterMarkdownReport` が全必須セクションヘッダーを含むことを検証する
    - 各パッケージが対応するカテゴリセクションに出現することを検証する
    - テストファイル: `web/__tests__/properties/flutter-report-generator.property.test.ts`
    - **Validates: Requirements 7.2, 7.3**

- [ ] 11. Checkpoint - バックエンドモジュール全体のテストが通ることを確認する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. API ルートとミドルウェアを実装する
  - [ ] 12.1 `web/app/api/flutter-audit/route.ts` を作成する
    - `POST` ハンドラーを実装する（既存の `app/api/audit/route.ts` パターンに準拠）
    - FormData から pubspec.yaml（必須）と pubspec.lock（必須）を取得する
    - リクエストボディサイズチェック（10MB 上限、413 レスポンス）
    - ファイルバリデーション（400 レスポンス）
    - `runFlutterAudit` を呼び出して FlutterAuditReport JSON を返す
    - _Requirements: 8.1, 8.2, 10.1, 10.2, 10.3, 10.4, 10.5, 13.1, 13.4_

  - [ ] 12.2 `web/middleware.ts` の matcher を拡張する
    - `config.matcher` を `'/api/audit'` から `['/api/audit', '/api/flutter-audit']` に変更する
    - 既存のレート制限ロジックが Flutter 監査エンドポイントにも適用されることを確認する
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 13. フロントエンドコンポーネントを実装する
  - [ ] 13.1 `web/components/EcosystemPicker.tsx` を作成する
    - npm/yarn と Flutter/Dart の2つの選択肢をカード形式で表示する
    - `onSelect: (ecosystem: 'npm' | 'flutter') => void` コールバックで選択を通知する
    - _Requirements: 14.1_

  - [ ] 13.2 `web/components/FlutterFileUpload.tsx` を作成する
    - pubspec.yaml（必須）と pubspec.lock（必須）のファイル選択 UI を実装する
    - ドラッグ&ドロップ対応（ファイル名自動判別: pubspec.yaml / pubspec.lock）
    - クライアントサイドのファイルサイズプレチェック（5MB 上限）
    - POST /api/flutter-audit に FormData を送信する
    - ローディングインジケーター表示
    - プライバシーポリシー説明文の表示
    - 既存の `FileUpload.tsx` のパターンに準拠する
    - _Requirements: 1.1, 1.2, 1.3, 6.5, 8.3_

  - [ ] 13.3 `web/components/SdkInfoHeader.tsx` を作成する
    - Dart SDK と Flutter SDK のバージョン情報をヘッダーに表示する
    - _Requirements: 6.7_

  - [ ] 13.4 `web/components/FlutterAuditResults.tsx` を作成する
    - `FlutterAuditReport` → `AuditReport` へのアダプター変換を実装する（設計書の `toNpmAuditReport` / `toNpmAuditResult`）
    - `SdkInfoHeader` で SDK バージョンを表示する
    - 既存の `Summary` / `CategorySection` コンポーネントを再利用して4カテゴリ表示する
    - 各パッケージ名に pub.dev のパッケージページ（`https://pub.dev/packages/{name}`）へのリンクを付与する
    - Markdown レポートダウンロードボタン（`flutter-audit-report.md` ファイル名）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 7.1, 7.4, 14.5_

- [ ] 14. トップページにエコシステム選択を統合する
  - [ ] 14.1 `web/app/page.tsx` を変更する
    - `AppState` 型に `'select'` フェーズと `ecosystem` フィールドを追加する
    - 初期状態を `{ phase: 'select' }` に変更する
    - `EcosystemPicker` → npm 選択時は既存の `FileUpload` + `AuditResults` フロー
    - `EcosystemPicker` → Flutter 選択時は `FlutterFileUpload` + `FlutterAuditResults` フロー
    - 「戻る」ボタンでエコシステム選択画面に戻れるようにする
    - ヘッダーの説明文をエコシステム共通の表現に更新する
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 15. Checkpoint - フロントエンドとバックエンドの統合を確認する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. 最終確認とビルド検証
  - [ ] 16.1 `npm run build` でビルドが成功することを確認する
    - TypeScript コンパイルエラーがないことを確認する
    - 既存の npm/yarn 監査機能（POST /api/audit）に影響がないことを確認する
    - _Requirements: 14.4_

  - [ ] 16.2 全テストが通ることを確認する
    - `npm run test` で全テスト実行
    - `npm run test:properties` でプロパティベーステスト実行
    - _Requirements: 全要件_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (11 properties)
- Unit tests validate specific examples and edge cases
- 既存の npm/yarn 監査コードには変更を加えない（middleware.ts の matcher 拡張と page.tsx の変更のみ）
- Flutter 固有のロジックは全て `web/lib/flutter/` ディレクトリに集約する
- フロントエンドは既存の Summary / CategorySection コンポーネントをアダプター変換で再利用する
