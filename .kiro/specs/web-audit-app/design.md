# 設計書: Flutter/Dart 依存パッケージ監査 Web アプリ

## Overview

既存の ReactAndVue Web Audit App（Next.js 15 App Router）に Flutter/Dart エコシステム向けの依存パッケージ監査機能を追加する。Flutter CLI ツール（`flutter_dependency_audit/`）の File Mode ロジックを TypeScript に移植し、`pubspec.yaml` + `pubspec.lock` のパース、pub.dev API からのバージョン情報・セキュリティアドバイザリ取得、4カテゴリ分類、Markdown レポート生成を Web アプリ上で実現する。

### 設計方針

1. **既存パターンの踏襲**: 既存の npm/yarn 監査機能（`audit-engine.ts`、`file-validator.ts`、`cache.ts`、`rate-limit.ts`）のアーキテクチャとコード構成を踏襲する
2. **独立した Flutter モジュール群**: Flutter 固有のロジックは `web/lib/flutter/` ディレクトリに集約し、既存コードへの影響を最小化する
3. **フロントエンド共通化**: `Summary`、`CategorySection` 等の既存コンポーネントを Flutter 監査結果の表示にも再利用する
4. **型安全性**: Flutter 監査用の TypeScript 型定義を新設し、既存の npm/yarn 型とは独立させる

## Architecture

### システム構成図

```mermaid
graph TB
    subgraph Frontend["Web_Audit_Frontend (React)"]
        EP[EcosystemPicker] --> |npm/yarn| FU_NPM[FileUpload<br/>既存]
        EP --> |Flutter/Dart| FU_FL[FlutterFileUpload<br/>新規]
        FU_NPM --> AR_NPM[AuditResults<br/>既存]
        FU_FL --> AR_FL[FlutterAuditResults<br/>新規]
        AR_FL --> SUM[Summary<br/>再利用]
        AR_FL --> CS[CategorySection<br/>再利用]
        AR_FL --> SDK[SdkInfoHeader<br/>新規]
    end

    subgraph API["Next.js API Routes"]
        FU_NPM --> |POST /api/audit| ROUTE_NPM[route.ts<br/>既存]
        FU_FL --> |POST /api/flutter-audit| ROUTE_FL[route.ts<br/>新規]
    end

    subgraph FlutterLib["web/lib/flutter/"]
        ROUTE_FL --> FV[flutter-file-validator.ts]
        ROUTE_FL --> FAE[flutter-audit-engine.ts]
        FAE --> PP[pubspec-parser.ts]
        FAE --> PDC[pubdev-client.ts]
        FAE --> FC[flutter-categorizer.ts]
        FAE --> FRG[flutter-report-generator.ts]
    end

    subgraph SharedInfra["共有インフラ"]
        ROUTE_FL --> MW[middleware.ts<br/>拡張]
        PDC --> CACHE[flutter-cache.ts<br/>新規]
        CACHE --> REDIS[(Upstash Redis)]
        MW --> RL[rate-limit.ts<br/>既存]
    end

    subgraph External["外部 API"]
        PDC --> |GET /api/packages/{name}| PUBDEV[pub.dev API]
        PDC --> |GET /api/packages/{name}/advisories| PUBDEV
    end
```

### ディレクトリ構成

