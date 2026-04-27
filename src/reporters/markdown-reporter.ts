/**
 * Markdownレポート生成・パース
 *
 * 監査結果をMarkdown形式のレポートに変換する。
 * また、Markdown文字列からAuditReportオブジェクトへの逆変換（ラウンドトリップ用）も提供する。
 *
 * 必須セクション:
 * - はじめに
 * - 🔴 Critical Security
 * - 🟡 Maintenance Update
 * - 🟢 Stability
 * - ✅ Up to Date
 * - 🔵 Framework Updates
 * - Security Advisories
 * - Summary
 */

import {
  AuditReport,
  AuditCategory,
  AuditResult,
  FrameworkUpdateInfo,
  VulnerabilityInfo,
  PackageDependency,
  VersionInfo,
} from '../models/types.js';

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
 * AuditReport オブジェクトを Markdown 文字列に変換する。
 */
export function generateMarkdownReport(report: AuditReport): string {
  const lines: string[] = [];

  // タイトル
  lines.push('# Web Dependency Audit Report');
  lines.push('');

  // はじめに
  lines.push('## はじめに');
  lines.push(`Project: ${report.projectName}`);
  lines.push(`Date: ${formatDate(report.generatedAt)}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push('');

  // カテゴリ別にグループ化
  const grouped = groupByCategory(report.results);

  // 🔴 Critical Security
  lines.push('## 🔴 Critical Security');
  const criticalResults = grouped.get(AuditCategory.CriticalSecurity) ?? [];
  if (criticalResults.length > 0) {
    lines.push('| ライブラリ名 | 現在バージョン | 最新バージョン | 深刻度 | CVSSスコア | 脆弱性内容 |');
    lines.push('|---|---|---|---|---|---|');
    for (const result of criticalResults) {
      const version = result.versionInfo;
      const latestStr = version.latestVersion ?? version.currentVersion;
      const vuln = result.vulnerabilities[0];
      const severity = vuln?.severity ?? 'unknown';
      const cvss = vuln?.cvssScore !== null && vuln?.cvssScore !== undefined ? String(vuln.cvssScore) : 'N/A';
      const summary = vuln?.summary ?? '';
      lines.push(`| ${result.package.name} | ${version.currentVersion} | ${latestStr} | ${severity} | ${cvss} | ${summary} |`);
    }
  } else {
    lines.push('該当なし');
  }
  lines.push('');

  // 🟡 Maintenance Update
  lines.push('## 🟡 Maintenance Update');
  const maintenanceResults = grouped.get(AuditCategory.MaintenanceUpdate) ?? [];
  if (maintenanceResults.length > 0) {
    lines.push('| ライブラリ名 | 現在バージョン | 最新バージョン |');
    lines.push('|---|---|---|');
    for (const result of maintenanceResults) {
      const version = result.versionInfo;
      const latestStr = version.latestVersion ?? version.currentVersion;
      lines.push(`| ${result.package.name} | ${version.currentVersion} | ${latestStr} |`);
    }
  } else {
    lines.push('該当なし');
  }
  lines.push('');

  // 🟢 Stability
  lines.push('## 🟢 Stability');
  const stabilityResults = grouped.get(AuditCategory.Stability) ?? [];
  if (stabilityResults.length > 0) {
    lines.push('| ライブラリ名 | 現在バージョン | 最新バージョン |');
    lines.push('|---|---|---|');
    for (const result of stabilityResults) {
      const version = result.versionInfo;
      const latestStr = version.latestVersion ?? version.currentVersion;
      lines.push(`| ${result.package.name} | ${version.currentVersion} | ${latestStr} |`);
    }
  } else {
    lines.push('該当なし');
  }
  lines.push('');

  // ✅ Up to Date
  lines.push('## ✅ Up to Date');
  const upToDateResults = grouped.get(AuditCategory.UpToDate) ?? [];
  if (upToDateResults.length > 0) {
    lines.push('| ライブラリ名 | 現在バージョン |');
    lines.push('|---|---|');
    for (const result of upToDateResults) {
      const version = result.versionInfo;
      lines.push(`| ${result.package.name} | ${version.currentVersion} |`);
    }
  } else {
    lines.push('該当なし');
  }
  lines.push('');

  // 🔵 Framework Updates
  lines.push('## 🔵 Framework Updates');
  if (report.frameworkUpdates.length > 0) {
    lines.push('| フレームワーク | 現在バージョン | 最新バージョン | 更新種別 | リリースノート |');
    lines.push('|---|---|---|---|---|');
    for (const fw of report.frameworkUpdates) {
      const updateType = fw.hasMajorUpdate ? 'Major' : 'Minor/Patch';
      lines.push(`| ${fw.name} | ${fw.currentVersion} | ${fw.latestVersion} | ${updateType} | [リリースノート](${fw.releaseNotesUrl}) |`);
    }
  } else {
    lines.push('該当なし');
  }
  lines.push('');

  // Security Advisories
  lines.push('## Security Advisories');
  lines.push('- [GitHub Advisory Database](https://github.com/advisories)');
  lines.push('- [npm Security Advisories](https://www.npmjs.com/advisories)');

  // 脆弱性のあるパッケージの個別アドバイザリリンクを追加
  for (const result of criticalResults) {
    for (const vuln of result.vulnerabilities) {
      if (vuln.url) {
        lines.push(`- [${vuln.ghsaId}](${vuln.url})`);
      }
    }
  }
  lines.push('');

  // Summary
  lines.push('## Summary');
  const categoryCounts = countByCategory(report.results);
  lines.push('| 項目 | 件数 |');
  lines.push('|---|---|');
  lines.push(`| 確認パッケージ数 | ${report.results.length} |`);
  for (const { category, emoji, label } of CATEGORY_DISPLAY_ORDER) {
    const count = categoryCounts.get(category) ?? 0;
    lines.push(`| ${emoji} ${label} | ${count} |`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Markdown 文字列を AuditReport オブジェクトに変換する（ラウンドトリップ用）。
 *
 * パッケージ名、カテゴリ、バージョン情報を保持する。
 * 脆弱性の詳細情報は簡略化される場合がある。
 */
export function parseMarkdownReport(markdown: string): AuditReport {
  const lines = markdown.split('\n');

  // はじめに セクションからメタ情報を抽出
  let projectName = '';
  let generatedAt = new Date();
  let mode: 'project' | 'file' = 'project';

  const hajimeniIdx = findSectionIndex(lines, '## はじめに');
  if (hajimeniIdx !== -1) {
    const sectionLines = extractSectionLines(lines, hajimeniIdx);
    for (const line of sectionLines) {
      const projectMatch = line.match(/^Project:\s*(.+)$/);
      if (projectMatch) {
        projectName = projectMatch[1].trim();
      }
      const dateMatch = line.match(/^Date:\s*(\d{4}-\d{2}-\d{2})$/);
      if (dateMatch) {
        generatedAt = new Date(dateMatch[1]);
      }
      const modeMatch = line.match(/^Mode:\s*(project|file)$/);
      if (modeMatch) {
        mode = modeMatch[1] as 'project' | 'file';
      }
    }
  }

  const results: AuditResult[] = [];

  // 🔴 Critical Security
  const criticalIdx = findSectionIndex(lines, '## 🔴 Critical Security');
  if (criticalIdx !== -1) {
    const tableRows = extractTableRows(lines, criticalIdx);
    for (const row of tableRows) {
      // | ライブラリ名 | 現在バージョン | 最新バージョン | 深刻度 | CVSSスコア | 脆弱性内容 |
      const cells = parseTableRow(row);
      if (cells.length >= 6) {
        const name = cells[0];
        const currentVersion = cells[1];
        const latestVersion = cells[2];
        const severity = cells[3] as VulnerabilityInfo['severity'];
        const cvssStr = cells[4];
        const summary = cells[5];

        const cvssScore = cvssStr === 'N/A' ? null : parseFloat(cvssStr);

        const vuln: VulnerabilityInfo = {
          packageName: name,
          ghsaId: '',
          cveId: null,
          severity: severity,
          cvssScore: isNaN(cvssScore as number) ? null : cvssScore,
          summary: summary,
          affectedVersionRange: '',
          patchedVersion: null,
          url: '',
        };

        results.push(createAuditResult(
          name,
          currentVersion,
          latestVersion,
          AuditCategory.CriticalSecurity,
          [vuln],
        ));
      }
    }
  }

  // 🟡 Maintenance Update
  const maintenanceIdx = findSectionIndex(lines, '## 🟡 Maintenance Update');
  if (maintenanceIdx !== -1) {
    const tableRows = extractTableRows(lines, maintenanceIdx);
    for (const row of tableRows) {
      const cells = parseTableRow(row);
      if (cells.length >= 3) {
        results.push(createAuditResult(
          cells[0],
          cells[1],
          cells[2],
          AuditCategory.MaintenanceUpdate,
          [],
        ));
      }
    }
  }

  // 🟢 Stability
  const stabilityIdx = findSectionIndex(lines, '## 🟢 Stability');
  if (stabilityIdx !== -1) {
    const tableRows = extractTableRows(lines, stabilityIdx);
    for (const row of tableRows) {
      const cells = parseTableRow(row);
      if (cells.length >= 3) {
        results.push(createAuditResult(
          cells[0],
          cells[1],
          cells[2],
          AuditCategory.Stability,
          [],
        ));
      }
    }
  }

  // ✅ Up to Date
  const upToDateIdx = findSectionIndex(lines, '## ✅ Up to Date');
  if (upToDateIdx !== -1) {
    const tableRows = extractTableRows(lines, upToDateIdx);
    for (const row of tableRows) {
      const cells = parseTableRow(row);
      if (cells.length >= 2) {
        results.push(createAuditResult(
          cells[0],
          cells[1],
          cells[1], // Up to Date: latestVersion = currentVersion
          AuditCategory.UpToDate,
          [],
        ));
      }
    }
  }

  // 🔵 Framework Updates
  const frameworkUpdates: FrameworkUpdateInfo[] = [];
  const frameworkIdx = findSectionIndex(lines, '## 🔵 Framework Updates');
  if (frameworkIdx !== -1) {
    const tableRows = extractTableRows(lines, frameworkIdx);
    for (const row of tableRows) {
      const cells = parseTableRow(row);
      if (cells.length >= 5) {
        const releaseNotesCell = cells[4];
        // Extract URL from [リリースノート](url) format
        const urlMatch = releaseNotesCell.match(/\[.*?\]\((.*?)\)/);
        const releaseNotesUrl = urlMatch ? urlMatch[1] : releaseNotesCell;

        frameworkUpdates.push({
          name: cells[0],
          currentVersion: cells[1],
          latestVersion: cells[2],
          hasMajorUpdate: cells[3] === 'Major',
          releaseNotesUrl: releaseNotesUrl,
        });
      }
    }
  }

  return {
    projectName,
    mode,
    generatedAt,
    results,
    frameworkUpdates,
  };
}

// ─── Helper functions ───

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
 * Date オブジェクトを YYYY-MM-DD 形式にフォーマットする。
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 指定されたセクションヘッダーの行インデックスを返す。
 */
function findSectionIndex(lines: string[], header: string): number {
  return lines.findIndex((line) => line.trim() === header);
}

/**
 * セクションヘッダーの次の行から、次のセクションヘッダーまでの行を抽出する。
 */
function extractSectionLines(lines: string[], sectionIdx: number): string[] {
  const result: string[] = [];
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    result.push(lines[i]);
  }
  return result;
}

/**
 * セクション内のMarkdownテーブルのデータ行（ヘッダー行・区切り行を除く）を抽出する。
 */
function extractTableRows(lines: string[], sectionIdx: number): string[] {
  const sectionLines = extractSectionLines(lines, sectionIdx);
  const tableRows: string[] = [];
  let headerFound = false;
  let separatorFound = false;

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    if (!headerFound) {
      headerFound = true;
      continue; // skip header row
    }
    if (!separatorFound) {
      separatorFound = true;
      continue; // skip separator row (|---|---|...)
    }
    tableRows.push(trimmed);
  }

  return tableRows;
}

/**
 * Markdownテーブルの1行をセルの配列にパースする。
 */
function parseTableRow(row: string): string[] {
  // "| cell1 | cell2 | cell3 |" → ["cell1", "cell2", "cell3"]
  return row
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

/**
 * パース結果から AuditResult オブジェクトを生成するヘルパー。
 */
function createAuditResult(
  name: string,
  currentVersion: string,
  latestVersion: string,
  category: AuditCategory,
  vulnerabilities: VulnerabilityInfo[],
): AuditResult {
  const pkg: PackageDependency = {
    name,
    specifiedRange: `^${currentVersion}`,
    installedVersion: currentVersion,
    kind: 'direct',
  };

  const versionInfo: VersionInfo = {
    name,
    currentVersion,
    latestVersion,
  };

  return {
    package: pkg,
    category,
    versionInfo,
    vulnerabilities,
  };
}
