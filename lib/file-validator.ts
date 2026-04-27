/** ファイルバリデーション結果 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** バリデーション済みファイルデータ */
export interface ValidatedFiles {
  packageJsonContent: string;
  lockfileContent: string | null;
  lockfileType: 'npm' | 'yarn' | null;
}

/** 許可する MIME タイプ */
const ALLOWED_MIME_TYPES = ['application/json', 'text/plain'];

/** ファイルサイズ上限: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * package.json ファイルを検証する。
 * - MIME タイプが application/json または text/plain であること
 * - ファイルサイズが 5MB 以下であること
 * - 有効な JSON 形式であること
 * - "dependencies" または "devDependencies" フィールドが存在すること
 */
export async function validatePackageJson(file: File): Promise<ValidationResult> {
  // MIME タイプ検証
  if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
    return { valid: false, error: 'サポートされていないファイル形式です' };
  }

  // ファイルサイズ検証
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'ファイルサイズが上限（5MB）を超えています' };
  }

  // ファイル内容を読み取り
  const content = await file.text();

  // JSON 形式検証
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { valid: false, error: '有効な package.json ファイルではありません' };
  }

  // オブジェクトであることを確認
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: '有効な package.json ファイルではありません' };
  }

  // dependencies または devDependencies フィールドの存在確認
  if (!('dependencies' in parsed) && !('devDependencies' in parsed)) {
    return {
      valid: false,
      error: '有効な package.json ファイルではありません',
    };
  }

  return { valid: true };
}

/**
 * lockfile を検証する。
 * - MIME タイプが application/json または text/plain であること
 * - ファイルサイズが 5MB 以下であること
 * - package-lock.json（JSON形式）または yarn.lock（テキスト形式）であること
 */
export async function validateLockfile(file: File): Promise<ValidationResult> {
  // MIME タイプ検証
  if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
    return { valid: false, error: 'サポートされていないファイル形式です' };
  }

  // ファイルサイズ検証
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'ファイルサイズが上限（5MB）を超えています' };
  }

  // ファイル内容を読み取り、lockfile 形式を判定
  const content = await file.text();
  const lockfileType = detectLockfileType(content);

  if (lockfileType === null) {
    return { valid: false, error: 'サポートされていない lockfile 形式です' };
  }

  return { valid: true };
}

/**
 * lockfile の種別を判定する。
 * - JSON パース成功 + "packages" キー存在 → 'npm'
 * - テキスト形式 + yarn.lock ヘッダー or "version" "resolved" パターン → 'yarn'
 * - それ以外 → null
 */
export function detectLockfileType(content: string): 'npm' | 'yarn' | null {
  // npm (package-lock.json) の判定: JSON パース + "packages" キー
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null && 'packages' in parsed) {
      return 'npm';
    }
  } catch {
    // JSON パース失敗 → npm ではない、yarn の判定に進む
  }

  // yarn.lock の判定: ヘッダーまたは特徴的なパターン
  if (
    content.includes('# yarn lockfile') ||
    /".+?":\n\s+version ".+?"\n\s+resolved ".+?"/.test(content) ||
    /^.+?@.+?:\n\s+version "/m.test(content)
  ) {
    return 'yarn';
  }

  return null;
}

/**
 * アップロードされたファイル群を検証し、内容を返す。
 * FormData から package.json（必須）と lockfile（任意）を取得・検証する。
 */
export async function validateAndExtractFiles(
  formData: FormData,
): Promise<ValidatedFiles> {
  // package.json の取得（必須）
  const packageJsonFile = formData.get('packageJson');
  if (!packageJsonFile || !(packageJsonFile instanceof File)) {
    throw new Error('package.json ファイルが必要です');
  }

  // package.json の検証
  const packageJsonResult = await validatePackageJson(packageJsonFile);
  if (!packageJsonResult.valid) {
    throw new Error(packageJsonResult.error);
  }

  // package.json の内容を取得
  const packageJsonContent = await packageJsonFile.text();

  // lockfile の取得（任意）
  const lockfileFile = formData.get('lockfile');
  let lockfileContent: string | null = null;
  let lockfileType: 'npm' | 'yarn' | null = null;

  if (lockfileFile && lockfileFile instanceof File && lockfileFile.size > 0) {
    // lockfile の検証
    const lockfileResult = await validateLockfile(lockfileFile);
    if (!lockfileResult.valid) {
      throw new Error(lockfileResult.error);
    }

    // lockfile の内容を取得し、種別を判定
    lockfileContent = await lockfileFile.text();
    lockfileType = detectLockfileType(lockfileContent);
  }

  return {
    packageJsonContent,
    lockfileContent,
    lockfileType,
  };
}
