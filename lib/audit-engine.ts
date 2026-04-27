/**
 * 監査エンジンラッパー
 *
 * 既存コアモジュールを統合し、Web API 向けの監査パイプラインを提供する。
 * CLI の main() 関数内のロジックを関数として切り出し、Web アプリから利用可能にする。
 */

import { parsePackageJson } from '@core/parsers/package-json-parser';
import { parsePackageLock, type ParsedLockfile } from '@core/parsers/package-lock-parser';
import { parseYarnLock } from '@core/parsers/yarn-lock-parser';
import { checkVersions } from '@core/checkers/version-checker';
import { scanVulnerabilities } from '@core/checkers/vulnerability-scanner';
import { checkFrameworkUpdates } from '@core/checkers/framework-monitor';
import { categorize } from '@core/categorizer';
import type {
  PackageDependency,
  VersionInfo,
  VulnerabilityInfo,
  AuditReport,
  AuditResult,
  FrameworkUpdateInfo,
} from '@core/models/types';

/** パッケージ数上限 */
const MAX_PACKAGES = 200;

/** 監査エンジンのオプション */
export interface AuditOptions {
  packageJsonContent: string;
  lockfileContent: string | null;
  lockfileType: 'npm' | 'yarn' | null;
}

/** 監査結果（警告付き） */
export interface AuditReportWithWarnings {
  report: AuditReport;
  warnings: string[];
}

/**
 * package.json と lockfile から PackageDependency[] を構築する。
 *
 * CLI の main() 関数内のステップ4のロジックを関数として切り出したもの。
 * - package.json の dependencies / devDependencies を抽出
 * - lockfile が提供された場合は lockfile のバージョンを installedVersion に使用
 * - lockfile が提供されない場合は specifiedRange を installedVersion に使用
 */
export function buildPackageDependencies(
  packageJsonContent: string,
  lockfileContent: string | null,
  lockfileType: 'npm' | 'yarn' | null,
): PackageDependency[] {
  const parsedPackageJson = parsePackageJson(packageJsonContent);

  let parsedLockfile: ParsedLockfile | null = null;
  if (lockfileContent !== null && lockfileType !== null) {
    if (lockfileType === 'yarn') {
      parsedLockfile = parseYarnLock(lockfileContent);
    } else {
      parsedLockfile = parsePackageLock(lockfileContent);
    }
  }

  const packages: PackageDependency[] = [];
  const addedNames = new Set<string>();

  // dependencies from package.json
  for (const [name, range] of Object.entries(parsedPackageJson.dependencies)) {
    addedNames.add(name);
    const installedVersion = parsedLockfile?.packages[name]?.version ?? range;
    packages.push({
      name,
      specifiedRange: range,
      installedVersion,
      kind: 'direct',
    });
  }

  // devDependencies from package.json
  for (const [name, range] of Object.entries(parsedPackageJson.devDependencies)) {
    if (addedNames.has(name)) continue; // skip if already added as direct
    addedNames.add(name);
    const installedVersion = parsedLockfile?.packages[name]?.version ?? range;
    packages.push({
      name,
      specifiedRange: range,
      installedVersion,
      kind: 'dev',
    });
  }

  return packages;
}

/**
 * 監査パイプラインを実行する。
 *
 * 処理フロー:
 * 1. パーサーでファイル解析 → PackageDependency[] 構築
 * 2. パッケージ数上限チェック（200パッケージ）
 * 3. チェッカー並列実行（Promise.allSettled でグレースフルデグラデーション）
 *    - checkVersions: npm registry → バージョン情報
 *    - scanVulnerabilities: GitHub Advisory DB → 脆弱性情報
 *    - checkFrameworkUpdates: npm registry → フレームワーク更新情報
 * 4. カテゴリ分類
 * 5. AuditReport 構築・返却
 */
