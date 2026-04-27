import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Web Dependency Audit',
  description:
    'ブラウザ上で package.json と lockfile をアップロードし、依存パッケージの監査を実行します。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
