/** パッケージの依存種別 */
export type DependencyKind = 'direct' | 'dev' | 'transitive';

/** package.json + lockfile から抽出されたパッケージ情報 */
export interface PackageDependency {
  name: string;
  specifiedRange: string;     // package.json に記載されたバージョン範囲（例: "^18.2.0"）
  installedVersion: string;   // lockfile に記録された実際のバージョン（例: "18.2.0"）
  kind: DependencyKind;
}

/** npm registry から取得したバージョン情報 */
export interface VersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string | null;  // 取得失敗時は null
  fetchError?: string;           // エラー理由
}

/** GitHub Advisory DB から取得した脆弱性情報 */
export interface VulnerabilityInfo {
  packageName: string;
  ghsaId: string;
  cveId: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  cvssScore: number | null;
  summary: string;
  affectedVersionRange: string;
  patchedVersion: string | null;
  url: string;
}

/** 監査カテゴリ */
export enum AuditCategory {
  CriticalSecurity = 'critical_security',
  MaintenanceUpdate = 'maintenance_update',
  Stability = 'stability',
  UpToDate = 'up_to_date',
}

/** 個別パッケージの監査結果 */
export interface AuditResult {
  package: PackageDependency;
  category: AuditCategory;
  versionInfo: VersionInfo;
  vulnerabilities: VulnerabilityInfo[];
}

/** フレームワーク更新情報 */
export interface FrameworkUpdateInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  hasMajorUpdate: boolean;
  releaseNotesUrl: string;
}

/** 監査レポート全体 */
export interface AuditReport {
  projectName: string;
  mode: 'project' | 'file';
  projectPath?: string;
  packageJsonPath?: string;
  lockfilePath?: string;
  generatedAt: Date;
  results: AuditResult[];
  frameworkUpdates: FrameworkUpdateInfo[];
}

/** CLIオプション型 */
export interface CliOptions {
  project?: string;            // Project Mode: ディレクトリパス
  packageJson?: string;        // File Mode: package.json パス
  lockfile?: string;           // File Mode: lockfile パス
  output?: string;             // Markdownレポート出力先
  includeTransitive?: boolean; // transitive依存を含めるか
  frameworks?: string;         // 追加フレームワークパッケージ名（カンマ区切り）
}