```
web/
├── app/
│   ├── api/
│   │   ├── audit/route.ts              # 既存: npm/yarn 監査
│   │   └── flutter-audit/route.ts      # 新規: Flutter 監査
│   ├── page.tsx                         # 変更: EcosystemPicker 追加
│   └── layout.tsx                       # 変更なし
├── components/
│   ├── FileUpload.tsx                   # 既存: npm/yarn 用
│   ├── FlutterFileUpload.tsx            # 新規: Flutter 用
│   ├── AuditResults.tsx                 # 既存: npm/yarn 用
│   ├── FlutterAuditResults.tsx          # 新規: Flutter 用
│   ├── EcosystemPicker.tsx              # 新規: エコシステム選択
│   ├── SdkInfoHeader.tsx                # 新規: SDK バージョン表示
│   ├── Summary.tsx                      # 既存: 再利用
│   ├── CategorySection.tsx              # 既存: 再利用（拡張）
│   └── FrameworkUpdates.tsx             # 既存: npm/yarn 専用
├── lib/
│   ├── audit-engine.ts                  # 既存
│   ├── file-validator.ts                # 既存
│   ├── cache.ts                         # 既存: npm/yarn 用
│   ├── rate-limit.ts                    # 既存
│   └── flutter/
│       ├── types.ts                     # 新規: Flutter 監査型定義
│       ├── pubspec-parser.ts            # 新規: pubspec パーサー
│       ├── pubdev-client.ts             # 新規: pub.dev API クライアント
│       ├── flutter-categorizer.ts       # 新規: 4カテゴリ分類
│       ├── flutter-file-validator.ts    # 新規: ファイルバリデーション
│       ├── flutter-audit-engine.ts      # 新規: 監査エンジン
│       ├── flutter-cache.ts             # 新規: pub.dev API キャッシュ
│       └── flutter-report-generator.ts  # 新規: Markdown レポート生成
└── middleware.ts                         # 変更: matcher 拡張
```

## Components and Interfaces

### 1. pubspec-parser.ts

Dart CLI の `PubspecAnalyzer.parseLockFile()` を TypeScript に移植する。行ベースのパーサーで pubspec.lock の YAML-like 形式を解析する。

```typescript
/** pubspec.lock から抽出されたパッケージ情報 */
export interface PubspecPackage {
  name: string;
  version: string;
  source: 'hosted' | 'sdk' | 'path' | 'git';
  dependency: 'direct main' | 'direct dev' | 'transitive';
  description?: {
    name?: string;
    url?: string;
  };
}

/** pubspec.lock のパース結果 */
export interface ParsedPubspecLock {
  packages: PubspecPackage[];
  sdks: {
    dart?: string;
    flutter?: string;
  };
}

/** pubspec.yaml から抽出されるプロジェクト情報 */
export interface PubspecYamlInfo {
  name: string;
}

/**
 * pubspec.lock を行ベースで解析する。
 * Dart CLI の PubspecAnalyzer.parseLockFile() と同等のロジック。
 */
export function parsePubspecLock(content: string): ParsedPubspecLock;

/**
 * pubspec.yaml からプロジェクト名を抽出する。
 * 簡易的な行ベースパースで "name:" フィールドを取得する。
 */
export function parsePubspecYaml(content: string): PubspecYamlInfo;

/**
 * パース結果から監査対象パッケージを抽出する。
 * - source が "hosted" のパッケージのみ
 * - デフォルトで direct main / direct dev のみ（transitive 除外）
 */
export function extractAuditTargets(
  parsed: ParsedPubspecLock,
  options?: { includeTransitive?: boolean },
): PubspecPackage[];
```

### 2. pubdev-client.ts

pub.dev API へのリクエストを担当する。バージョン情報取得とアドバイザリ取得の2つのエンドポイントを呼び出す。

```typescript
/** pub.dev から取得したバージョン情報 */
export interface PubDevVersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string | null;
  isDiscontinued: boolean;
  fetchError?: string;
}

/** pub.dev から取得したアドバイザリ情報 */
export interface PubDevAdvisory {
  packageName: string;
  advisoryId: string;
  title: string | null;
  description: string | null;
  severity: string | null;       // "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  cvssScore: number | null;
  cveId: string | null;
  url: string;
  affectedVersions: string[];
  introducedVersion: string | null;
  fixedVersion: string | null;
}

/**
 * 各パッケージの最新バージョンを pub.dev API から取得する。
 * GET https://pub.dev/api/packages/{name}
 */
export async function fetchVersionInfos(
  packages: PubspecPackage[],
): Promise<PubDevVersionInfo[]>;

/**
 * 各パッケージのセキュリティアドバイザリを pub.dev API から取得する。
 * GET https://pub.dev/api/packages/{name}/advisories
 * 現在バージョンに影響するアドバイザリのみをフィルタリングして返す。
 */
export async function fetchAdvisories(
  packages: PubspecPackage[],
): Promise<Map<string, PubDevAdvisory[]>>;

/**
 * バージョン文字列が指定されたアドバイザリの影響範囲内かを判定する。
 * Dart CLI の AdvisoryInfo.isVersionAffected() と同等のロジック。
 */
export function isVersionAffected(
  currentVersion: string | null,
  introducedVersion: string | null,
  fixedVersion: string | null,
): boolean;
```

