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
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
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

  return canvas.toDataURL("image/png", 0.85);
};

