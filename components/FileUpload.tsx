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
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="panel" style={{ padding: '24px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
          📦 依存パッケージ監査
        </h2>

        {/* ドラッグ&ドロップエリア */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          style={{ marginBottom: '24px', padding: '32px', textAlign: 'center' }}
        >
          <p style={{ marginBottom: '8px', fontSize: '0.875rem', color: 'var(--muted)' }}>
            ファイルをここにドラッグ&ドロップ
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.7 }}>
            package.json と lockfile（package-lock.json / yarn.lock）
          </p>
        </div>

        {/* package.json（必須） */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="packageJson"
            style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}
          >
            package.json <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            ref={packageJsonInputRef}
            id="packageJson"
            type="file"
            accept=".json,application/json"
            onChange={handlePackageJsonChange}
            disabled={loading}
            className="file-input"
            style={{
              display: 'block',
              width: '100%',
              fontSize: '0.875rem',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          />
          {packageJsonFile && (
            <p style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--success)' }}>
              ✓ {packageJsonFile.name}（{formatFileSize(packageJsonFile.size)}）
            </p>
          )}
        </div>

        {/* lockfile（任意） */}
        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="lockfile"
            style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}
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
            className="file-input"
            style={{
              display: 'block',
              width: '100%',
              fontSize: '0.875rem',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          />
          {lockfile && (
            <p style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--success)' }}>
              ✓ {lockfile.name}（{formatFileSize(lockfile.size)}）
            </p>
          )}
          <p style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.7 }}>
            package-lock.json または yarn.lock
          </p>
        </div>

        {/* クライアントサイドエラー */}
        {clientError && (
          <div className="notice-box error" style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '0.875rem' }}>{clientError}</p>
          </div>
        )}

        {/* アクションボタン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!packageJsonFile || loading}
            className="btn-primary"
            style={{ padding: '10px 24px', fontSize: '0.875rem' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              className="btn-secondary"
              style={{ padding: '10px 16px', fontSize: '0.875rem' }}
            >
              リセット
            </button>
          )}
        </div>

        {/* プライバシーポリシー説明文 */}
        <p style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--muted)', opacity: 0.8 }}>
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
      style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}
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
  );
}

/** ファイルサイズを人間が読みやすい形式にフォーマット */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
