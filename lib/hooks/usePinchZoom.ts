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
  const [transformOrigin, setTransformOrigin] = useState<string>("center center"); // 動的に設定
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartCenterLocalRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の中心位置（CanvasZoomLayerローカル座標）

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

  // ピンチ操作終了時にtransform-originをリセット
  // 注意: refの変更は検知できないため、handlePinchEndで直接リセットする

  /**
   * ピンチ開始
   * 
   * ピンチ中心をCanvasZoomLayerのローカル座標に変換し、
   * transform-originとして設定する
   */
  const handlePinchStart = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (!canvasZoomLayerRef?.current) {
        return;
      }

      console.log("[PinchStart] ===== ピンチ開始 =====");
      console.log("[PinchStart] Touch points (viewport):", {
        touch1: { x: touch1.clientX, y: touch1.clientY },
        touch2: { x: touch2.clientX, y: touch2.clientY },
      });

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 2点の中点を取得（ビューポート座標系）
      const centerXViewport = (touch1.clientX + touch2.clientX) / 2;
      const centerYViewport = (touch1.clientY + touch2.clientY) / 2;

      console.log("[PinchStart] Center point (viewport):", { x: centerXViewport, y: centerYViewport });

      // CanvasZoomLayerの位置とサイズを取得
      const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
      
      // ピンチ中心をCanvasZoomLayerのローカル座標に変換
      // ローカル座標 = viewport座標 - CanvasZoomLayerの左上の位置
      const centerXLocal = centerXViewport - zoomLayerRect.left;
      const centerYLocal = centerYViewport - zoomLayerRect.top;

      console.log("[PinchStart] Center point (local):", { x: centerXLocal, y: centerYLocal });
      console.log("[PinchStart] ZoomLayer rect:", {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
      });
      console.log("[PinchStart] Current scale:", canvasScale);
      console.log("[PinchStart] Current translate:", canvasTranslate);
      console.log("[PinchStart] Current transform-origin:", transformOrigin);

      // ピンチ開始時の状態を記録
      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = canvasScale;
      pinchStartTranslateRef.current = { ...canvasTranslate };
      pinchStartCenterLocalRef.current = { x: centerXLocal, y: centerYLocal };

      // transform-originをピンチ中心のローカル座標に設定
      const newTransformOrigin = `${centerXLocal}px ${centerYLocal}px`;
      setTransformOrigin(newTransformOrigin);
      
      console.log("[PinchStart] New transform-origin:", newTransformOrigin);
      console.log("[PinchStart] =====================");
    },
    [canvasScale, canvasTranslate, transformOrigin, canvasZoomLayerRef]
  );

  /**
   * ピンチ移動
   * 
   * transform-originをピンチ中心に設定しているため、
   * scaleのみを変更すれば、ピンチ中心を基準にズームされる。
   * translate補正は極力行わない。
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartCenterLocalRef.current === null) {
        return;
      }

      console.log("[PinchMove] ===== ピンチ移動 =====");
      console.log("[PinchMove] Touch points (viewport):", {
        touch1: { x: touch1.clientX, y: touch1.clientY },
        touch2: { x: touch2.clientX, y: touch2.clientY },
      });

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 現在の2点の中点を取得（ビューポート座標系）
      const currentCenterXViewport = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterYViewport = (touch1.clientY + touch2.clientY) / 2;

      console.log("[PinchMove] Center point (viewport):", { x: currentCenterXViewport, y: currentCenterYViewport });
      console.log("[PinchMove] Start center point (local):", pinchStartCenterLocalRef.current);

      // スケール変更を計算
      const scaleChange = currentDistance / pinchStartDistanceRef.current;
      const newScale = Math.max(1.0, Math.min(5, pinchStartScaleRef.current * scaleChange));
      
      console.log("[PinchMove] Scale change:", scaleChange);
      console.log("[PinchMove] New scale:", newScale);
      console.log("[PinchMove] Start scale:", pinchStartScaleRef.current);
      console.log("[PinchMove] Current transform-origin:", transformOrigin);

      if (!canvasZoomLayerRef?.current) {
        return;
      }

      // 現在のピンチ中心をCanvasZoomLayerのローカル座標に変換（検証用）
      const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
      const currentCenterXLocal = currentCenterXViewport - zoomLayerRect.left;
      const currentCenterYLocal = currentCenterYViewport - zoomLayerRect.top;
      
      console.log("[PinchMove] Current center point (local):", { x: currentCenterXLocal, y: currentCenterYLocal });
      console.log("[PinchMove] ZoomLayer rect:", {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
      });

      // scaleのみを変更（translateは基本的に変更しない）
      // transform-originがピンチ中心に設定されているため、
      // scaleを変更するだけでピンチ中心を基準にズームされる
      setCanvasScale(newScale);
      
      // translateはピンチ開始時の値を維持（極力変更しない）
      // ただし、clamp処理は必要に応じて適用
      // ここでは、translate補正は行わない（transform-origin方式のため）
      
      console.log("[PinchMove] Applied scale:", newScale);
      console.log("[PinchMove] Translate (unchanged):", canvasTranslate);
      console.log("[PinchMove] Transform-origin:", transformOrigin);
      console.log("[PinchMove] =====================");
    },
    [canvasZoomLayerRef, transformOrigin, canvasTranslate]
  );

  /**
   * ピンチ終了
   */
  const handlePinchEnd = useCallback(() => {
    console.log("[PinchEnd] ===== ピンチ終了 =====");
    console.log("[PinchEnd] Final scale:", canvasScale);
    console.log("[PinchEnd] Final translate:", canvasTranslate);
    console.log("[PinchEnd] Final transform-origin:", transformOrigin);
    
    pinchStartDistanceRef.current = null;
    pinchStartCenterLocalRef.current = null;
    
    // transform-originをcenter centerにリセット
    // 次のピンチ操作まで、通常の中心ズームに戻す
    setTransformOrigin("center center");
    
    console.log("[PinchEnd] Transform-origin reset to: center center");
    console.log("[PinchEnd] =====================");
  }, [canvasScale, canvasTranslate, transformOrigin]);

  return {
    canvasScale,
    canvasTranslate,
    transformOrigin,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}

