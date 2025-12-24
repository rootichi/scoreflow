import { useState, useRef, useCallback, useEffect } from "react";

/**
 * ピンチズーム用のカスタムフック
 */
export function usePinchZoom(
  imageContainerRef: React.RefObject<HTMLDivElement | null>,
  initialImageSizeRef: React.MutableRefObject<{ width: number; height: number } | null>,
  canvasRef?: React.RefObject<HTMLDivElement | null>,
  canvasZoomLayerRef?: React.RefObject<HTMLDivElement | null>
) {
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasTranslate, setCanvasTranslate] = useState({ x: 0, y: 0 });
  const [transformOrigin] = useState<string>("center center"); // 固定値
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartImageLocalPointRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の画像ローカル座標（画像要素の左上を(0,0)とした座標）
  const pinchStartImageRectRef = useRef<DOMRect | null>(null); // ピンチ開始時の画像要素の位置（スケール前）

  // 移動範囲を制限する関数
  const clampTranslate = useCallback(
    (translate: { x: number; y: number }, scale: number, originX: number, originY: number) => {
      if (!initialImageSizeRef.current || !imageContainerRef.current) {
        return translate;
      }

      // ビューポートのサイズを取得（CanvasViewportのサイズ）
      const viewportRect = imageContainerRef.current.getBoundingClientRect();
      const viewportWidth = viewportRect.width;
      const viewportHeight = viewportRect.height;

      const initialWidth = initialImageSizeRef.current.width;
      const initialHeight = initialImageSizeRef.current.height;

      // スケール後の画像サイズ
      const scaledWidth = initialWidth * scale;
      const scaledHeight = initialHeight * scale;

      // transform-originを考慮した移動範囲の計算
      // originX, originYは画像要素の左上からの相対位置（px単位）
      // スケール後の画像の左上の位置を計算
      const scaledOriginX = originX * scale;
      const scaledOriginY = originY * scale;
      
      // スケール後の画像の左上の位置（ビューポート座標系）
      const scaledImageLeft = viewportRect.left + viewportRect.width / 2 - scaledOriginX;
      const scaledImageTop = viewportRect.top + viewportRect.height / 2 - scaledOriginY;
      
      // 初期画像の位置（ビューポート座標系、scale=1.0の状態）
      const initialImageLeft = viewportRect.left + viewportRect.width / 2 - originX;
      const initialImageTop = viewportRect.top + viewportRect.height / 2 - originY;
      const initialImageRight = initialImageLeft + initialWidth;
      const initialImageBottom = initialImageTop + initialHeight;
      
      // スケール後の画像の位置（ビューポート座標系）
      const scaledImageRight = scaledImageLeft + scaledWidth;
      const scaledImageBottom = scaledImageTop + scaledHeight;
      
      // 移動範囲を制限（初期画像の境界を超えないように）
      // 左方向の最大移動: 初期画像の左端 - スケール後の画像の左端
      const maxTranslateXLeft = initialImageLeft - scaledImageLeft;
      // 右方向の最大移動: 初期画像の右端 - スケール後の画像の右端
      const maxTranslateXRight = initialImageRight - scaledImageRight;
      // 上方向の最大移動: 初期画像の上端 - スケール後の画像の上端
      const maxTranslateYTop = initialImageTop - scaledImageTop;
      // 下方向の最大移動: 初期画像の下端 - スケール後の画像の下端
      const maxTranslateYBottom = initialImageBottom - scaledImageBottom;
      
      // 移動範囲を制限
      const clampedX = Math.max(maxTranslateXLeft, Math.min(maxTranslateXRight, translate.x));
      const clampedY = Math.max(maxTranslateYTop, Math.min(maxTranslateYBottom, translate.y));

      return { x: clampedX, y: clampedY };
    },
    [imageContainerRef, initialImageSizeRef]
  );

  // スケール変更時に移動範囲を制限（transform-originを考慮）
  useEffect(() => {
    // ピンチ操作中でない場合は何もしない
    if (!pinchStartImageLocalPointRef.current) {
      return;
    }
  }, [canvasScale, clampTranslate]);

  /**
   * ピンチ開始
   */
  const handlePinchStart = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      // ① ピンチ中心座標の取得を可視化
      console.log("[PinchStart] ===== ピンチ開始 =====");
      console.log("[PinchStart] Touch points:", {
        touch1: { x: touch1.clientX, y: touch1.clientY },
        touch2: { x: touch2.clientX, y: touch2.clientY },
      });

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 2点の中点を取得（ビューポート座標系）
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      console.log("[PinchStart] Center point (viewport):", { x: centerX, y: centerY });

      // 画像要素を取得
      const container = canvasRef?.current || imageContainerRef.current;
      const imgElement = container?.querySelector("img");
      
      if (!imgElement) {
        console.error("[PinchStart] Image element not found!");
        return;
      }

      if (!imageContainerRef.current) {
        console.error("[PinchStart] Image container not found!");
        return;
      }

      // 画像要素のDOM実寸を取得（getBoundingClientRect）
      const imageRect = imgElement.getBoundingClientRect();
      
      console.log("[PinchStart] Image rect:", {
        left: imageRect.left,
        top: imageRect.top,
        width: imageRect.width,
        height: imageRect.height,
      });
      
      // ② 中点を画像ローカル座標に変換（画像左上を(0,0)とした座標）
      const localX = centerX - imageRect.left;
      const localY = centerY - imageRect.top;
      
      console.log("[PinchStart] Center point (image local coordinates):", {
        x: localX,
        y: localY,
      });
      
      // スケール前の画像要素の位置を計算（初期状態を基準）
      // 現在のスケールとトランスレートを考慮して、スケール前の位置を逆算
      const viewportRect = imageContainerRef.current.getBoundingClientRect();
      const zoomLayerRect = canvasZoomLayerRef?.current?.getBoundingClientRect() || viewportRect;
      
      // スケール前の画像サイズと位置を計算
      const unscaledImageWidth = imageRect.width / canvasScale;
      const unscaledImageHeight = imageRect.height / canvasScale;
      // スケール前の画像の左上位置（ビューポート座標系）
      const unscaledImageLeft = zoomLayerRect.left + zoomLayerRect.width / 2 - (unscaledImageWidth / 2) - canvasTranslate.x;
      const unscaledImageTop = zoomLayerRect.top + zoomLayerRect.height / 2 - (unscaledImageHeight / 2) - canvasTranslate.y;
      
      // ピンチ位置をスケール前の画像ローカル座標に変換
      const unscaledLocalX = centerX - unscaledImageLeft;
      const unscaledLocalY = centerY - unscaledImageTop;
      
      console.log("[PinchStart] Center point (unscaled image local coordinates):", {
        x: unscaledLocalX,
        y: unscaledLocalY,
      });
      
      // ピンチ開始時の画像ローカル座標を記録
      pinchStartImageLocalPointRef.current = { x: unscaledLocalX, y: unscaledLocalY };
      pinchStartImageRectRef.current = new DOMRect(unscaledImageLeft, unscaledImageTop, unscaledImageWidth, unscaledImageHeight);

      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = canvasScale;
      pinchStartTranslateRef.current = { ...canvasTranslate };
      
      console.log("[PinchStart] =====================");
    },
    [canvasScale, canvasTranslate, imageContainerRef, canvasRef, canvasZoomLayerRef]
  );

  /**
   * ピンチ移動
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartImageLocalPointRef.current === null) {
        return;
      }

      // タッチ点の座標を取得（デバッグ用）
      console.log("[PinchMove] Touch points:", {
        touch1: { x: touch1.clientX, y: touch1.clientY },
        touch2: { x: touch2.clientX, y: touch2.clientY },
      });

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 現在の2点の中点を取得（ビューポート座標系）
      const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

      console.log("[PinchMove] Center point (viewport):", { x: currentCenterX, y: currentCenterY });

      if (!imageContainerRef.current) {
        return;
      }

      const viewportRect = imageContainerRef.current.getBoundingClientRect();
      
      // スケール変更を計算
      const scaleChange = currentDistance / pinchStartDistanceRef.current;
      const newScale = Math.max(1.0, Math.min(5, pinchStartScaleRef.current * scaleChange));
      
      // 画像要素を取得
      const container = canvasRef?.current || imageContainerRef.current;
      const imgElement = container?.querySelector("img");
      
      if (!imgElement) {
        console.error("[PinchMove] Image element not found!");
        return;
      }

      // 画像要素のDOM実寸を取得（getBoundingClientRect）
      const imageRect = imgElement.getBoundingClientRect();
      
      console.log("[PinchMove] Image rect:", {
        left: imageRect.left,
        top: imageRect.top,
        width: imageRect.width,
        height: imageRect.height,
      });
      
      // CanvasZoomLayerの位置を取得
      const zoomLayerRect = canvasZoomLayerRef?.current?.getBoundingClientRect() || viewportRect;
      
      console.log("[PinchMove] ZoomLayer rect:", {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
      });
      
      // ② 中点を画像ローカル座標に変換（画像左上を(0,0)とした座標）
      const currentLocalX = currentCenterX - imageRect.left;
      const currentLocalY = currentCenterY - imageRect.top;
      
      console.log("[PinchMove] Center point (image local coordinates):", {
        x: currentLocalX,
        y: currentLocalY,
      });
      
      // ③ transform-originではなくtranslate + scaleで制御
      // ピンチ開始時の位置（スケール前の画像ローカル座標）
      const startLocalX = pinchStartImageLocalPointRef.current.x;
      const startLocalY = pinchStartImageLocalPointRef.current.y;
      
      console.log("[PinchMove] Start point (unscaled image local coordinates):", {
        x: startLocalX,
        y: startLocalY,
      });
      
      // スケール前の画像要素の位置を計算
      const unscaledImageWidth = initialImageSizeRef.current ? initialImageSizeRef.current.width : 0;
      const unscaledImageHeight = initialImageSizeRef.current ? initialImageSizeRef.current.height : 0;
      
      // スケール前の画像の左上位置（ビューポート座標系）
      const unscaledImageLeft = zoomLayerRect.left + zoomLayerRect.width / 2 - (unscaledImageWidth / 2) - pinchStartTranslateRef.current.x;
      const unscaledImageTop = zoomLayerRect.top + zoomLayerRect.height / 2 - (unscaledImageHeight / 2) - pinchStartTranslateRef.current.y;
      
      // ピンチ開始時の位置（ビューポート座標系）
      const startViewportX = unscaledImageLeft + startLocalX;
      const startViewportY = unscaledImageTop + startLocalY;
      
      // スケール後の画像の左上位置（ビューポート座標系）
      const scaledImageLeft = zoomLayerRect.left + zoomLayerRect.width / 2 - (unscaledImageWidth * newScale / 2) - pinchStartTranslateRef.current.x;
      const scaledImageTop = zoomLayerRect.top + zoomLayerRect.height / 2 - (unscaledImageHeight * newScale / 2) - pinchStartTranslateRef.current.y;
      
      // スケール後のピンチ開始位置（ビューポート座標系）
      const scaledStartViewportX = scaledImageLeft + startLocalX * newScale;
      const scaledStartViewportY = scaledImageTop + startLocalY * newScale;
      
      // 現在の位置が画面上で固定されるようにtranslateを計算
      // スケール前の位置とスケール後の位置の差を計算
      const deltaX = currentCenterX - scaledStartViewportX;
      const deltaY = currentCenterY - scaledStartViewportY;
      
      console.log("[PinchMove] Delta (viewport):", { x: deltaX, y: deltaY });
      
      // translateを計算（現在の位置が画面上で固定されるように）
      const newTranslateX = pinchStartTranslateRef.current.x + deltaX;
      const newTranslateY = pinchStartTranslateRef.current.y + deltaY;
      
      console.log("[PinchMove] Translate:", { x: newTranslateX, y: newTranslateY });
      
      // 移動範囲を制限
      // clampTranslateには画像要素の座標系でのoriginX, originYを渡す必要がある
      // スケール前の画像要素の位置を計算（既に定義済みのunscaledImageWidth, unscaledImageHeightを使用）
      const unscaledImageLeftForClamp = zoomLayerRect.left + zoomLayerRect.width / 2 - (unscaledImageWidth / 2) - newTranslateX;
      const unscaledImageTopForClamp = zoomLayerRect.top + zoomLayerRect.height / 2 - (unscaledImageHeight / 2) - newTranslateY;
      
      const imageOriginX = currentCenterX - unscaledImageLeftForClamp;
      const imageOriginY = currentCenterY - unscaledImageTopForClamp;
      
      const clampedTranslate = clampTranslate({ x: newTranslateX, y: newTranslateY }, newScale, imageOriginX, imageOriginY);
      
      setCanvasScale(newScale);
      setCanvasTranslate(clampedTranslate);
    },
    [clampTranslate, imageContainerRef, canvasRef, canvasZoomLayerRef, initialImageSizeRef]
  );

  /**
   * ピンチ終了
   */
  const handlePinchEnd = useCallback(() => {
    console.log("[PinchEnd] ===== ピンチ終了 =====");
    pinchStartDistanceRef.current = null;
    pinchStartImageLocalPointRef.current = null;
    pinchStartImageRectRef.current = null;
  }, []);

  return {
    canvasScale,
    canvasTranslate,
    transformOrigin,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}

