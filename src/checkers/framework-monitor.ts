import { PackageDependency, FrameworkUpdateInfo } from '../models/types.js';
import { parseSemver } from '../utils/semver.js';

const NPM_REGISTRY_BASE_URL = 'https://registry.npmjs.org';

/**
 * デフォルトのフレームワークパッケージリスト
 */
export const DEFAULT_FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'vue',
  'next',
  'nuxt',
  '@angular/core',
];

/**
 * フレームワーク名からリリースノートURLを生成する。
 * 既知のフレームワークにはGitHubリリースページURLを返し、
 * それ以外はnpmパッケージページURLを返す。
 */
export function getFrameworkReleaseNotesUrl(name: string): string {
  switch (name) {
    case 'react':
    case 'react-dom':
      return 'https://github.com/facebook/react/releases';
    case 'vue':
      return 'https://github.com/vuejs/core/releases';
    case 'next':
      return 'https://github.com/vercel/next.js/releases';
    case 'nuxt':
      return 'https://github.com/nuxt/nuxt/releases';
    case '@angular/core':
      return 'https://github.com/angular/angular/releases';
    default:
      return `https://www.npmjs.com/package/${name}`;
  }
}

/**
 * npm registry API から単一パッケージの最新バージョンを取得する。
 */
async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const encodedName = encodeURIComponent(packageName);
  const url = `${NPM_REGISTRY_BASE_URL}/${encodedName}`;

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { 'dist-tags'?: { latest?: string } };
  return data?.['dist-tags']?.latest ?? null;
}

/**
 * フレームワークパッケージの更新情報を取得する。
 *
 * - パッケージリストからデフォルトフレームワークパッケージを自動検出する
 * - additionalFrameworks で指定された追加パッケージも対象に含める
 * - npm registry API から最新バージョンを取得する
 * - メジャーバージョン更新の有無を判定する
 * - フレームワークごとのリリースノートURLを生成する
 */
export async function checkFrameworkUpdates(
  packages: PackageDependency[],
  additionalFrameworks: string[],
): Promise<FrameworkUpdateInfo[]> {
  // パッケージリストからフレームワークパッケージ名のセットを構築
  const packageMap = new Map<string, PackageDependency>();
  for (const pkg of packages) {
    packageMap.set(pkg.name, pkg);
  }

  // デフォルト + 追加フレームワークの中から、パッケージリストに存在するものを抽出
  const allFrameworkNames = new Set([
    ...DEFAULT_FRAMEWORK_PACKAGES,
    ...additionalFrameworks,
  ]);

  const targetPackages: PackageDependency[] = [];
  for (const name of allFrameworkNames) {
    const pkg = packageMap.get(name);
    if (pkg) {
      targetPackages.push(pkg);
    }
  }

  if (targetPackages.length === 0) {
    return [];
  }

  // 並列で最新バージョンを取得
  const settled = await Promise.allSettled(
    targetPackages.map(async (pkg) => {
      const latestVersion = await fetchLatestVersion(pkg.name);
      return { pkg, latestVersion };
    }),
  );

  const results: FrameworkUpdateInfo[] = [];

  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    const { pkg, latestVersion } = result.value;

    if (latestVersion === null) {
      continue;
    }

    const currentParsed = parseSemver(pkg.installedVersion);
    const latestParsed = parseSemver(latestVersion);

    const hasMajorUpdate =
      currentParsed !== null &&
      latestParsed !== null &&
      latestParsed.major > currentParsed.major;

    results.push({
      name: pkg.name,
      currentVersion: pkg.installedVersion,
      latestVersion,
      hasMajorUpdate,
      releaseNotesUrl: getFrameworkReleaseNotesUrl(pkg.name),
    });
  }

  return results;
}
