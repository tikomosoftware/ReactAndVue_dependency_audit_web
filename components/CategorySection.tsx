'use client';

import { useState } from 'react';
import { AuditCategory, AuditResult } from '@core/models/types';

interface CategorySectionProps {
  category: AuditCategory;
  results: AuditResult[];
  emoji: string;
  label: string;
}

/**
 * カテゴリ別セクションコンポーネント。
 * カテゴリヘッダー、パッケージ一覧テーブル、折りたたみ機能を提供する。
 * Critical Security カテゴリでは深刻度・CVSSスコア・脆弱性概要を追加表示する。
 *
 * Validates: Requirements 3.3, 3.4
 */
export default function CategorySection({
  category,
  results,
  emoji,
  label,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isCritical = category === AuditCategory.CriticalSecurity;

  if (results.length === 0) {
    return (
      <section className="category-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 24px' }}>
          <span style={{ fontSize: '1.25rem' }} role="img" aria-label={label}>
            {emoji}
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{label}</h3>
          <span className="category-count-badge">0</span>
        </div>
        <div style={{ borderTop: '1px solid var(--line)', padding: '16px 24px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>該当なし</p>
        </div>
      </section>
    );
  }

  return (
    <section className="category-section">
      {/* カテゴリヘッダー（折りたたみトグル） */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="category-header-btn"
        aria-expanded={isExpanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.25rem' }} role="img" aria-label={label}>
            {emoji}
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{label}</h3>
          <span className="category-count-badge">{results.length}</span>
        </div>
        <svg
          style={{
            width: '20px',
            height: '20px',
            color: 'var(--muted)',
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* パッケージ一覧テーブル */}
      {isExpanded && (
        <div className="table-wrap" style={{ borderTop: '1px solid var(--line)', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>パッケージ名</th>
                <th>現在バージョン</th>
                {category !== AuditCategory.UpToDate && (
                  <th>最新バージョン</th>
                )}
                {isCritical && (
                  <>
                    <th>深刻度</th>
                    <th>CVSS</th>
                    <th>脆弱性概要</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <CategoryRow
                  key={result.package.name}
                  result={result}
                  category={category}
                  isCritical={isCritical}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** 深刻度に応じたバッジクラス */
function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'badge-critical';
    case 'high':
      return 'badge-high';
    case 'medium':
      return 'badge-medium';
    case 'low':
      return 'badge-low';
    default:
      return 'badge-default';
  }
}

/** テーブル行コンポーネント */
function CategoryRow({
  result,
  category,
  isCritical,
}: {
  result: AuditResult;
  category: AuditCategory;
  isCritical: boolean;
}) {
  // Critical Security の場合、最も深刻な脆弱性を代表として表示
  const topVuln =
    isCritical && result.vulnerabilities.length > 0
      ? result.vulnerabilities[0]
      : null;

  return (
    <tr>
      <td style={{ fontWeight: 500 }}>
        {result.package.name}
      </td>
      <td style={{ fontFamily: 'monospace' }}>
        {result.versionInfo.currentVersion}
      </td>
      {category !== AuditCategory.UpToDate && (
        <td style={{ fontFamily: 'monospace' }}>
          {result.versionInfo.latestVersion ?? '—'}
        </td>
      )}
      {isCritical && (
        <>
          <td>
            {topVuln ? (
              <span
                className={severityBadgeClass(topVuln.severity)}
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {topVuln.severity}
              </span>
            ) : (
              <span style={{ color: 'var(--muted)' }}>—</span>
            )}
          </td>
          <td style={{ fontFamily: 'monospace' }}>
            {topVuln?.cvssScore != null ? topVuln.cvssScore.toFixed(1) : '—'}
          </td>
          <td>
            {topVuln ? (
              <div>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{topVuln.summary}</p>
                {topVuln.url && (
                  <a
                    href={topVuln.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-accent"
                    style={{ marginTop: '4px', display: 'inline-block', fontSize: '0.75rem' }}
                  >
                    {topVuln.ghsaId || '詳細'} ↗
                  </a>
                )}
              </div>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
    </tr>
  );
}
