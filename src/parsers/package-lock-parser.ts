/**
 * package-lock.json パーサー
 *
 * package-lock.json (v2/v3) の JSON 文字列を解析し、
 * 各パッケージのバージョン・resolved・integrity・transitive 依存情報を抽出する。
 */

/** lockfile の個別パッケージエントリ */
export interface LockfileEntry {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
}

/** パース結果 */
export interface ParsedLockfile {
  packages: Record<string, LockfileEntry>;
}

/**
 * package-lock.json の `packages` セクション内のパスからパッケージ名を抽出する。
 *
 * v3 形式では `node_modules/react` や `node_modules/@scope/name` のようなパスが使われる。
 * ネストされた transitive 依存は `node_modules/a/node_modules/b` のようになる。
 * 最後の `node_modules/` 以降をパッケージ名として返す。
 *
 * @param path - packages セクションのキー
 * @returns パッケージ名（ルートエントリ "" の場合は空文字列）
 */
function extractPackageName(path: string): string {
  if (path === '') {
    return '';
  }

  const marker = 'node_modules/';
  const lastIndex = path.lastIndexOf(marker);
  if (lastIndex === -1) {
    return path;
  }

  return path.slice(lastIndex + marker.length);
}

/**
 * package-lock.json の JSON 文字列をパースし、パッケージ情報を抽出する。
 *
 * - `packages` セクション（v2/v3 形式）から各パッケージの version, resolved, integrity を抽出する
 * - transitive 依存の情報（dependencies）も保持する
 * - ルートエントリ（キーが ""）はスキップする
 * - 不正な JSON の場合は適切なエラーメッセージ付きで例外をスローする
 *
 * @param content - package-lock.json の内容（JSON 文字列）
 * @returns パース結果
 * @throws Error 不正な JSON の場合
 */
export function parsePackageLock(content: string): ParsedLockfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid package-lock.json: ${reason}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid package-lock.json: content is not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  const packagesSection = obj['packages'];

  if (
    typeof packagesSection !== 'object' ||
    packagesSection === null ||
    Array.isArray(packagesSection)
  ) {
    return { packages: {} };
  }

  const rawPackages = packagesSection as Record<string, unknown>;
  const result: Record<string, LockfileEntry> = {};

  for (const [path, value] of Object.entries(rawPackages)) {
    // ルートエントリはスキップ
    if (path === '') {
      continue;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      continue;
    }

    const entry = value as Record<string, unknown>;
    const version = typeof entry['version'] === 'string' ? entry['version'] : '';

    if (version === '') {
      continue;
    }

    const lockfileEntry: LockfileEntry = { version };

    if (typeof entry['resolved'] === 'string') {
      lockfileEntry.resolved = entry['resolved'];
    }

    if (typeof entry['integrity'] === 'string') {
      lockfileEntry.integrity = entry['integrity'];
    }

    // transitive 依存情報を保持
    if (
      typeof entry['dependencies'] === 'object' &&
      entry['dependencies'] !== null &&
      !Array.isArray(entry['dependencies'])
    ) {
      const deps = entry['dependencies'] as Record<string, unknown>;
      const validDeps: Record<string, string> = {};
      let hasDeps = false;

      for (const [depName, depRange] of Object.entries(deps)) {
        if (typeof depRange === 'string') {
          validDeps[depName] = depRange;
          hasDeps = true;
        }
      }

      if (hasDeps) {
        lockfileEntry.dependencies = validDeps;
      }
    }

    const packageName = extractPackageName(path);
    result[packageName] = lockfileEntry;
  }

  return { packages: result };
}
