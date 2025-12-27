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
  const pinchStartCenterRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の中心位置（viewport座標）

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

  // スケール変更時に移動範囲を制限（ピンチ操作中でない場合は何もしない）
  useEffect(() => {
    // ピンチ操作中でない場合は何もしない
    if (!pinchStartCenterRef.current) {
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
      console.log("[PinchStart] Current scale:", canvasScale);
      console.log("[PinchStart] Current translate:", canvasTranslate);

      // ピンチ開始時の状態を記録（最小ロジック：scale, translate, ピンチ中心位置のみ）
      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = canvasScale;
      pinchStartTranslateRef.current = { ...canvasTranslate };
      pinchStartCenterRef.current = { x: centerX, y: centerY };
      
      console.log("[PinchStart] =====================");
    },
    [canvasScale, canvasTranslate]
  );

  /**
   * ピンチ移動
   * 
   * ピンチ中心を基準にズームする実装
   * transform-origin: center center を使用しているため、
   * スケールは要素の中心を基準に行われる。
   * ピンチ中心を基準にズームするには、translateを適切に補正する必要がある。
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartCenterRef.current === null) {
        return;
      }

      console.log("[PinchMove] ===== ピンチ移動 =====");
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
      console.log("[PinchMove] Start center point (viewport):", pinchStartCenterRef.current);

      // スケール変更を計算
      const scaleChange = currentDistance / pinchStartDistanceRef.current;
      const newScale = Math.max(1.0, Math.min(5, pinchStartScaleRef.current * scaleChange));
      
      console.log("[PinchMove] Scale change:", scaleChange);
      console.log("[PinchMove] New scale:", newScale);
      console.log("[PinchMove] Start scale:", pinchStartScaleRef.current);

      if (!imageContainerRef.current || !canvasZoomLayerRef?.current) {
        return;
      }

      const viewportRect = imageContainerRef.current.getBoundingClientRect();
      const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
      
      // CanvasZoomLayerの中心（viewport座標）
      const zoomLayerCenterX = zoomLayerRect.left + zoomLayerRect.width / 2;
      const zoomLayerCenterY = zoomLayerRect.top + zoomLayerRect.height / 2;
      
      // ピンチ開始時の中心点（viewport座標）
      const pinchStartX = pinchStartCenterRef.current.x;
      const pinchStartY = pinchStartCenterRef.current.y;
      
      // ピンチ開始時の中心点からCanvasZoomLayerの中心への相対位置
      // （CanvasZoomLayerの座標系での相対位置）
      const startRelativeX = pinchStartX - zoomLayerCenterX;
      const startRelativeY = pinchStartY - zoomLayerCenterY;
      
      console.log("[PinchMove] Start relative to zoom layer center:", { x: startRelativeX, y: startRelativeY });
      
      // スケール比
      const scaleRatio = newScale / pinchStartScaleRef.current;
      
      // transform-origin: center center を基準にスケールする場合、
      // 中心からの相対位置は scaleRatio 倍になる
      // スケール後の相対位置
      const scaledRelativeX = startRelativeX * scaleRatio;
      const scaledRelativeY = startRelativeY * scaleRatio;
      
      // スケール後のピンチ中心位置（viewport座標）
      const scaledPinchCenterX = zoomLayerCenterX + scaledRelativeX;
      const scaledPinchCenterY = zoomLayerCenterY + scaledRelativeY;
      
      console.log("[PinchMove] Scaled pinch center (viewport):", { x: scaledPinchCenterX, y: scaledPinchCenterY });
      
      // ピンチ中心が画面上で固定されるようにtranslateを補正
      // 現在のピンチ中心位置と、スケール後のピンチ中心位置の差を計算
      const deltaX = currentCenterX - scaledPinchCenterX;
      const deltaY = currentCenterY - scaledPinchCenterY;
      
      console.log("[PinchMove] Delta (viewport):", { x: deltaX, y: deltaY });
      
      // 新しいtranslateを計算
      // ピンチ開始時のtranslateに、deltaを加算
      const newTranslateX = pinchStartTranslateRef.current.x + deltaX;
      const newTranslateY = pinchStartTranslateRef.current.y + deltaY;
      
      console.log("[PinchMove] New translate:", { x: newTranslateX, y: newTranslateY });
      console.log("[PinchMove] Start translate:", pinchStartTranslateRef.current);
      
      // 移動範囲を制限（clamp処理）
      // clampTranslateには画像要素の座標系でのoriginX, originYを渡す必要がある
      // ピンチ中心位置を基準に計算
      const imageOriginX = currentCenterX - zoomLayerCenterX + viewportRect.width / 2;
      const imageOriginY = currentCenterY - zoomLayerCenterY + viewportRect.height / 2;
      
      const clampedTranslate = clampTranslate({ x: newTranslateX, y: newTranslateY }, newScale, imageOriginX, imageOriginY);
      
      setCanvasScale(newScale);
      setCanvasTranslate(clampedTranslate);
      
      console.log("[PinchMove] Clamped translate:", clampedTranslate);
      console.log("[PinchMove] =====================");
    },
    [clampTranslate, imageContainerRef, canvasZoomLayerRef]
  );

  /**
   * ピンチ終了
   */
  const handlePinchEnd = useCallback(() => {
    console.log("[PinchEnd] ===== ピンチ終了 =====");
    pinchStartDistanceRef.current = null;
    pinchStartCenterRef.current = null;
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

