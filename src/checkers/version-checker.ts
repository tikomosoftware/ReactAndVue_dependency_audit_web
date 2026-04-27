import { PackageDependency, VersionInfo } from '../models/types.js';

const NPM_REGISTRY_BASE_URL = 'https://registry.npmjs.org';
const MAX_CONCURRENT_REQUESTS = 10;

/**
 * npm registry API から単一パッケージの最新バージョンを取得する。
 * スコープ付きパッケージ（@scope/name）にも対応。
 */
async function fetchLatestVersion(packageName: string): Promise<VersionInfo & { _currentVersion?: undefined }> {
  const encodedName = encodeURIComponent(packageName);
  const url = `${NPM_REGISTRY_BASE_URL}/${encodedName}`;

  const response = await fetch(url);

  if (response.status === 404) {
    return {
      name: packageName,
      currentVersion: '',
      latestVersion: null,
      fetchError: 'レジストリ未登録',
    };
  }

  if (!response.ok) {
    return {
      name: packageName,
      currentVersion: '',
      latestVersion: null,
      fetchError: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const data = (await response.json()) as { 'dist-tags'?: { latest?: string } };
  const latestVersion = data?.['dist-tags']?.latest ?? null;

  return {
    name: packageName,
    currentVersion: '',
    latestVersion,
    fetchError: latestVersion == null ? 'dist-tags.latest が見つかりません' : undefined,
  };
}

/**
 * パッケージ配列を指定サイズのチャンクに分割する。
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * 複数パッケージの最新バージョンを npm registry API から取得する。
 *
 * - 並列リクエスト数を最大10に制限（チャンク単位で Promise.allSettled）
 * - API接続失敗時は fetchError フィールドにエラー理由を記録し、他のパッケージの処理を継続
 * - レジストリ未登録パッケージは「レジストリ未登録」として記録
 */
export async function checkVersions(
  packages: PackageDependency[],
): Promise<VersionInfo[]> {
  if (packages.length === 0) {
    return [];
  }

  const results: VersionInfo[] = [];
  const batches = chunk(packages, MAX_CONCURRENT_REQUESTS);

  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map((pkg) => fetchLatestVersion(pkg.name)),
    );

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const pkg = batch[i];

      if (result.status === 'fulfilled') {
        results.push({
          name: pkg.name,
          currentVersion: pkg.installedVersion,
          latestVersion: result.value.latestVersion,
          ...(result.value.fetchError ? { fetchError: result.value.fetchError } : {}),
        });
      } else {
        // ネットワークエラー等で Promise が reject された場合
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        results.push({
          name: pkg.name,
          currentVersion: pkg.installedVersion,
          latestVersion: null,
          fetchError: errorMessage,
        });
      }
    }
  }

  return results;
}
