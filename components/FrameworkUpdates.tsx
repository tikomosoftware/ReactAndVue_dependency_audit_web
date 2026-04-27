'use client';

import { FrameworkUpdateInfo } from '@core/models/types';

interface FrameworkUpdatesProps {
  updates: FrameworkUpdateInfo[];
}

/**
 * フレームワーク更新情報コンポーネント。
 * フレームワーク名、現在/最新バージョン、更新種別、リリースノートリンクを表示する。
 * メジャーアップデートは視覚的に強調する。
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */
export default function FrameworkUpdates({ updates }: FrameworkUpdatesProps) {
  if (updates.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="Framework Updates">
            🔵
          </span>
          <h3 className="text-base font-semibold text-gray-900">
            Framework Updates
          </h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700">
            {updates.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th scope="col" className="px-6 py-3">フレームワーク</th>
              <th scope="col" className="px-6 py-3">現在バージョン</th>
              <th scope="col" className="px-6 py-3">最新バージョン</th>
              <th scope="col" className="px-6 py-3">更新種別</th>
              <th scope="col" className="px-6 py-3">リリースノート</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {updates.map((update) => (
              <FrameworkRow key={update.name} update={update} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 更新種別を判定する */
function getUpdateType(update: FrameworkUpdateInfo): 'Major' | 'Minor/Patch' {
  return update.hasMajorUpdate ? 'Major' : 'Minor/Patch';
}

/** フレームワーク行コンポーネント */
function FrameworkRow({ update }: { update: FrameworkUpdateInfo }) {
  const isMajor = update.hasMajorUpdate;
  const updateType = getUpdateType(update);

  return (
    <tr
      className={`transition-colors ${
        isMajor
          ? 'bg-amber-50 hover:bg-amber-100'
          : 'hover:bg-gray-50'
      }`}
    >
      <td className="px-6 py-3 font-medium text-gray-900">{update.name}</td>
      <td className="px-6 py-3 font-mono text-gray-600">
        {update.currentVersion}
      </td>
      <td className="px-6 py-3 font-mono text-gray-600">
        {update.latestVersion}
      </td>
      <td className="px-6 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isMajor
              ? 'bg-amber-200 text-amber-900'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {updateType}
        </span>
      </td>
      <td className="px-6 py-3">
        <a
          href={update.releaseNotesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          リリースノート ↗
        </a>
      </td>
    </tr>
  );
}
