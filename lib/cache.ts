import { Redis } from '@upstash/redis';
import type {
  VersionInfo,
  VulnerabilityInfo,
  PackageDependency,
} from '@core/models/types';
import { checkVersions } from '@core/checkers/version-checker';
import { scanVulnerabilities } from '@core/checkers/vulnerability-scanner';

/** キャッシュ TTL（秒） */
const CACHE_TTL_SECONDS = 3600; // 1時間

/**
 * Redis クライアントのシングルトンインスタンス。
 * 初回呼び出し時に生成し、以降は再利用する。
 */
let redisClient: Redis | null | undefined;

/**
 * Redis クライアントを取得する。
 * 環境変数（UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN）が
 * 未設定の場合は null を返す（キャッシュ無効化）。
 */
export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    console.error('Redis クライアントの初期化に失敗しました:', error);
    redisClient = null;
    return null;
  }
}

/**
 * npm registry のバージョン情報をキャッシュから取得する。
 * キー: `npm:{packageName}`
 */
export async function getCachedVersionInfo(
  packageName: string,
): Promise<VersionInfo | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get<VersionInfo>(`npm:${packageName}`);
    return cached ?? null;
  } catch (error) {
    console.error(
      `Redis キャッシュ読み取りに失敗しました (npm:${packageName}):`,
      error,
    );
    return null;
  }
}

/**
 * npm registry のバージョン情報をキャッシュに保存する。
 * キー: `npm:{packageName}`、TTL: 3600秒
 */
export async function setCachedVersionInfo(
  packageName: string,
  info: VersionInfo,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(`npm:${packageName}`, info, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error(
      `Redis キャッシュ書き込みに失敗しました (npm:${packageName}):`,
      error,
    );
  }
}

/**
 * GitHub Advisory DB の脆弱性情報をキャッシュから取得する。
 * キー: `ghsa:{packageName}:{version}`
 */
export async function getCachedVulnerabilities(
  packageName: string,
  version: string,
): Promise<VulnerabilityInfo[] | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get<VulnerabilityInfo[]>(
      `ghsa:${packageName}:${version}`,
    );
    return cached ?? null;
  } catch (error) {
    console.error(
      `Redis キャッシュ読み取りに失敗しました (ghsa:${packageName}:${version}):`,
      error,
    );
    return null;
  }
}

/**
 * GitHub Advisory DB の脆弱性情報をキャッシュに保存する。
 * キー: `ghsa:{packageName}:{version}`、TTL: 3600秒
 */
export async function setCachedVulnerabilities(
  packageName: string,
  version: string,
  vulns: VulnerabilityInfo[],
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(`ghsa:${packageName}:${version}`, vulns, {
      ex: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.error(
      `Redis キャッシュ書き込みに失敗しました (ghsa:${packageName}:${version}):`,
      error,
    );
  }
}

/**
 * キャッシュ付きバージョンチェック。
 * 既存の checkVersions をラップし、キャッシュヒット時は API 呼び出しを省略する。
 *
 * 処理フロー:
 * 1. 各パッケージのキャッシュを確認
 * 2. キャッシュヒットしたパッケージは結果に追加
 * 3. キャッシュミスしたパッケージのみ checkVersions で API 呼び出し
 * 4. API 結果をキャッシュに保存
 */
export async function cachedCheckVersions(
  packages: PackageDependency[],
): Promise<VersionInfo[]> {
  if (packages.length === 0) return [];

  const results: VersionInfo[] = [];
  const uncachedPackages: PackageDependency[] = [];
  const uncachedIndices: number[] = [];

  // 1. キャッシュ確認
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    try {
      const cached = await getCachedVersionInfo(pkg.name);
      if (cached) {
        // キャッシュヒット: currentVersion を現在のパッケージに合わせて更新
        results.push({
          ...cached,
          currentVersion: pkg.installedVersion,
        });
      } else {
        uncachedPackages.push(pkg);
        uncachedIndices.push(i);
      }
    } catch {
      // キャッシュ読み取り失敗時はキャッシュミスとして扱う
      uncachedPackages.push(pkg);
      uncachedIndices.push(i);
    }
  }

  // 2. キャッシュミス分を API で取得
  if (uncachedPackages.length > 0) {
    try {
      const freshResults = await checkVersions(uncachedPackages);

      // 3. API 結果をキャッシュに保存し、結果に追加
      for (const info of freshResults) {
        results.push(info);

        // fetchError がない場合のみキャッシュに保存
        if (!info.fetchError) {
          await setCachedVersionInfo(info.name, info).catch((error) => {
            console.error(
              `キャッシュ保存に失敗しました (npm:${info.name}):`,
              error,
            );
          });
        }
      }
    } catch (error) {
      // API 呼び出し全体が失敗した場合、各パッケージにエラーを記録
      console.error('checkVersions の呼び出しに失敗しました:', error);
      for (const pkg of uncachedPackages) {
        results.push({
          name: pkg.name,
          currentVersion: pkg.installedVersion,
          latestVersion: null,
          fetchError:
            error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return results;
}

/**
 * キャッシュ付き脆弱性スキャン。
 * 既存の scanVulnerabilities をラップし、キャッシュヒット時は API 呼び出しを省略する。
 *
 * 処理フロー:
 * 1. 各パッケージのキャッシュを確認
 * 2. キャッシュヒットしたパッケージは結果に追加
 * 3. キャッシュミスしたパッケージのみ scanVulnerabilities で API 呼び出し
 * 4. API 結果をキャッシュに保存
 */
export async function cachedScanVulnerabilities(
  packages: PackageDependency[],
): Promise<Map<string, VulnerabilityInfo[]>> {
  const resultMap = new Map<string, VulnerabilityInfo[]>();

  if (packages.length === 0) return resultMap;

  const uncachedPackages: PackageDependency[] = [];

  // 1. キャッシュ確認
  for (const pkg of packages) {
    try {
      const cached = await getCachedVulnerabilities(
        pkg.name,
        pkg.installedVersion,
      );
      if (cached) {
        resultMap.set(pkg.name, cached);
      } else {
        uncachedPackages.push(pkg);
      }
    } catch {
      // キャッシュ読み取り失敗時はキャッシュミスとして扱う
      uncachedPackages.push(pkg);
    }
  }

  // 2. キャッシュミス分を API で取得
  if (uncachedPackages.length > 0) {
    try {
      const freshResults = await scanVulnerabilities(uncachedPackages);

      // 3. API 結果をキャッシュに保存し、結果に追加
      for (const [name, vulns] of freshResults) {
        resultMap.set(name, vulns);

        const pkg = uncachedPackages.find((p) => p.name === name);
        if (pkg) {
          await setCachedVulnerabilities(
            name,
            pkg.installedVersion,
            vulns,
          ).catch((error) => {
            console.error(
              `キャッシュ保存に失敗しました (ghsa:${name}):`,
              error,
            );
          });
        }
      }
    } catch (error) {
      // API 呼び出し全体が失敗した場合、各パッケージに空配列を記録
      console.error(
        'scanVulnerabilities の呼び出しに失敗しました:',
        error,
      );
      for (const pkg of uncachedPackages) {
        resultMap.set(pkg.name, []);
      }
    }
  }

  return resultMap;
}
