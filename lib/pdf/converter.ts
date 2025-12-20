import * as pdfjsLib from "pdfjs-dist";

// pdf.js の worker を設定（publicフォルダから読み込む）
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

/**
 * PDFファイルをPNG画像（Base64）に変換
 * @param file PDFファイル
 * @param scale 解像度スケール（デフォルト: 2.5）
 * @returns Base64文字列
 */
export const convertPdfToBase64 = async (
  file: File,
  scale: number = 2.5
): Promise<string> => {
  try {
    // PDF.jsのworkerが正しく設定されているか確認
    if (typeof window === "undefined") {
      throw new Error("PDF変換はブラウザ環境でのみ実行できます");
    }

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      throw new Error("PDF.js workerが設定されていません");
    }

  const arrayBuffer = await file.arrayBuffer();
    
    // PDFドキュメントを読み込み
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0 // ログを抑制
    }).promise;
    
    // ページ数を確認
    const numPages = pdf.numPages;
    if (numPages === 0) {
      throw new Error("PDFファイルにページがありません");
    }
    
    // 1ページ目を取得
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  if (!context) {
    throw new Error("Canvas context not available");
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

    // 画像品質を下げてデータサイズを削減（0.6に変更）
    const base64 = canvas.toDataURL("image/jpeg", 0.6);
    
    if (!base64 || base64.length === 0) {
      throw new Error("画像の変換に失敗しました");
    }

    return base64;
  } catch (error) {
    console.error("PDF変換エラー:", error);
    if (error instanceof Error) {
      throw new Error(`PDF変換エラー: ${error.message}`);
    }
    throw new Error("PDF変換中に不明なエラーが発生しました");
  }
};

