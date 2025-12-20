/**
 * URL関連のユーティリティ
 */

/**
 * 公開URLを生成
 */
export const getPublicUrl = (publicUrlId: string): string => {
  if (typeof window === "undefined") {
    return `/p/${publicUrlId}`;
  }
  return `${window.location.origin}/p/${publicUrlId}`;
};

/**
 * URLをクリップボードにコピー
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    // フォールバック: 古いブラウザ対応
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
};


