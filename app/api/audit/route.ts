import { NextRequest, NextResponse } from 'next/server';
import { validateAndExtractFiles } from '../../../lib/file-validator';
import { runAudit } from '../../../lib/audit-engine';

/** リクエストボディサイズ上限: 10MB */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/audit
 *
 * 監査 API エンドポイント。
 * FormData で package.json（必須）と lockfile（任意）を受け取り、
 * 監査パイプラインを実行して AuditReport JSON を返す。
 *
 * レスポンス:
 *   200: { success: true, report: AuditReport }
 *   400: { success: false, error: string } (バリデーションエラー)
 *   413: { success: false, error: string } (ボディ超過)
 *   500: { success: false, error: string } (サーバーエラー)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // GITHUB_TOKEN 未設定時の警告ログ
    if (!process.env.GITHUB_TOKEN) {
      console.warn(
        'GITHUB_TOKEN が設定されていません。GitHub API を認証なしモード（60リクエスト/時間）で使用します',
      );
    }

    // リクエストボディサイズチェック（10MB上限）
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { success: false, error: 'リクエストボディが上限を超えています' },
        { status: 413 },
      );
    }

    // FormData の取得
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: 'リクエストの形式が不正です' },
        { status: 400 },
      );
    }

    // ファイルバリデーション
    let validatedFiles;
    try {
      validatedFiles = await validateAndExtractFiles(formData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ファイルの検証に失敗しました';
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    // 監査実行
    const { report, warnings } = await runAudit({
      packageJsonContent: validatedFiles.packageJsonContent,
      lockfileContent: validatedFiles.lockfileContent,
      lockfileType: validatedFiles.lockfileType,
    });

    // 警告がある場合はログ出力
    if (warnings.length > 0) {
      for (const warning of warnings) {
        console.warn(`[audit] ${warning}`);
      }
    }

    return NextResponse.json({ success: true, report, warnings });
  } catch (error) {
    console.error('監査処理中に予期しないエラーが発生しました:', error);
    return NextResponse.json(
      { success: false, error: '内部エラーが発生しました' },
      { status: 500 },
    );
  }
}
