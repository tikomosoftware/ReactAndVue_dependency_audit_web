/**
 * package.json パーサー
 *
 * package.json の JSON 文字列を解析し、依存パッケージ情報を抽出する。
 */

/** package.json のパース結果 */
export interface ParsedPackageJson {
  name: string;
  dependencies: Record<string, string>;      // パッケージ名 → バージョン範囲
  devDependencies: Record<string, string>;
}

/**
 * package.json の JSON 文字列をパースし、依存パッケージ情報を抽出する。
 *
 * - `dependencies` と `devDependencies` の両方を抽出する
 * - セクションが存在しない場合は空オブジェクトとして処理する
 * - 不正な JSON の場合は適切なエラーメッセージ付きで例外をスローする
 *
 * @param content - package.json の内容（JSON 文字列）
 * @returns パース結果
 * @throws Error 不正な JSON の場合
 */
export function parsePackageJson(content: string): ParsedPackageJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid package.json: ${reason}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid package.json: content is not a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  const name = typeof obj['name'] === 'string' ? obj['name'] : '';

  const dependencies = isStringRecord(obj['dependencies'])
    ? obj['dependencies']
    : {};

  const devDependencies = isStringRecord(obj['devDependencies'])
    ? obj['devDependencies']
    : {};

  return { name, dependencies, devDependencies };
}

/**
 * 値が Record<string, string> であるかを判定する型ガード
 */
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (v) => typeof v === 'string',
  );
}
