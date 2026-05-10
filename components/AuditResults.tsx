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
    <div style={{ maxWidth: '896px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={handleDownloadMarkdown}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '0.875rem',
          }}
        >
          <svg
            style={{ width: '16px', height: '16px' }}
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
