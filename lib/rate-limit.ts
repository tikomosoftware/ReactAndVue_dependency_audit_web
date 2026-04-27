import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * レート制限インスタンスのシングルトン。
 * 初回呼び出し時に生成し、以降は再利用する。
 */
let rateLimiter: Ratelimit | null | undefined;

/**
 * レート制限インスタンスを取得する。
 * 環境変数（UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN）が
 * 未設定の場合は null を返す（レート制限無効化）。
 *
 * 設定: Fixed Window アルゴリズム、1時間あたり10リクエスト
 */
export function getRateLimiter(): Ratelimit | null {
  if (rateLimiter !== undefined) {
    return rateLimiter;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    rateLimiter = null;
    return null;
  }

  try {
    rateLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(10, '1 h'),
    });
    return rateLimiter;
  } catch (error) {
    console.error('レート制限の初期化に失敗しました:', error);
    rateLimiter = null;
    return null;
  }
}
