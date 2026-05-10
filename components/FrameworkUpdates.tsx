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
    <section className="category-section">
      <div style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.25rem' }} role="img" aria-label="Framework Updates">
            🔵
          </span>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Framework Updates
          </h3>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 10px',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: 'var(--surface-soft)',
              color: 'var(--muted)',
              border: '1px solid var(--line)',
            }}
          >
            {updates.length}
          </span>
        </div>
      </div>

      <div className="table-wrap" style={{ borderTop: '1px solid var(--line)', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>フレームワーク</th>
              <th>現在バージョン</th>
              <th>最新バージョン</th>
              <th>更新種別</th>
              <th>リリースノート</th>
            </tr>
          </thead>
          <tbody>
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
    <tr className={isMajor ? 'fw-row-major' : ''}>
      <td style={{ fontWeight: 500 }}>{update.name}</td>
      <td style={{ fontFamily: 'monospace' }}>
        {update.currentVersion}
      </td>
      <td style={{ fontFamily: 'monospace' }}>
        {update.latestVersion}
      </td>
      <td>
        <span
          className={isMajor ? 'badge-major' : 'badge-minor'}
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {updateType}
        </span>
      </td>
      <td>
        <a
          href={update.releaseNotesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-accent"
        >
          リリースノート ↗
        </a>
      </td>
    </tr>
  );
}
