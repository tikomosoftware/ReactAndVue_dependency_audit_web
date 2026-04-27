'use client';

import { useCallback } from 'react';
import { AuditReport, AuditCategory } from '@core/models/types';
import { generateMarkdownReport } from '@core/reporters/markdown-reporter';
import Summary from './Summary';
import CategorySection from './CategorySection';
import FrameworkUpdates from './FrameworkUpdates';

interface AuditResultsProps {
  report: AuditReport;
}

/** カテゴリ表示順序と設定 */
const CATEGORY_CONFIG = [
  { category: AuditCategory.CriticalSecurity, emoji: '🔴', label: 'Critical Security' },
  { category: AuditCategory.MaintenanceUpdate, emoji: '🟡', label: 'Maintenance Update' },
  { category: AuditCategory.Stability, emoji: '🟢', label: 'Stability' },
  { category: AuditCategory.UpToDate, emoji: '✅', label: 'Up to Date' },
] as const;

/**
 * 監査結果コンテナコンポーネント。
 *
 * - Summary コンポーネントの表示
 * - 4カテゴリの CategorySection を順番に表示
 * - FrameworkUpdates セクションの表示
 * - Markdown レポートダウンロードボタン
 *
 * Validates: Requirements 3.1, 5.1, 5.2, 5.3
 */
export default function AuditResults({ report }: AuditResultsProps) {
  /** Markdown レポートをダウンロードする */
  const handleDownloadMarkdown = useCallback(() => {
    const markdown = generateMarkdownReport(report);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-report.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [report]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* サマリー */}
      <Summary report={report} />

      {/* 4カテゴリセクション */}
      {CATEGORY_CONFIG.map(({ category, emoji, label }) => {
        const results = report.results.filter((r) => r.category === category);
        return (
          <CategorySection
            key={category}
            category={category}
            results={results}
            emoji={emoji}
            label={label}
          />
        );
      })}

      {/* フレームワーク更新情報 */}
      <FrameworkUpdates updates={report.frameworkUpdates} />

      {/* Markdown レポートダウンロードボタン */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleDownloadMarkdown}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Markdown レポートをダウンロード
        </button>
      </div>
    </div>
  );
}
