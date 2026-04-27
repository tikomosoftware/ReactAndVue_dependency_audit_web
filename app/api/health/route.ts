import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * ヘルスチェック API エンドポイント。
 * アプリケーションの稼働状態を返す。
 *
 * レスポンス:
 *   200: { status: "ok", timestamp: "ISO 8601" }
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