### 3. flutter-categorizer.ts

Dart CLI の `Categorizer` と同等の4カテゴリ分類ロジック。

```typescript
import { FlutterAuditCategory, FlutterAuditResult } from './types';
import { PubDevVersionInfo, PubDevAdvisory } from './pubdev-client';
import { PubspecPackage } from './pubspec-parser';

/**
 * パッケージを4カテゴリに分類する。
 * 分類ルール:
 * 1. アドバイザリあり → Critical Security
 * 2. メジャーバージョン差分 → Maintenance Update
 * 3. マイナー/パッチ差分 → Stability
 * 4. 最新 or バージョン取得失敗 → Up to Date
 */
export function categorize(
  packages: PubspecPackage[],
  versionInfos: PubDevVersionInfo[],
  advisories: Map<string, PubDevAdvisory[]>,
): FlutterAuditResult[];

/**
 * セマンティックバージョニングを解析する。
 * プレリリースタグ（-beta.1）やビルドメタデータ（+1）を正しく処理する。
 */
export function parseSemver(version: string): {
  major: number;
  minor: number;
  patch: number;
} | null;

/**
 * 2つのバージョン間の差分種別を判定する。
 */
export function getVersionDiffType(
  current: string,
  latest: string,
): 'major' | 'minor' | 'patch' | 'none' | 'unknown';
```

### 4. flutter-file-validator.ts

既存の `file-validator.ts` パターンに準拠した Flutter ファイルバリデーション。

```typescript
/** バリデーション結果 */
export interface FlutterValidationResult {
  valid: boolean;
  error?: string;
}

/** バリデーション済みファイルデータ */
export interface FlutterValidatedFiles {
  pubspecYamlContent: string;
  pubspecLockContent: string;
}

/** 許可する MIME タイプ */
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/yaml',
  'application/x-yaml',
  'application/octet-stream',
];

/**
 * pubspec.yaml を検証する。
 * - MIME タイプ検証
 * - ファイルサイズ上限（5MB）
 * - YAML 形式の基本検証（"name:" フィールド存在確認）
 */
export async function validatePubspecYaml(
  file: File,
): Promise<FlutterValidationResult>;

/**
 * pubspec.lock を検証する。
 * - MIME タイプ検証
 * - ファイルサイズ上限（5MB）
 * - "packages:" セクション存在確認
 */
export async function validatePubspecLock(
  file: File,
): Promise<FlutterValidationResult>;

/**
 * FormData からファイルを取得・検証し、内容を返す。
 */
export async function validateAndExtractFlutterFiles(
  formData: FormData,
): Promise<FlutterValidatedFiles>;
```

### 5. flutter-audit-engine.ts

既存の `audit-engine.ts` パターンに準拠した Flutter 監査パイプライン。

```typescript
import { FlutterAuditReport } from './types';

/** 監査オプション */
export interface FlutterAuditOptions {
  pubspecYamlContent: string;
  pubspecLockContent: string;
}

/** 監査結果（警告付き） */
export interface FlutterAuditReportWithWarnings {
  report: FlutterAuditReport;
  warnings: string[];
}

/**
 * Flutter 監査パイプラインを実行する。
 *
 * 処理フロー:
 * 1. pubspec.yaml / pubspec.lock パース
 * 2. 監査対象パッケージ抽出（hosted + direct のみ）
 * 3. パッケージ数上限チェック（200）
 * 4. pub.dev API 並列呼び出し（Promise.allSettled）
 *    - バージョン情報取得
 *    - アドバイザリ取得
 * 5. 4カテゴリ分類
 * 6. FlutterAuditReport 構築
 */
export async function runFlutterAudit(
  options: FlutterAuditOptions,
): Promise<FlutterAuditReportWithWarnings>;
```

