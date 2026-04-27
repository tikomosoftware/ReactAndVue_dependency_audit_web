/**
 * セマンティックバージョニング比較ユーティリティ
 */

/** Semver バージョンオブジェクト */
export interface SemverVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * バージョン文字列を SemverVersion オブジェクトにパースする。
 * 先頭の "v" プレフィックスは許容する。
 * パースできない場合は null を返す。
 */
export function parseSemver(version: string): SemverVersion | null {
  if (typeof version !== 'string') {
    return null;
  }

  // 先頭の "v" または "V" を除去
  const cleaned = version.trim().replace(/^[vV]/, '');

  // major.minor.patch(-prerelease) 形式にマッチ
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return null;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const prerelease = match[4];

  const result: SemverVersion = { major, minor, patch };
  if (prerelease !== undefined) {
    result.prerelease = prerelease;
  }

  return result;
}

/**
 * 2つの SemverVersion オブジェクトを比較する。
 * a < b なら負の数、a === b なら 0、a > b なら正の数を返す。
 * prerelease の比較: prerelease なしの方が prerelease ありより大きい（1.0.0 > 1.0.0-alpha）。
 */
export function compareSemver(a: SemverVersion, b: SemverVersion): number {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  // prerelease の比較
  // 両方なし → 等しい
  if (a.prerelease === undefined && b.prerelease === undefined) {
    return 0;
  }
  // prerelease なし > prerelease あり（正式リリースの方が上位）
  if (a.prerelease === undefined) {
    return 1;
  }
  if (b.prerelease === undefined) {
    return -1;
  }
  // 両方 prerelease あり → 辞書順比較
  return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
}

/**
 * 2つのバージョン文字列の差分種別を判定する。
 * - 'major': major バージョンが異なる
 * - 'minor': major が同じで minor が異なる
 * - 'patch': major と minor が同じで patch が異なる
 * - 'none': 全て同じ
 * - 'unknown': いずれかのバージョンがパースできない
 */
export function getDiffType(
  current: string,
  latest: string,
): 'major' | 'minor' | 'patch' | 'none' | 'unknown' {
  const currentParsed = parseSemver(current);
  const latestParsed = parseSemver(latest);

  if (currentParsed === null || latestParsed === null) {
    return 'unknown';
  }

  if (currentParsed.major !== latestParsed.major) {
    return 'major';
  }
  if (currentParsed.minor !== latestParsed.minor) {
    return 'minor';
  }
  if (currentParsed.patch !== latestParsed.patch) {
    return 'patch';
  }

  return 'none';
}
