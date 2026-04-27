/**
 * 4カテゴリ分類ロジック
 *
 * パッケージを脆弱性情報・バージョン差分に基づいて以下の4カテゴリに分類する:
 * 1. CriticalSecurity: 脆弱性あり
 * 2. MaintenanceUpdate: 脆弱性なし + メジャーバージョン更新あり
 * 3. Stability: 脆弱性なし + マイナー/パッチ更新のみ
 * 4. UpToDate: 最新バージョン（更新不要）
 */

import {
  PackageDependency,
  VersionInfo,
  VulnerabilityInfo,
  AuditCategory,
  AuditResult,
} from './models/types.js';
import { getDiffType } from './utils/semver.js';

/**
 * パッケージ情報・バージョン情報・脆弱性情報を基に、各パッケージを4カテゴリに分類する。
 *
 * 分類ルール:
 * 1. 脆弱性あり → CriticalSecurity
 * 2. 脆弱性なし + メジャー更新あり → MaintenanceUpdate
 * 3. 脆弱性なし + マイナー/パッチ更新のみ → Stability
 * 4. 最新バージョン（更新不要）→ UpToDate
 *
 * エッジケース:
 * - latestVersion が null（取得失敗）の場合 → UpToDate（更新状況を判定できない）
 * - getDiffType が 'unknown' を返す場合 → UpToDate
 * - getDiffType が 'none' を返す場合 → UpToDate
 */
export function categorize(
  packages: PackageDependency[],
  versions: VersionInfo[],
  vulnerabilities: Map<string, VulnerabilityInfo[]>,
): AuditResult[] {
  // バージョン情報をパッケージ名でルックアップできるようにする
  const versionMap = new Map<string, VersionInfo>();
  for (const v of versions) {
    versionMap.set(v.name, v);
  }

  return packages.map((pkg) => {
    const versionInfo = versionMap.get(pkg.name) ?? {
      name: pkg.name,
      currentVersion: pkg.installedVersion,
      latestVersion: null,
    };

    const pkgVulnerabilities = vulnerabilities.get(pkg.name) ?? [];

    const category = classifyPackage(versionInfo, pkgVulnerabilities);

    return {
      package: pkg,
      category,
      versionInfo,
      vulnerabilities: pkgVulnerabilities,
    };
  });
}

/**
 * 単一パッケージのカテゴリを判定する。
 */
function classifyPackage(
  versionInfo: VersionInfo,
  vulnerabilities: VulnerabilityInfo[],
): AuditCategory {
  // ルール1: 脆弱性あり → CriticalSecurity
  if (vulnerabilities.length > 0) {
    return AuditCategory.CriticalSecurity;
  }

  // latestVersion が null（取得失敗）の場合は UpToDate
  if (versionInfo.latestVersion === null) {
    return AuditCategory.UpToDate;
  }

  const diffType = getDiffType(
    versionInfo.currentVersion,
    versionInfo.latestVersion,
  );

  switch (diffType) {
    // ルール2: メジャー更新あり → MaintenanceUpdate
    case 'major':
      return AuditCategory.MaintenanceUpdate;

    // ルール3: マイナー/パッチ更新のみ → Stability
    case 'minor':
    case 'patch':
      return AuditCategory.Stability;

    // ルール4: 最新 or 判定不能 → UpToDate
    case 'none':
    case 'unknown':
      return AuditCategory.UpToDate;
  }
}

/**
 * includeTransitive フラグに応じてパッケージリストをフィルタリングする。
 *
 * - includeTransitive が false の場合: kind が 'direct' または 'dev' のパッケージのみ返す
 * - includeTransitive が true の場合: 全パッケージを返す
 */
export function filterByTransitive(
  packages: PackageDependency[],
  includeTransitive: boolean,
): PackageDependency[] {
  if (includeTransitive) {
    return packages;
  }
  return packages.filter((pkg) => pkg.kind === 'direct' || pkg.kind === 'dev');
}
