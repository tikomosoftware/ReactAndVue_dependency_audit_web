import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Web Dependency Audit',
  description: 'Web Dependency Audit の概要と使い方',
};

export default function AboutPage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <h1 className="brand-name">
              🔍 Web Dependency Audit
            </h1>
            <p className="brand-sub">About</p>
          </div>
          <Link href="/" className="nav-link-inactive">
            ホームに戻る
          </Link>
        </div>
      </header>

      {/* コンテンツ */}
      <div style={{ maxWidth: '768px', margin: '0 auto', padding: '32px 20px' }}>
        {/* 概要 */}
        <section className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>📦 概要</h2>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--muted)' }}>
            Web Dependency Audit は、Webフロントエンドプロジェクトの依存パッケージを監査するツールです。
            ブラウザ上で{' '}
            <code style={{ borderRadius: '4px', background: 'var(--surface-soft)', padding: '2px 6px', fontSize: '0.75rem', color: 'var(--text)' }}>package.json</code>
            {' '}と lockfile をアップロードするだけで、脆弱性チェック・バージョン更新確認・フレームワーク更新情報を
            まとめて確認できます。
          </p>
        </section>

        {/* 使い方 */}
        <section className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>🚀 使い方</h2>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem', color: 'var(--muted)' }}>
            <li style={{ display: 'flex', gap: '12px' }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', flexShrink: 0,
                borderRadius: '9999px', background: 'var(--surface-soft)',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)',
                border: '1px solid var(--line)',
              }}>1</span>
              <span>
                監査したいプロジェクトの{' '}
                <code style={{ borderRadius: '4px', background: 'var(--surface-soft)', padding: '2px 6px', fontSize: '0.75rem', color: 'var(--text)' }}>package.json</code>
                {' '}を用意します（必須）。
                <code style={{ borderRadius: '4px', background: 'var(--surface-soft)', padding: '2px 6px', fontSize: '0.75rem', color: 'var(--text)' }}>package-lock.json</code>
                {' '}または
                <code style={{ borderRadius: '4px', background: 'var(--surface-soft)', padding: '2px 6px', fontSize: '0.75rem', color: 'var(--text)' }}>yarn.lock</code>
                {' '}もあると、より正確な結果が得られます。
              </span>
            </li>
            <li style={{ display: 'flex', gap: '12px' }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', flexShrink: 0,
                borderRadius: '9999px', background: 'var(--surface-soft)',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)',
                border: '1px solid var(--line)',
              }}>2</span>
              <span>「ファイルを選択」ボタンまたはドラッグ&ドロップでファイルをアップロードします。</span>
            </li>
            <li style={{ display: 'flex', gap: '12px' }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', flexShrink: 0,
                borderRadius: '9999px', background: 'var(--surface-soft)',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)',
                border: '1px solid var(--line)',
              }}>3</span>
              <span>「監査を実行」ボタンをクリックすると、サーバーサイドで監査処理が実行されます。</span>
            </li>
            <li style={{ display: 'flex', gap: '12px' }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '24px', height: '24px', flexShrink: 0,
                borderRadius: '9999px', background: 'var(--surface-soft)',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)',
                border: '1px solid var(--line)',
              }}>4</span>
              <span>結果が4カテゴリに分類されて表示されます。Markdownレポートのダウンロードも可能です。</span>
            </li>
          </ol>
        </section>

        {/* 4カテゴリ分類 */}
        <section className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>📊 4カテゴリ分類</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { emoji: '🔴', label: 'Critical Security', desc: '脆弱性が検出されたパッケージ。早急な対応が必要です。', bg: '#fef2f2', border: '#fca5a5' },
              { emoji: '🟡', label: 'Maintenance Update', desc: 'メジャーバージョンの更新があるパッケージ。破壊的変更の可能性があります。', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
              { emoji: '🟢', label: 'Stability', desc: 'マイナー/パッチ更新があるパッケージ。バグ修正や小さな改善が含まれます。', bg: '#f0fdf4', border: '#86efac' },
              { emoji: '✅', label: 'Up to Date', desc: '最新バージョンのパッケージ。対応不要です。', bg: 'var(--surface-soft)', border: 'var(--line)' },
            ].map(({ emoji, label, desc, bg, border }) => (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  borderRadius: 'var(--radius-sm)', padding: '12px',
                  background: bg, border: `1px solid ${border}`,
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{emoji}</span>
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>{label}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 対応フレームワーク */}
        <section className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>🔵 対応フレームワーク</h2>
          <p style={{ marginBottom: '12px', fontSize: '0.875rem', color: 'var(--muted)' }}>
            以下のフレームワークの更新情報を自動検出し、メジャーアップデートを強調表示します。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['React', 'React DOM', 'Vue', 'Next.js', 'Nuxt', 'Angular'].map((fw) => (
              <span
                key={fw}
                style={{
                  borderRadius: '9999px',
                  background: 'var(--surface-soft)',
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--accent-dark)',
                  border: '1px solid var(--line)',
                }}
              >
                {fw}
              </span>
            ))}
          </div>
        </section>

        {/* プライバシー */}
        <section className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>🔒 プライバシー</h2>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem', color: 'var(--muted)' }}>
            <li>• アップロードされたファイルはサーバーに保存されません</li>
            <li>• ファイルはサーバーレス関数のメモリ上でのみ処理され、処理完了後に破棄されます</li>
            <li>• 通信はHTTPSで暗号化されます（Vercelデプロイ時）</li>
          </ul>
        </section>

        {/* 技術情報 */}
        <section className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>⚙️ 技術情報</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500, width: '160px' }}>フレームワーク</td>
                  <td>Next.js 15 (App Router) + TypeScript</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>スタイリング</td>
                  <td>Tailwind CSS 4</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>脆弱性データ</td>
                  <td>GitHub Advisory Database API</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>バージョン情報</td>
                  <td>npm Registry API</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>キャッシュ</td>
                  <td>Upstash Redis（TTL: 1時間）</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>レート制限</td>
                  <td>1時間あたり10リクエスト / IP</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>


      </div>

      {/* Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>&copy; 2025 tikomo software / Powered by Next.js &amp; GitHub Advisory API &amp; Vercel</p>
        </div>
      </footer>
    </main>
  );
}
