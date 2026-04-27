import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Web Dependency Audit',
  description: 'Web Dependency Audit の概要と使い方',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🔍 Web Dependency Audit
            </h1>
            <p className="mt-1 text-sm text-gray-500">About</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            ← 監査ページへ戻る
          </Link>
        </div>
      </header>

      {/* コンテンツ */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* 概要 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">📦 概要</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Web Dependency Audit は、Webフロントエンドプロジェクトの依存パッケージを監査するツールです。
            ブラウザ上で <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">package.json</code> と
            lockfile をアップロードするだけで、脆弱性チェック・バージョン更新確認・フレームワーク更新情報を
            まとめて確認できます。
          </p>
        </section>

        {/* 使い方 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">🚀 使い方</h2>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</span>
              <span>
                監査したいプロジェクトの <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">package.json</code> を用意します（必須）。
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">package-lock.json</code> または
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">yarn.lock</code> もあると、より正確な結果が得られます。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
              <span>「ファイルを選択」ボタンまたはドラッグ&ドロップでファイルをアップロードします。</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">3</span>
              <span>「監査を実行」ボタンをクリックすると、サーバーサイドで監査処理が実行されます。</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">4</span>
              <span>結果が4カテゴリに分類されて表示されます。Markdownレポートのダウンロードも可能です。</span>
            </li>
          </ol>
        </section>

        {/* 4カテゴリ分類 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">📊 4カテゴリ分類</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3">
              <span className="text-xl">🔴</span>
              <div>
                <p className="font-medium text-gray-900">Critical Security</p>
                <p className="text-xs text-gray-500">脆弱性が検出されたパッケージ。早急な対応が必要です。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-yellow-50 p-3">
              <span className="text-xl">🟡</span>
              <div>
                <p className="font-medium text-gray-900">Maintenance Update</p>
                <p className="text-xs text-gray-500">メジャーバージョンの更新があるパッケージ。破壊的変更の可能性があります。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-3">
              <span className="text-xl">🟢</span>
              <div>
                <p className="font-medium text-gray-900">Stability</p>
                <p className="text-xs text-gray-500">マイナー/パッチ更新があるパッケージ。バグ修正や小さな改善が含まれます。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="font-medium text-gray-900">Up to Date</p>
                <p className="text-xs text-gray-500">最新バージョンのパッケージ。対応不要です。</p>
              </div>
            </div>
          </div>
        </section>

        {/* 対応フレームワーク */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">🔵 対応フレームワーク</h2>
          <p className="mb-3 text-sm text-gray-600">
            以下のフレームワークの更新情報を自動検出し、メジャーアップデートを強調表示します。
          </p>
          <div className="flex flex-wrap gap-2">
            {['React', 'React DOM', 'Vue', 'Next.js', 'Nuxt', 'Angular'].map((fw) => (
              <span
                key={fw}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
              >
                {fw}
              </span>
            ))}
          </div>
        </section>

        {/* プライバシー */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">🔒 プライバシー</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• アップロードされたファイルはサーバーに保存されません</li>
            <li>• ファイルはサーバーレス関数のメモリ上でのみ処理され、処理完了後に破棄されます</li>
            <li>• 通信はHTTPSで暗号化されます（Vercelデプロイ時）</li>
          </ul>
        </section>

        {/* 技術情報 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">⚙️ 技術情報</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-700">フレームワーク</td>
                  <td className="py-2 text-gray-600">Next.js 15 (App Router) + TypeScript</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-700">スタイリング</td>
                  <td className="py-2 text-gray-600">Tailwind CSS 4</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-700">脆弱性データ</td>
                  <td className="py-2 text-gray-600">GitHub Advisory Database API</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-700">バージョン情報</td>
                  <td className="py-2 text-gray-600">npm Registry API</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-700">キャッシュ</td>
                  <td className="py-2 text-gray-600">Upstash Redis（TTL: 1時間）</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-gray-700">レート制限</td>
                  <td className="py-2 text-gray-600">1時間あたり10リクエスト / IP</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* フッター */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            監査を始める →
          </Link>
        </div>
      </div>
    </main>
  );
}
