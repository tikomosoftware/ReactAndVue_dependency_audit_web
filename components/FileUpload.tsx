'use client';

import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { AuditReport } from '@core/models/types';

interface FileUploadProps {
  onAuditComplete: (report: AuditReport, warnings?: string[]) => void;
  onError: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

/** クライアントサイドのファイルサイズ上限（5MB） */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * ファイルアップロードコンポーネント。
 *
 * - package.json（必須）と lockfile（任意）のファイル選択UI
 * - ドラッグ&ドロップ対応
 * - クライアントサイドのファイルサイズ・形式プレチェック
 * - 「監査を実行」ボタンで POST /api/audit に FormData を送信
 * - ローディングインジケーター表示
 * - プライバシーポリシー説明文の表示
 *
 * Validates: Requirements 1.1, 3.5, 6.4
 */
export default function FileUpload({
  onAuditComplete,
  onError,
  onLoadingChange,
}: FileUploadProps) {
  const [packageJsonFile, setPackageJsonFile] = useState<File | null>(null);
  const [lockfile, setLockfile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const packageJsonInputRef = useRef<HTMLInputElement>(null);
  const lockfileInputRef = useRef<HTMLInputElement>(null);

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ページ全体でのドラッグ&ドロップのデフォルト動作（ファイルがブラウザで開かれる）を防止
  // ドロップゾーン内のイベントは React ハンドラーに任せる
  useEffect(() => {
    const handleDragOverGlobal = (e: globalThis.DragEvent) => {
      // ドロップゾーン内は React ハンドラーに任せる
      if (dropZoneRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    const handleDropGlobal = (e: globalThis.DragEvent) => {
      if (dropZoneRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener('dragover', handleDragOverGlobal);
    document.addEventListener('drop', handleDropGlobal);
    return () => {
      document.removeEventListener('dragover', handleDragOverGlobal);
      document.removeEventListener('drop', handleDropGlobal);
    };
  }, []);

  /** ローディング状態を更新し、親にも通知する */
  const updateLoading = useCallback(
    (value: boolean) => {
      setLoading(value);
      onLoadingChange?.(value);
    },
    [onLoadingChange],
  );

  /** クライアントサイドのファイルプレチェック（サイズのみ。MIMEタイプはサーバーで検証） */
  const validateFile = useCallback(
    (file: File, label: string): string | null => {
      if (file.size > MAX_FILE_SIZE) {
        return `${label} のファイルサイズが上限（5MB）を超えています`;
      }
      return null;
    },
    [],
  );

  /** package.json ファイル選択ハンドラー */
  const handlePackageJsonChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setClientError(null);
      const file = e.target.files?.[0] ?? null;
      console.log('[FileUpload] package.json selected:', file?.name, file?.size, file?.type);
      if (file) {
        const error = validateFile(file, 'package.json');
        if (error) {
          console.log('[FileUpload] validation error:', error);
          setClientError(error);
          setPackageJsonFile(null);
          return;
        }
      }
      setPackageJsonFile(file);
      console.log('[FileUpload] packageJsonFile set to:', file?.name ?? 'null');
    },
    [validateFile],
  );

  /** lockfile ファイル選択ハンドラー */
  const handleLockfileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setClientError(null);
      const file = e.target.files?.[0] ?? null;
      if (file) {
        const error = validateFile(file, 'lockfile');
        if (error) {
          setClientError(error);
          setLockfile(null);
          return;
        }
      }
      setLockfile(file);
    },
    [validateFile],
  );

  /** ドラッグ&ドロップハンドラー */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      setClientError(null);

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const name = file.name.toLowerCase();
        if (name === 'package.json') {
          const error = validateFile(file, 'package.json');
          if (error) {
            setClientError(error);
            return;
          }
          setPackageJsonFile(file);
        } else if (
          name === 'package-lock.json' ||
          name === 'yarn.lock'
        ) {
          const error = validateFile(file, 'lockfile');
          if (error) {
            setClientError(error);
            return;
          }
          setLockfile(file);
        }
      }
    },
    [validateFile],
  );

  /** 監査実行 */
  const handleSubmit = useCallback(async () => {
    if (!packageJsonFile) return;

    setClientError(null);
    updateLoading(true);

    try {
      const formData = new FormData();
      formData.append('packageJson', packageJsonFile);
      if (lockfile) {
        formData.append('lockfile', lockfile);
      }

      const response = await fetch('/api/audit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        onError(data.error ?? `サーバーエラーが発生しました（${response.status}）`);
        return;
      }

      onAuditComplete(data.report, data.warnings);
    } catch {
      onError('ネットワークエラーが発生しました。接続を確認してください。');
    } finally {
      updateLoading(false);
    }
  }, [packageJsonFile, lockfile, onAuditComplete, onError, updateLoading]);

  /** ファイル選択をリセット */
  const handleReset = useCallback(() => {
    setPackageJsonFile(null);
    setLockfile(null);
    setClientError(null);
    if (packageJsonInputRef.current) packageJsonInputRef.current.value = '';
    if (lockfileInputRef.current) lockfileInputRef.current.value = '';
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          📦 依存パッケージ監査
        </h2>

        {/* ドラッグ&ドロップエリア */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mb-6 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50'
          }`}
        >
          <p className="mb-2 text-sm text-gray-600">
            ファイルをここにドラッグ&ドロップ
          </p>
          <p className="text-xs text-gray-400">
            package.json と lockfile（package-lock.json / yarn.lock）
          </p>
        </div>

        {/* package.json（必須） */}
        <div className="mb-4">
          <label
            htmlFor="packageJson"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            package.json <span className="text-red-500">*</span>
          </label>
          <input
            ref={packageJsonInputRef}
            id="packageJson"
            type="file"
            accept=".json,application/json"
            onChange={handlePackageJsonChange}
            disabled={loading}
            className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {packageJsonFile && (
            <p className="mt-1 text-xs text-green-600">
              ✓ {packageJsonFile.name}（{formatFileSize(packageJsonFile.size)}）
            </p>
          )}
        </div>

        {/* lockfile（任意） */}
        <div className="mb-6">
          <label
            htmlFor="lockfile"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            lockfile（任意）
          </label>
          <input
            ref={lockfileInputRef}
            id="lockfile"
            type="file"
            accept=".json,.lock,application/json,text/plain"
            onChange={handleLockfileChange}
            disabled={loading}
            className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gray-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-100 disabled:opacity-50"
          />
          {lockfile && (
            <p className="mt-1 text-xs text-green-600">
              ✓ {lockfile.name}（{formatFileSize(lockfile.size)}）
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            package-lock.json または yarn.lock
          </p>
        </div>

        {/* クライアントサイドエラー */}
        {clientError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {clientError}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!packageJsonFile || loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                監査を実行中...
              </span>
            ) : (
              '監査を実行'
            )}
          </button>

          {(packageJsonFile || lockfile) && !loading && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              リセット
            </button>
          )}
        </div>

        {/* プライバシーポリシー説明文 */}
        <p className="mt-6 text-xs text-gray-400">
          🔒 アップロードされたファイルはサーバーに保存されません。監査処理完了後、メモリ上のデータは即座に破棄されます。
        </p>
      </div>
    </div>
  );
}

/** ローディングスピナー */
function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
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
  );
}

/** ファイルサイズを人間が読みやすい形式にフォーマット */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
