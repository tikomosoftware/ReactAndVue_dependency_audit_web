import { NextRequest, NextResponse } from 'next/server';
import { getRateLimiter } from './lib/rate-limit';

/**
 * Next.js Middleware。
 * /api/audit パスへのリクエストに対してレート制限を適用する。
 *
 * - IP アドレスを x-forwarded-for ヘッダーまたは NextRequest.ip から取得
 * - レート制限超過時: 429 + エラーメッセージ + X-RateLimit-* ヘッダー
 * - 制限内: リクエスト転送 + X-RateLimit-Remaining / X-RateLimit-Reset ヘッダー付与
 * - Upstash 未設定時: レート制限をスキップしてリクエスト転送
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const limiter = getRateLimiter();

  // Upstash 未設定時: レート制限をスキップしてリクエスト転送
  if (!limiter) {
    return NextResponse.next();
  }

  // IP アドレスを取得（x-forwarded-for ヘッダー優先、フォールバックとして NextRequest.ip）
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || request.ip || '127.0.0.1';

  try {
    const { success, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      // レート制限超過: 429 レスポンス
      return NextResponse.json(
        {
          success: false,
          error:
            'リクエスト回数の上限に達しました。しばらく時間をおいてから再度お試しください',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        },
      );
    }

    // 制限内: リクエスト転送 + レート制限ヘッダー付与
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(reset));
    return response;
  } catch (error) {
    // レート制限チェック自体が失敗した場合: リクエストを通す（フェイルオープン）
    console.error('レート制限チェックに失敗しました:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: '/api/audit',
};