### 6. flutter-cache.ts

既存の `cache.ts` パターンに準拠した pub.dev API キャッシュ。

```typescript
/**
 * pub.dev バージョン情報のキャッシュ取得。
 * キー: `pubdev:{packageName}`、TTL: 3600秒
 */
export async function getCachedPubDevVersionInfo(
  packageName: string,
): Promise<PubDevVersionInfo | null>;

/**
 * pub.dev バージョン情報のキャッシュ保存。
 */
export async function setCachedPubDevVersionInfo(
  packageName: string,
  info: PubDevVersionInfo,
): Promise<void>;

/**
 * pub.dev アドバイザリ情報のキャッシュ取得。
 * キー: `pubdev-advisory:{packageName}`、TTL: 3600秒
 */
export async function getCachedPubDevAdvisories(
  packageName: string,
): Promise<PubDevAdvisory[] | null>;

/**
 * pub.dev アドバイザリ情報のキャッシュ保存。
 */
export async function setCachedPubDevAdvisories(
  packageName: string,
  advisories: PubDevAdvisory[],
): Promise<void>;

/**
 * キャッシュ付きバージョン情報取得。
 * キャッシュヒット時は pub.dev API 呼び出しを省略する。
 */
export async function cachedFetchVersionInfos(
  packages: PubspecPackage[],
): Promise<PubDevVersionInfo[]>;

/**
 * キャッシュ付きアドバイザリ取得。
 * キャッシュヒット時は pub.dev API 呼び出しを省略する。
 */
export async function cachedFetchAdvisories(
  packages: PubspecPackage[],
): Promise<Map<string, PubDevAdvisory[]>>;
```

### 7. flutter-report-generator.ts

Dart CLI の `MarkdownReporter` と同等の Markdown レポート生成。

```typescript
/**
 * Flutter 監査結果から Markdown レポートを生成する。
 * Dart CLI の MarkdownReporter.generate() と同等の形式。
 *
 * セクション構成:
 * - はじめに
 * - Critical Security
 * - Maintenance Update
 * - Stability
 * - Up to Date
 * - Security Advisories（参考リンク付き）
 * - Summary
 */
export function generateFlutterMarkdownReport(
  report: FlutterAuditReport,
): string;
```

### 8. フロントエンドコンポーネント

#### EcosystemPicker.tsx

```typescript
interface EcosystemPickerProps {
  onSelect: (ecosystem: 'npm' | 'flutter') => void;
}

/**
 * エコシステム選択コンポーネント。
 * npm/yarn と Flutter/Dart の2つの選択肢を表示する。
 */
export default function EcosystemPicker({ onSelect }: EcosystemPickerProps);
```

#### FlutterFileUpload.tsx

```typescript
interface FlutterFileUploadProps {
  onAuditComplete: (report: FlutterAuditReport, warnings?: string[]) => void;
  onError: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Flutter ファイルアップロードコンポーネント。
 * - pubspec.yaml（必須）と pubspec.lock（必須）のファイル選択 UI
 * - ドラッグ&ドロップ対応（ファイル名自動判別）
 * - POST /api/flutter-audit に FormData 送信
 */
export default function FlutterFileUpload(props: FlutterFileUploadProps);
```

#### FlutterAuditResults.tsx

