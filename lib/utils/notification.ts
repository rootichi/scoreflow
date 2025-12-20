/**
 * 通知ユーティリティ
 * alert()の代わりに使用する、より良いUXを提供する通知システム
 */

/**
 * 成功メッセージを表示
 */
export const showSuccess = (message: string): void => {
  // 将来的にはトースト通知ライブラリに置き換え可能
  // 現時点ではalert()を使用（機能を変えないため）
  alert(message);
};

/**
 * エラーメッセージを表示
 */
export const showError = (message: string): void => {
  alert(message);
};

/**
 * 確認ダイアログを表示
 */
export const showConfirm = (message: string): boolean => {
  return confirm(message);
};

/**
 * プロンプトを表示
 */
export const showPrompt = (message: string, defaultValue?: string): string | null => {
  return prompt(message, defaultValue);
};


