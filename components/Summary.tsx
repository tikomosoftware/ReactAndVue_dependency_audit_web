'use client';

import { AuditReport, AuditCategory } from '@core/models/types';

interface SummaryProps {
  report: AuditReport;
}

/** カテゴリ表示設定 */
const CATEGORY_CONFIG = [
  { category: AuditCategory.CriticalSecurity, emoji: '🔴', label: 'Critical Security' },
  { category: AuditCategory.MaintenanceUpdate, emoji: '🟡', label: 'Maintenance Update' },
  { category: AuditCategory.Stability, emoji: '🟢', label: 'Stability' },
  { category: AuditCategory.UpToDate, emoji: '✅', label: 'Up to Date' },
] as const;

/**
 * サマリーコンポーネント。
 * 確認パッケージ総数と各カテゴリの件数を絵文字付きで表示する。
 *
 * Validates: Requirements 3.1, 3.2
 */
export default function Summary({ report }: SummaryProps) {
  const totalPackages = report.results.length;

  /** カテゴリごとのパッケージ数を集計 */
  const categoryCounts = CATEGORY_CONFIG.map(({ category, emoji, label }) => {
    const count = report.results.filter((r) => r.category === category).length;
    return { category, emoji, label, count };
  });

  return (
    <section className="summary-card" style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
        📊 監査サマリー
      </h2>

      <p style={{ marginBottom: '16px', fontSize: '0.875rem', color: 'var(--muted)' }}>
        確認パッケージ総数:{' '}
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{totalPackages}</span> 件
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {categoryCounts.map(({ category, emoji, label, count }) => (
          <div
            key={category}
            className="category-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 12px',
            }}
          >
            <span style={{ fontSize: '1.5rem' }} role="img" aria-label={label}>
              {emoji}
            </span>
            <span style={{ marginTop: '4px', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
              {count}
            </span>
            <span style={{ marginTop: '2px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