```typescript
interface FlutterAuditResultsProps {
  report: FlutterAuditReport;
}

/**
 * Flutter 監査結果コンテナコンポーネント。
 * - SdkInfoHeader: Dart/Flutter SDK バージョン表示
 * - Summary: カテゴリ別件数サマリー（既存コンポーネント再利用のため変換）
 * - CategorySection: 4カテゴリ表示（既存コンポーネント再利用のため変換）
 * - Markdown レポートダウンロードボタン
 */
export default function FlutterAuditResults(props: FlutterAuditResultsProps);
```

#### SdkInfoHeader.tsx

```typescript
interface SdkInfoHeaderProps {
  dartVersion?: string;
  flutterVersion?: string;
}

/**
 * SDK バージョン情報ヘッダーコンポーネント。
 * Dart SDK と Flutter SDK のバージョンを表示する。
 */
export default function SdkInfoHeader(props: SdkInfoHeaderProps);
```

### 9. API Route: app/api/flutter-audit/route.ts

既存の `app/api/audit/route.ts` と同じパターンで実装する。

```typescript
/**
 * POST /api/flutter-audit
 *
 * FormData で pubspec.yaml（必須）と pubspec.lock（必須）を受け取り、
 * Flutter 監査パイプラインを実行して FlutterAuditReport JSON を返す。
 *
 * レスポンス:
 *   200: { success: true, report: FlutterAuditReport, warnings: string[] }
 *   400: { success: false, error: string }
 *   413: { success: false, error: string }
 *   500: { success: false, error: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse>;
```

### 10. middleware.ts の拡張

既存の middleware の `config.matcher` を拡張して Flutter 監査エンドポイントにもレート制限を適用する。

```typescript
// 変更前
export const config = {
  matcher: '/api/audit',
};

// 変更後
export const config = {
  matcher: ['/api/audit', '/api/flutter-audit'],
};
```

### 11. page.tsx の変更

トップページにエコシステム選択 UI を追加し、選択に応じて npm/yarn 用または Flutter 用のアップロード UI を表示する。

```typescript
type Ecosystem = 'npm' | 'flutter';

type AppState =
  | { phase: 'select' }                                    // エコシステム選択
  | { phase: 'upload'; ecosystem: Ecosystem }               // ファイルアップロード
  | { phase: 'loading'; ecosystem: Ecosystem }              // 監査実行中
  | { phase: 'result'; ecosystem: 'npm'; report: AuditReport }
  | { phase: 'result'; ecosystem: 'flutter'; report: FlutterAuditReport }
  | { phase: 'error'; ecosystem: Ecosystem; message: string };
```

## Data Models

### Flutter 監査用型定義 (`web/lib/flutter/types.ts`)

```typescript
/** Flutter パッケージの依存種別 */
export type FlutterDependencyKind = 'direct' | 'dev' | 'transitive';

/** Flutter 監査カテゴリ */
export enum FlutterAuditCategory {
  CriticalSecurity = 'critical_security',
  MaintenanceUpdate = 'maintenance_update',
  Stability = 'stability',
  UpToDate = 'up_to_date',
}

/** 個別パッケージの Flutter 監査結果 */
export interface FlutterAuditResult {
  package: PubspecPackage;
  category: FlutterAuditCategory;
  versionInfo: PubDevVersionInfo;
  advisories: PubDevAdvisory[];
}

/** SDK バージョン情報 */
export interface SdkInfo {
  dart?: string;
  flutter?: string;
}

/** Flutter 監査レポート全体 */
export interface FlutterAuditReport {
  projectName: string;
  mode: 'file';
  sdkInfo: SdkInfo;
  generatedAt: Date;
  results: FlutterAuditResult[];
}
```

### 既存型との関係

Flutter 監査の型は既存の npm/yarn 監査型（`@core/models/types.ts`）とは独立して定義する。理由:

1. **パッケージ情報の構造が異なる**: npm は `specifiedRange` + `installedVersion` だが、Flutter は `version` + `source` + `dependency`
2. **脆弱性情報のソースが異なる**: npm は GitHub Advisory DB、Flutter は pub.dev Advisory API
3. **フレームワーク更新情報が不要**: Flutter 監査では SDK バージョン情報で代替
4. **フロントエンド表示時の変換**: `FlutterAuditResults` コンポーネント内で既存の `Summary`/`CategorySection` に渡すためのアダプター変換を行う