export async function runAudit(options: AuditOptions): Promise<AuditReportWithWarnings> {
  const warnings: string[] = [];

  // 1. Build PackageDependency[]
  let packages = buildPackageDependencies(
    options.packageJsonContent,
    options.lockfileContent,
    options.lockfileType,
  );

  // 2. Package limit check (200 packages)
  if (packages.length > MAX_PACKAGES) {
    warnings.push(
      `パッケージ数が上限（${MAX_PACKAGES}）を超えています。先頭${MAX_PACKAGES}パッケージのみ監査します`,
    );
    packages = packages.slice(0, MAX_PACKAGES);
  }

  // Extract project name from package.json
  const parsedPackageJson = parsePackageJson(options.packageJsonContent);
  const projectName = parsedPackageJson.name || 'unknown-project';

  // 3. Run checkers in parallel with graceful degradation (Promise.allSettled)
  const [versionsResult, vulnerabilitiesResult, frameworkUpdatesResult] =
    await Promise.allSettled([
      checkVersions(packages),
      scanVulnerabilities(packages),
      checkFrameworkUpdates(packages, []),
    ]);

  // Extract results with fallbacks for failed checkers
  let versions: VersionInfo[] = [];
  if (versionsResult.status === 'fulfilled') {
    versions = versionsResult.value;
  } else {
    console.error('バージョンチェックに失敗しました:', versionsResult.reason);
    warnings.push('バージョン情報の取得に失敗しました。npm Registry API のレート制限に達した可能性があります。');
    versions = packages.map((pkg) => ({
      name: pkg.name,
      currentVersion: pkg.installedVersion,
      latestVersion: null,
      fetchError: 'バージョン情報の取得に失敗しました',
    }));
  }

  let vulnerabilities: Map<string, VulnerabilityInfo[]> = new Map();
  if (vulnerabilitiesResult.status === 'fulfilled') {
    vulnerabilities = vulnerabilitiesResult.value;
  } else {
    console.error('脆弱性スキャンに失敗しました:', vulnerabilitiesResult.reason);
    warnings.push('脆弱性スキャンに失敗しました。GitHub API のレート制限に達した可能性があります。GITHUB_TOKEN を設定するとレート制限が緩和されます。');
  }

  let frameworkUpdates: FrameworkUpdateInfo[] = [];
  if (frameworkUpdatesResult.status === 'fulfilled') {
    frameworkUpdates = frameworkUpdatesResult.value;
  } else {
    console.error('フレームワーク更新チェックに失敗しました:', frameworkUpdatesResult.reason);
  }

  // 4. Categorize
  const results: AuditResult[] = categorize(packages, versions, vulnerabilities);

  // 5. fetchError の検出（個別パッケージレベルのAPI失敗）
  const versionErrors = versions.filter((v) => v.fetchError);
  if (versionErrors.length > 0 && versionErrors.length === versions.length) {
    warnings.push('すべてのパッケージのバージョン情報取得に失敗しました。npm Registry API のレート制限に達した可能性があります。');
  } else if (versionErrors.length > 0) {
    warnings.push(`${versionErrors.length} 件のパッケージでバージョン情報の取得に失敗しました。`);
  }

  // 脆弱性スキャン: 全パッケージの結果が空の場合、API失敗の可能性
  if (vulnerabilitiesResult.status === 'fulfilled' && packages.length > 0) {
    const allEmpty = packages.every((pkg) => {
      const vulns = vulnerabilities.get(pkg.name);
      return !vulns || vulns.length === 0;
    });
    // 全パッケージで脆弱性が0件かつパッケージ数が多い場合は警告
    // （本当に脆弱性がない可能性もあるが、レート制限の可能性を示唆）
    if (allEmpty && packages.length >= 5 && !process.env.GITHUB_TOKEN) {
      warnings.push('脆弱性情報が取得できませんでした。GITHUB_TOKEN が未設定のため、GitHub API のレート制限（60リクエスト/時間）に達した可能性があります。');
    }
  }

  // 6. Build AuditReport
  const report: AuditReport = {
    projectName,
    mode: 'file',
    generatedAt: new Date(),
    results,
    frameworkUpdates,
  };

  return { report, warnings };
}
