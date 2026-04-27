/**
 * コンソール出力レポーター
 *
 * 監査結果をターミナルに見やすく出力する。
 * カテゴリ順序: Critical Security → Maintenance Update → Stability → Up to Date
 * 各カテゴリヘッダーに絵文字アイコン（🔴🟡🟢✅）を付与。
 * Framework Updates セクション（🔵）を Summary の前に表示。
 */

import { AuditReport, AuditCategory, AuditResult, FrameworkUpdateInfo } from '../models/types.js';

/** カテゴリの表示順序と表示情報 */
const CATEGORY_DISPLAY_ORDER: {
  category: AuditCategory;
  emoji: string;
  label: string;
}[] = [
  { category: AuditCategory.CriticalSecurity, emoji: '🔴', label: 'Critical Security' },
  { category: AuditCategory.MaintenanceUpdate, emoji: '🟡', label: 'Maintenance Update' },
  { category: AuditCategory.Stability, emoji: '🟢', label: 'Stability' },
  { category: AuditCategory.UpToDate, emoji: '✅', label: 'Up to Date' },
];

/**
 * 監査結果をコンソールに出力する。
 *
 * 出力構成:
 * 1. レポートヘッダー（プロジェクト名、日付）
 * 2. カテゴリ別パッケージ一覧（Critical Security → Maintenance Update → Stability → Up to Date）
 * 3. Framework Updates セクション（🔵）
 * 4. Summary セクション（確認パッケージ数と各カテゴリの件数）
 */
export function printConsoleReport(report: AuditReport): void {
  const lines = buildConsoleReportLines(report);
  for (const line of lines) {
    console.log(line);
  }
}

/**
 * レポートの各行を文字列配列として構築する。
 * テスト容易性のために printConsoleReport から分離。
 */
export function buildConsoleReportLines(report: AuditReport): string[] {
  const lines: string[] = [];

  // ヘッダー
  lines.push('=== Web Dependency Audit Report ===');
  lines.push(`Project: ${report.projectName}`);
  lines.push(`Date: ${formatDate(report.generatedAt)}`);
  lines.push('');

  // カテゴリ別にグループ化
  const grouped = groupByCategory(report.results);

  // カテゴリ別パッケージ一覧
  for (const { category, emoji, label } of CATEGORY_DISPLAY_ORDER) {
    const results = grouped.get(category) ?? [];
    if (results.length === 0) continue;

    lines.push(`${emoji} ${label}`);
    for (const result of results) {
      lines.push(formatResultLine(result));
    }
    lines.push('');
  }

  // Framework Updates セクション
  if (report.frameworkUpdates.length > 0) {
    lines.push('🔵 Framework Updates');
    for (const fw of report.frameworkUpdates) {
      lines.push(formatFrameworkLine(fw));
    }
    lines.push('');
  }

  // Summary セクション
  const categoryCounts = countByCategory(report.results);
  lines.push('--- Summary ---');
  lines.push(`Total packages: ${report.results.length}`);
  for (const { category, emoji, label } of CATEGORY_DISPLAY_ORDER) {
    const count = categoryCounts.get(category) ?? 0;
    lines.push(`${emoji} ${label}: ${count}`);
  }

  return lines;
}

/**
 * 結果をカテゴリ別にグループ化する。
 */
function groupByCategory(results: AuditResult[]): Map<AuditCategory, AuditResult[]> {
  const grouped = new Map<AuditCategory, AuditResult[]>();
  for (const result of results) {
    const existing = grouped.get(result.category);
    if (existing) {
      existing.push(result);
    } else {
      grouped.set(result.category, [result]);
    }
  }
  return grouped;
}

/**
 * カテゴリ別の件数を集計する。
 */
function countByCategory(results: AuditResult[]): Map<AuditCategory, number> {
  const counts = new Map<AuditCategory, number>();
  for (const result of results) {
    counts.set(result.category, (counts.get(result.category) ?? 0) + 1);
  }
  return counts;
}

/**
 * 個別パッケージの結果行をフォーマットする。
 *
 * - Critical Security: パッケージ名 現在バージョン → 最新バージョン [深刻度] CVSS: スコア - 概要
 * - Maintenance Update / Stability: パッケージ名 現在バージョン → 最新バージョン
 * - Up to Date: パッケージ名 現在バージョン
 */
function formatResultLine(result: AuditResult): string {
  const pkg = result.package;
  const version = result.versionInfo;

  if (result.category === AuditCategory.CriticalSecurity) {
    const latestStr = version.latestVersion ?? version.currentVersion;
    const vulnParts: string[] = [];
    if (result.vulnerabilities.length > 0) {
      const vuln = result.vulnerabilities[0];
      vulnParts.push(`[${vuln.severity}]`);
      if (vuln.cvssScore !== null) {
        vulnParts.push(`CVSS: ${vuln.cvssScore}`);
      }
      vulnParts.push(`- ${vuln.summary}`);
    }
    const vulnStr = vulnParts.length > 0 ? ` ${vulnParts.join(' ')}` : '';
    return `  ${pkg.name} ${version.currentVersion} → ${latestStr}${vulnStr}`;
  }

  if (
    result.category === AuditCategory.MaintenanceUpdate ||
    result.category === AuditCategory.Stability
  ) {
    const latestStr = version.latestVersion ?? version.currentVersion;
    return `  ${pkg.name} ${version.currentVersion} → ${latestStr}`;
  }

  // Up to Date
  return `  ${pkg.name} ${version.currentVersion}`;
}

/**
 * フレームワーク更新情報の行をフォーマットする。
 *
 * 例: react 18.2.0 → 19.0.0 (Major Update) https://github.com/facebook/react/releases
 */
function formatFrameworkLine(fw: FrameworkUpdateInfo): string {
  const updateType = fw.hasMajorUpdate ? '(Major Update)' : '(Minor/Patch Update)';
  return `  ${fw.name} ${fw.currentVersion} → ${fw.latestVersion} ${updateType} ${fw.releaseNotesUrl}`;
}

/**
 * Date オブジェクトを YYYY-MM-DD 形式にフォーマットする。
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