### フロントエンド表示用アダプター

既存の `Summary` と `CategorySection` コンポーネントは `AuditReport` / `AuditResult` 型を期待する。Flutter 監査結果を表示する際は、`FlutterAuditResults` コンポーネント内で以下の変換を行う:

```typescript
/** FlutterAuditResult → AuditResult への変換（表示用） */
function toNpmAuditResult(result: FlutterAuditResult): AuditResult {
  return {
    package: {
      name: result.package.name,
      specifiedRange: result.package.version,
      installedVersion: result.package.version,
      kind: result.package.dependency === 'direct main' ? 'direct'
           : result.package.dependency === 'direct dev' ? 'dev'
           : 'transitive',
    },
    category: result.category as unknown as AuditCategory,
    versionInfo: {
      name: result.versionInfo.name,
      currentVersion: result.versionInfo.currentVersion,
      latestVersion: result.versionInfo.latestVersion,
    },
    vulnerabilities: result.advisories.map(a => ({
      packageName: a.packageName,
      ghsaId: a.advisoryId,
      cveId: a.cveId,
      severity: (a.severity?.toLowerCase() ?? 'unknown') as VulnerabilityInfo['severity'],
      cvssScore: a.cvssScore,
      summary: a.title ?? '',
      affectedVersionRange: a.affectedVersions.join(', '),
      patchedVersion: a.fixedVersion,
      url: a.url,
    })),
  };
}

/** FlutterAuditReport → AuditReport への変換（Summary/CategorySection 用） */
function toNpmAuditReport(report: FlutterAuditReport): AuditReport {
  return {
    projectName: report.projectName,
    mode: 'file',
    generatedAt: report.generatedAt,
    results: report.results.map(toNpmAuditResult),
    frameworkUpdates: [],
  };
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: pubspec.lock パースのラウンドトリップ

*For any* valid set of package entries (name, version, source, dependency), serializing them into pubspec.lock format and then parsing the result with `parsePubspecLock` should produce an equivalent set of packages with matching name, version, source, and dependency fields. SDK version information in the "sdks:" section should also be preserved through the round-trip. Version strings with surrounding quotes should have quotes stripped in the parsed output.

**Validates: Requirements 2.1, 2.5, 2.6, 2.7**

### Property 2: pubspec.yaml プロジェクト名抽出

*For any* valid project name string (non-empty, no newlines), embedding it in a pubspec.yaml format as the "name:" field and parsing with `parsePubspecYaml` should return the same project name.

**Validates: Requirements 2.4**

### Property 3: 監査対象パッケージのフィルタリング

*For any* parsed pubspec.lock containing a mix of hosted, sdk, path, and git source packages with direct main, direct dev, and transitive dependency types, calling `extractAuditTargets` without `includeTransitive` should return only packages where source is "hosted" AND dependency is "direct main" or "direct dev". When `includeTransitive` is true, all hosted packages should be returned regardless of dependency type.

**Validates: Requirements 2.2, 2.3**

### Property 4: アドバイザリ影響バージョン判定

*For any* current version C, introduced version I, and fixed version F where I < F (in semver order), `isVersionAffected(C, I, F)` should return true if and only if C >= I AND C < F. When introduced or fixed is null, the function should return true (safe-side default).

**Validates: Requirements 4.2, 4.5**

### Property 5: 4カテゴリ分類の正確性

*For any* package with version info and advisory data, the `categorize` function should classify it as follows:
- If the package has one or more advisories → `CriticalSecurity`
- Else if latestVersion is non-null and major version differs from currentVersion → `MaintenanceUpdate`
- Else if latestVersion is non-null and minor or patch version differs → `Stability`
- Else (same version, or latestVersion is null) → `UpToDate`

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 6: 分類結果のソート順序

*For any* set of packages passed to `categorize`, the returned array should be sorted such that all `CriticalSecurity` results come before `MaintenanceUpdate`, which come before `Stability`, which come before `UpToDate`.

**Validates: Requirements 5.6**

### Property 7: セマンティックバージョン解析

*For any* valid semver string in the format `major.minor.patch` (optionally with pre-release tag `-xxx` or build metadata `+xxx`), `parseSemver` should correctly extract the major, minor, and patch numbers as integers, ignoring pre-release and build metadata suffixes.

**Validates: Requirements 11.1, 11.2**

### Property 8: バージョン差分分類

*For any* pair of valid semver strings (current, latest), `getVersionDiffType` should return:
- `'major'` if major numbers differ
- `'minor'` if major numbers are equal but minor numbers differ
- `'patch'` if major and minor are equal but patch numbers differ
- `'none'` if all three components are equal

**Validates: Requirements 11.3, 11.4, 11.5, 11.6**

### Property 9: Markdown レポートの完全性

*For any* valid `FlutterAuditReport` object, `generateFlutterMarkdownReport` should produce a string containing all required section headers: "はじめに", "Critical Security", "Maintenance Update", "Stability", "Up to Date", "Security Advisories", "Summary". Each package in the report should appear in its corresponding category section.

**Validates: Requirements 7.2, 7.3**

### Property 10: パッケージ数上限の適用

*For any* pubspec.lock containing more than 200 hosted direct packages, `runFlutterAudit` should process at most 200 packages and include a warning message in the result indicating the truncation.

**Validates: Requirements 12.1, 12.2**

### Property 11: ファイルバリデーションの不正入力拒否

*For any* string that does not contain a "name:" line, `validatePubspecYaml` should return `{ valid: false }`. *For any* string that does not contain a "packages:" line, `validatePubspecLock` should return `{ valid: false }`. *For any* file with a MIME type not in the allowed list (text/plain, text/yaml, application/x-yaml, application/octet-stream), validation should return `{ valid: false }`.

**Validates: Requirements 1.4, 1.5, 1.6, 13.2, 13.3**

## Error Handling

### API レイヤー

| エラー条件 | HTTP ステータス | レスポンス |
|---|---|---|
| リクエストボディ > 10MB | 413 | `{ success: false, error: "リクエストボディが上限を超えています" }` |
| FormData パース失敗 | 400 | `{ success: false, error: "リクエストの形式が不正です" }` |
| ファイルバリデーション失敗 | 400 | `{ success: false, error: "<具体的なエラーメッセージ>" }` |
| レート制限超過 | 429 | `{ success: false, error: "リクエスト回数の上限に達しました..." }` |
| 内部エラー | 500 | `{ success: false, error: "内部エラーが発生しました" }` |

### pub.dev API エラー

既存の npm/yarn 監査エンジンの `Promise.allSettled` パターンを踏襲し、グレースフルデグラデーションを実現する:

- **バージョン情報取得失敗**: 該当パッケージの `latestVersion` を `null` に設定し、`fetchError` にエラー理由を記録。監査は続行する
- **アドバイザリ取得失敗**: 該当パッケージのアドバイザリを空配列として記録。監査は続行する
- **全パッケージの API 呼び出し失敗**: 警告メッセージを結果に含め、全パッケージを `UpToDate` として分類する

### Redis キャッシュエラー

既存の `cache.ts` パターンを踏襲:

- **Redis 接続失敗**: キャッシュをスキップし、pub.dev API に直接リクエスト（フェイルオープン）
- **キャッシュ読み取り失敗**: キャッシュミスとして扱い、API 呼び出しにフォールバック
- **キャッシュ書き込み失敗**: エラーログ出力のみ、監査結果には影響しない

### フロントエンドエラー

- **ネットワークエラー**: 「ネットワークエラーが発生しました。接続を確認してください。」メッセージ + 「もう一度試す」ボタン
- **サーバーエラー（5xx）**: サーバーから返されたエラーメッセージを表示 + 「もう一度試す」ボタン
- **クライアントサイドバリデーション**: ファイルサイズ超過時にインラインエラーメッセージを表示（API 呼び出し前にブロック）

## Testing Strategy

### テストフレームワーク

既存プロジェクトの構成を踏襲:
- **テストランナー**: Vitest
- **プロパティベーステスト**: fast-check
- **コンポーネントテスト**: @testing-library/react + @testing-library/jest-dom

### プロパティベーステスト

各 Correctness Property に対応するプロパティベーステストを実装する。最低100イテレーションで実行する。

| Property | テストファイル | テスト対象関数 |
|---|---|---|
| Property 1 | `__tests__/properties/pubspec-parser.property.test.ts` | `parsePubspecLock` |
| Property 2 | `__tests__/properties/pubspec-parser.property.test.ts` | `parsePubspecYaml` |
| Property 3 | `__tests__/properties/pubspec-parser.property.test.ts` | `extractAuditTargets` |
| Property 4 | `__tests__/properties/pubdev-client.property.test.ts` | `isVersionAffected` |
| Property 5 | `__tests__/properties/flutter-categorizer.property.test.ts` | `categorize` |
| Property 6 | `__tests__/properties/flutter-categorizer.property.test.ts` | `categorize` (sort) |
| Property 7 | `__tests__/properties/flutter-categorizer.property.test.ts` | `parseSemver` |
| Property 8 | `__tests__/properties/flutter-categorizer.property.test.ts` | `getVersionDiffType` |
| Property 9 | `__tests__/properties/flutter-report-generator.property.test.ts` | `generateFlutterMarkdownReport` |
| Property 10 | `__tests__/properties/flutter-audit-engine.property.test.ts` | `runFlutterAudit` |
| Property 11 | `__tests__/properties/flutter-file-validator.property.test.ts` | `validatePubspecYaml`, `validatePubspecLock` |

各テストには以下のタグコメントを付与する:
```typescript
// Feature: web-audit-app, Property 1: pubspec.lock パースのラウンドトリップ
```

### ユニットテスト（例示ベース）

プロパティベーステストを補完する具体的なシナリオテスト:

- **pubspec-parser**: 実際の pubspec.lock ファイル（flutter_dependency_audit/pubspec.lock）を使ったパーステスト
- **pubdev-client**: モック HTTP レスポンスを使った API クライアントテスト（200, 404, 429, タイムアウト）
- **flutter-file-validator**: 境界値テスト（5MB ちょうど、5MB+1バイト）、MIME タイプテスト
- **flutter-audit-engine**: エンドツーエンドの監査パイプラインテスト（モック API 使用）
- **フロントエンドコンポーネント**: EcosystemPicker、FlutterFileUpload、FlutterAuditResults の描画テスト

### テストディレクトリ構成

```
web/__tests__/
├── properties/
│   ├── pubspec-parser.property.test.ts
│   ├── pubdev-client.property.test.ts
│   ├── flutter-categorizer.property.test.ts
│   ├── flutter-report-generator.property.test.ts
│   ├── flutter-audit-engine.property.test.ts
│   └── flutter-file-validator.property.test.ts
├── unit/
│   ├── pubspec-parser.test.ts
│   ├── pubdev-client.test.ts
│   ├── flutter-categorizer.test.ts
│   ├── flutter-file-validator.test.ts
│   ├── flutter-audit-engine.test.ts
│   └── flutter-report-generator.test.ts
└── components/
    ├── EcosystemPicker.test.tsx
    ├── FlutterFileUpload.test.tsx
    └── FlutterAuditResults.test.tsx
```

### テスト実行コマンド

```bash
# 全テスト実行
npm run test

# プロパティベーステストのみ
npm run test:properties

# 特定ファイル
npx vitest --run __tests__/properties/pubspec-parser.property.test.ts
```
