/**
 * 座標検証ユーティリティ
 * 画像のDOM実寸（getBoundingClientRect）のみを基準として座標が画像の範囲内にあるかを検証
 */

/**
 * 座標が画像の範囲内にあるかを検証
 * @param coords 正規化された座標（0-1、canvasRef基準）
 * @param canvasRef キャンバスの参照
 * @returns 座標が画像の範囲内にある場合true
 */
export function isValidCoordinate(
  coords: { x: number; y: number },
  canvasRef: React.RefObject<HTMLDivElement | null>
): boolean {
  if (!canvasRef.current) return false;

  // 画像要素を取得
  const imgElement = canvasRef.current.querySelector("img");
  if (!imgElement) return false;

  // 画像要素のDOM実寸を取得（唯一の正として使用）
  const imageRect = imgElement.getBoundingClientRect();
  
  // 画像の矩形情報
  const imageLeft = imageRect.left;
  const imageTop = imageRect.top;
  const imageRight = imageRect.right;
  const imageBottom = imageRect.bottom;
  const imageWidth = imageRect.width;
  const imageHeight = imageRect.height;

  if (imageWidth === 0 || imageHeight === 0) return false;

  // キャンバスのサイズを取得（正規化座標の基準となるサイズ）
  const canvasRect = canvasRef.current.getBoundingClientRect();
  const canvasWidth = canvasRect.width;
  const canvasHeight = canvasRect.height;

  // 正規化座標をピクセル座標に変換（ビューポート座標系）
  // 注意: canvasRefの高さが画像の高さより大きい場合、coords.yが1に近い値でも
  // 画像の高さを超えた位置になる可能性がある
  const pixelX = canvasRect.left + coords.x * canvasWidth;
  const pixelY = canvasRect.top + coords.y * canvasHeight;

  // 座標が画像の矩形内にあるかを確認（画像のgetBoundingClientRectのみを基準とする）
  // 上限：画像の rect.top
  // 下限：画像の rect.bottom
  // 左限：画像の rect.left
  // 右限：画像の rect.right
  // 厳密に画像の矩形内にあるかを確認（境界を含む）
  const isWithinImageBounds = (
    pixelX >= imageLeft &&
    pixelX <= imageRight &&
    pixelY >= imageTop &&
    pixelY <= imageBottom
  );

  return isWithinImageBounds;
}

/**
 * ラインの座標が画像の範囲内にあるかを検証
 * @param lineCoords ラインの座標（正規化された0-1）
 * @param canvasRef キャンバスの参照
 * @returns ラインの座標が画像の範囲内にある場合true
 */
export function isValidLineCoordinate(
  lineCoords: { x1: number; y1: number; x2: number; y2: number },
  canvasRef: React.RefObject<HTMLDivElement | null>
): boolean {
  return (
    isValidCoordinate({ x: lineCoords.x1, y: lineCoords.y1 }, canvasRef) &&
    isValidCoordinate({ x: lineCoords.x2, y: lineCoords.y2 }, canvasRef)
  );
}
