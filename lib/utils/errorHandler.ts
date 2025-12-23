/**
 * エラーハンドリングユーティリティ
 * エラーの処理とログ出力を統一化
 */

export interface ErrorContext {
  operation: string;
  details?: Record<string, unknown>;
}

/**
 * エラーをログ出力し、ユーザーフレンドリーなメッセージを返す
 */
export function handleError(error: unknown, context?: ErrorContext): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";

  // ログ出力
  if (context) {
    console.error(`[${context.operation}] Error:`, {
      message: errorMessage,
      name: errorName,
      details: context.details,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    console.error("Error:", error);
  }

  // ユーザーフレンドリーなメッセージを返す
  if (errorMessage.includes("同じ名称の大会が既に存在します")) {
    return "同じ名称の大会が既に存在します。別の名称を入力してください。";
  }
  if (errorMessage.includes("permission") || errorMessage.includes("PERMISSION_DENIED")) {
    return "権限がありません。Firestoreのセキュリティルールを確認してください。";
  }
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("unavailable") ||
    errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
    errorMessage.includes("fetch")
  ) {
    return "ネットワークエラーが発生しました。接続を確認してください。";
  }
  if (errorMessage.includes("Canvas") || errorMessage.includes("PDF")) {
    return "PDFの変換に失敗しました。PDFファイルが正しいか確認してください。";
  }
  if (errorMessage.includes("タイムアウト") || errorMessage.includes("timeout")) {
    return "保存に時間がかかりすぎています。PDFファイルのサイズを小さくするか、しばらくしてから再度お試しください。";
  }
  if (errorMessage.includes("quota") || errorMessage.includes("resource-exhausted")) {
    return "Firestoreのクォータに達しています。";
  }
  if (errorMessage.includes("認証") || errorMessage.includes("auth")) {
    return "認証に失敗しました。再度ログインしてください。";
  }

  // デフォルトメッセージ
  return errorMessage || "エラーが発生しました。";
}

/**
 * エラーを処理し、通知を表示する
 */
export function handleErrorWithNotification(
  error: unknown,
  context?: ErrorContext,
  defaultMessage?: string
): void {
  const message = handleError(error, context);
  // showErrorは後でインポート（循環参照を避けるため）
  const { showError } = require("./notification");
  showError(defaultMessage || message);
}

