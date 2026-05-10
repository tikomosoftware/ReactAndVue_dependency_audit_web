'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { AuditReport } from '@core/models/types';
import FileUpload from '../components/FileUpload';
import AuditResults from '../components/AuditResults';

/**
 * アプリケーション状態の型定義。
 * upload → loading → result / error の画面遷移を管理する。
 *
 * Validates: Requirements 1.1, 3.5, 3.6, 7.4
 */
type AppState =
  | { phase: 'upload' }
  | { phase: 'loading' }
  | { phase: 'result'; report: AuditReport }
  | { phase: 'error'; message: string };

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>({ phase: 'upload' });
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  /** 監査完了ハンドラー */
  const handleAuditComplete = useCallback((report: AuditReport, auditWarnings?: string[]) => {
    setAppState({ phase: 'result', report });
    setWarnings(auditWarnings ?? []);
  }, []);

  /** エラーハンドラー */
  const handleError = useCallback((message: string) => {
    setAppState({ phase: 'error', message });
    setWarnings([]);
  }, []);

  /** ローディング状態変更ハンドラー */
  const handleLoadingChange = useCallback((loading: boolean) => {
    if (loading) {
      setAppState({ phase: 'loading' });
    }
  }, []);

  /** upload 状態にリセット */
  const handleRetry = useCallback(() => {
    setAppState({ phase: 'upload' });
    setRateLimitRemaining(null);
    setWarnings([]);
  }, []);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <h1 className="brand-name">
              🔍 Web Dependency Audit
            </h1>
            <p className="brand-sub">
              package.json と lockfile をアップロードして、依存パッケージの監査を実行します
            </p>
          </div>
          <Link href="/about" className="nav-link-inactive">
            About
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 20px' }}>
        {/* レート制限残り回数の表示 */}
        {rateLimitRemaining !== null && (
          <div style={{ marginBottom: '16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--muted)' }}>
            残りリクエスト回数: {rateLimitRemaining}
          </div>
        )}

        {/* upload フェーズ */}
        {appState.phase === 'upload' && (
          <FileUpload
            onAuditComplete={handleAuditComplete}
            onError={handleError}
            onLoadingChange={handleLoadingChange}
          />
        )}

        {/* loading フェーズ */}
        {appState.phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0' }}>
            <svg
              style={{ width: '40px', height: '40px', color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                style={{ opacity: 0.25 }}
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                style={{ opacity: 0.75 }}
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p style={{ marginTop: '16px', fontSize: '0.875rem', color: 'var(--muted)' }}>
              監査を実行中です。しばらくお待ちください...
            </p>
          </div>
        )}

        {/* result フェーズ */}
        {appState.phase === 'result' && (
          <div>
            {/* 警告バナー */}
            {warnings.length > 0 && (
              <div className="notice-box" style={{ marginBottom: '16px' }}>
                <p style={{ marginBottom: '4px', fontSize: '0.875rem', fontWeight: 600 }}>⚠️ 注意</p>
                {warnings.map((warning, i) => (
                  <p key={i} style={{ fontSize: '0.875rem' }}>{warning}</p>
                ))}
              </div>
            )}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>監査結果</h2>
              <button
                type="button"
                onClick={handleRetry}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.875rem' }}
              >
                新しい監査を実行
              </button>
            </div>
            <AuditResults report={appState.report} />
          </div>
        )}

        {/* error フェーズ */}
        {appState.phase === 'error' && (
          <div className="error-panel" style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', fontSize: '2.5rem' }}>⚠️</div>
            <h2 style={{ marginBottom: '8px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--danger)' }}>
              エラーが発生しました
            </h2>
            <p style={{ marginBottom: '24px', fontSize: '0.875rem', color: 'var(--muted)' }}>{appState.message}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="btn-danger"
              style={{ padding: '10px 24px', fontSize: '0.875rem' }}
            >
              もう一度試す
            </button>
          </div>
        )}
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
