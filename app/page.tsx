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
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🔍 Web Dependency Audit
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              package.json と lockfile をアップロードして、依存パッケージの監査を実行します
            </p>
          </div>
          <Link
            href="/about"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            About
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* レート制限残り回数の表示 */}
        {rateLimitRemaining !== null && (
          <div className="mb-4 text-right text-xs text-gray-400">
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
          <div className="flex flex-col items-center justify-center py-24">
            <svg
              className="h-10 w-10 animate-spin text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="mt-4 text-sm text-gray-600">
              監査を実行中です。しばらくお待ちください...
            </p>
          </div>
        )}

        {/* result フェーズ */}
        {appState.phase === 'result' && (
          <div>
            {/* 警告バナー */}
            {warnings.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-1 text-sm font-medium text-amber-800">⚠️ 注意</p>
                {warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-amber-700">{warning}</p>
                ))}
              </div>
            )}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">監査結果</h2>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                新しい監査を実行
              </button>
            </div>
            <AuditResults report={appState.report} />
          </div>
        )}

        {/* error フェーズ */}
        {appState.phase === 'error' && (
          <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="mb-2 text-lg font-semibold text-red-800">
              エラーが発生しました
            </h2>
            <p className="mb-6 text-sm text-red-600">{appState.message}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              もう一度試す
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
