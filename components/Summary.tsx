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
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        📊 監査サマリー
      </h2>

      <p className="mb-4 text-sm text-gray-600">
        確認パッケージ総数:{' '}
        <span className="font-bold text-gray-900">{totalPackages}</span> 件
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categoryCounts.map(({ category, emoji, label, count }) => (
          <div
            key={category}
            className="flex flex-col items-center rounded-lg border border-gray-100 bg-gray-50 px-3 py-4"
          >
            <span className="text-2xl" role="img" aria-label={label}>
              {emoji}
            </span>
            <span className="mt-1 text-2xl font-bold text-gray-900">
              {count}
            </span>
            <span className="mt-0.5 text-center text-xs text-gray-500">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
