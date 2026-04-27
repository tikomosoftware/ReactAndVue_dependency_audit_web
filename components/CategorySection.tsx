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
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-6 py-4">
          <span className="text-xl" role="img" aria-label={label}>
            {emoji}
          </span>
          <h3 className="text-base font-semibold text-gray-900">{label}</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700">
            0
          </span>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-400">該当なし</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* カテゴリヘッダー（折りたたみトグル） */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label={label}>
            {emoji}
          </span>
          <h3 className="text-base font-semibold text-gray-900">{label}</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700">
            {results.length}
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
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
        <div className="overflow-x-auto border-t border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3">パッケージ名</th>
                <th scope="col" className="px-6 py-3">現在バージョン</th>
                {category !== AuditCategory.UpToDate && (
                  <th scope="col" className="px-6 py-3">最新バージョン</th>
                )}
                {isCritical && (
                  <>
                    <th scope="col" className="px-6 py-3">深刻度</th>
                    <th scope="col" className="px-6 py-3">CVSS</th>
                    <th scope="col" className="px-6 py-3">脆弱性概要</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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

/** 深刻度に応じたバッジカラー */
function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
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
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-3 font-medium text-gray-900">
        {result.package.name}
      </td>
      <td className="px-6 py-3 font-mono text-gray-600">
        {result.versionInfo.currentVersion}
      </td>
      {category !== AuditCategory.UpToDate && (
        <td className="px-6 py-3 font-mono text-gray-600">
          {result.versionInfo.latestVersion ?? '—'}
        </td>
      )}
      {isCritical && (
        <>
          <td className="px-6 py-3">
            {topVuln ? (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(
                  topVuln.severity,
                )}`}
              >
                {topVuln.severity}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
          <td className="px-6 py-3 font-mono text-gray-600">
            {topVuln?.cvssScore != null ? topVuln.cvssScore.toFixed(1) : '—'}
          </td>
          <td className="px-6 py-3 text-gray-600">
            {topVuln ? (
              <div>
                <p className="text-sm leading-relaxed">{topVuln.summary}</p>
                {topVuln.url && (
                  <a
                    href={topVuln.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
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
