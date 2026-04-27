/**
 * yarn.lock パーサー
 *
 * yarn.lock v1 形式のカスタムパーサー。
 * パッケージ名@バージョン範囲、version、resolved、integrity、dependencies を解析する。
 */

import type { LockfileEntry, ParsedLockfile } from './package-lock-parser.js';

/**
 * yarn.lock v1 形式のヘッダー行からパッケージ名を抽出する。
 *
 * ヘッダー行の例:
 *   react@^18.2.0:
 *   "react@^18.2.0":
 *   "@scope/package@^1.0.0":
 *   "react@^18.2.0, react@^18.0.0":
 *   react@^18.2.0, react@^18.0.0:
 *
 * 最初のエントリの `@version-range` より前の部分をパッケージ名として返す。
 *
 * @param header - ヘッダー行（末尾の `:` は除去済み）
 * @returns パッケージ名
 */
function extractPackageNameFromHeader(header: string): string {
  // カンマ区切りの場合は最初のエントリのみ使用
  const firstEntry = header.split(',')[0].trim();

  // 引用符を除去
  const unquoted = firstEntry.replace(/^"/, '').replace(/"$/, '');

  // スコープ付きパッケージ: @scope/name@version-range
  // 通常パッケージ: name@version-range
  // 最後の @ でバージョン範囲を分離する
  const lastAtIndex = unquoted.lastIndexOf('@');

  // @ が見つからない、または先頭の @ のみ（スコープの @）の場合はそのまま返す
  if (lastAtIndex <= 0) {
    return unquoted;
  }

  return unquoted.slice(0, lastAtIndex);
}

/**
 * クォートされた値から文字列を抽出する。
 * 例: `"18.2.0"` → `18.2.0`
 *
 * @param raw - クォート付きの値文字列
 * @returns クォートを除去した文字列、またはクォートがない場合はそのまま
 */
function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * yarn.lock v1 形式の文字列をパースし、パッケージ情報を抽出する。
 *
 * - `#` で始まる行はコメントとしてスキップする
 * - インデントなしの行（末尾が `:`）はパッケージヘッダーとして認識する
 * - インデント付きの行はプロパティ（version, resolved, integrity, dependencies）として解析する
 * - `dependencies:` はサブブロックを開始し、さらにインデントされた行がキー・バリューペアとなる
 *
 * @param content - yarn.lock ファイルの内容
 * @returns パース結果（ParsedLockfile 形式）
 */
export function parseYarnLock(content: string): ParsedLockfile {
  const lines = content.split('\n');
  const result: Record<string, LockfileEntry> = {};

  let currentPackageName: string | null = null;
  let currentEntry: LockfileEntry | null = null;
  let inDependenciesBlock = false;
  let currentDependencies: Record<string, string> = {};

  for (const line of lines) {
    // 空行
    if (line.trim() === '') {
      // 空行でエントリを確定
      if (currentPackageName !== null && currentEntry !== null) {
        if (inDependenciesBlock && Object.keys(currentDependencies).length > 0) {
          currentEntry.dependencies = currentDependencies;
        }
        result[currentPackageName] = currentEntry;
        currentPackageName = null;
        currentEntry = null;
        inDependenciesBlock = false;
        currentDependencies = {};
      }
      continue;
    }

    // コメント行
    if (line.trimStart().startsWith('#')) {
      continue;
    }

    // インデントなしの行 = パッケージヘッダー
    // ヘッダー行は先頭がスペースでなく、末尾が `:` で終わる
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      // 前のエントリを確定
      if (currentPackageName !== null && currentEntry !== null) {
        if (inDependenciesBlock && Object.keys(currentDependencies).length > 0) {
          currentEntry.dependencies = currentDependencies;
        }
        result[currentPackageName] = currentEntry;
      }

      const trimmed = line.trim();
      // 末尾の `:` を除去
      const header = trimmed.endsWith(':') ? trimmed.slice(0, -1) : trimmed;

      currentPackageName = extractPackageNameFromHeader(header);
      currentEntry = { version: '' };
      inDependenciesBlock = false;
      currentDependencies = {};
      continue;
    }

    // インデント付きの行 = プロパティ
    if (currentEntry === null) {
      continue;
    }

    const trimmedLine = line.trim();

    // dependencies ブロック内のエントリ（より深いインデント）
    if (inDependenciesBlock) {
      // dependencies ブロック内の行は通常 4 スペース以上のインデント
      // 新しいトップレベルプロパティ（2スペースインデント）が来たら dependencies ブロック終了
      const indentMatch = line.match(/^(\s+)/);
      const indentLevel = indentMatch ? indentMatch[1].length : 0;

      if (indentLevel <= 2) {
        // dependencies ブロック終了、このプロパティを通常処理
        inDependenciesBlock = false;
        if (Object.keys(currentDependencies).length > 0) {
          currentEntry.dependencies = currentDependencies;
          currentDependencies = {};
        }
        // fall through to property parsing below
      } else {
        // dependencies のエントリ: `dep-name "^2.0.0"`
        const depMatch = trimmedLine.match(/^(.+?)\s+"(.+)"$/);
        if (depMatch) {
          currentDependencies[depMatch[1]] = depMatch[2];
        }
        continue;
      }
    }

    // `dependencies:` サブブロック開始
    if (trimmedLine === 'dependencies:') {
      inDependenciesBlock = true;
      currentDependencies = {};
      continue;
    }

    // 通常プロパティ: `key "value"` または `key value`（integrity など）
    const quotedMatch = trimmedLine.match(/^(\w+)\s+"(.+)"$/);
    const bareMatch = !quotedMatch ? trimmedLine.match(/^(\w+)\s+(.+)$/) : null;
    const propMatch = quotedMatch ?? bareMatch;
    if (propMatch) {
      const [, key, value] = propMatch;
      switch (key) {
        case 'version':
          currentEntry.version = value;
          break;
        case 'resolved':
          currentEntry.resolved = value;
          break;
        case 'integrity':
          currentEntry.integrity = value;
          break;
        // 他のプロパティは無視
      }
    }
  }

  // 最後のエントリを確定（ファイル末尾に空行がない場合）
  if (currentPackageName !== null && currentEntry !== null) {
    if (inDependenciesBlock && Object.keys(currentDependencies).length > 0) {
      currentEntry.dependencies = currentDependencies;
    }
    result[currentPackageName] = currentEntry;
  }

  // version が空のエントリを除外
  const filtered: Record<string, LockfileEntry> = {};
  for (const [name, entry] of Object.entries(result)) {
    if (entry.version !== '') {
      filtered[name] = entry;
    }
  }

  return { packages: filtered };
}
