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
   * 
   * transform-originをcenter centerにリセットする際に、
   * 見た目が変わらないようにtranslateを補正する
   */
  const handlePinchEnd = useCallback(() => {
    console.log("[PinchEnd] ===== ピンチ終了（1フレーム前） =====");
    console.log("[PinchEnd] Transform-origin (before):", transformOrigin);
    console.log("[PinchEnd] Scale (before):", canvasScale);
    console.log("[PinchEnd] Translate (before):", canvasTranslate);
    
    if (!canvasZoomLayerRef?.current || !pinchStartCenterLocalRef.current) {
      // ピンチ中心が記録されていない場合は、通常のリセットのみ
      pinchStartDistanceRef.current = null;
      pinchStartCenterLocalRef.current = null;
      setTransformOrigin("center center");
      console.log("[PinchEnd] No pinch center recorded, reset only");
      console.log("[PinchEnd] =====================");
      return;
    }

    // ピンチ終了直前の状態を取得
    const currentScale = canvasScale;
    const currentTranslate = canvasTranslate;
    const pinchCenterLocal = pinchStartCenterLocalRef.current;
    
    // CanvasZoomLayerのサイズを取得
    const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
    const zoomLayerWidth = zoomLayerRect.width;
    const zoomLayerHeight = zoomLayerRect.height;
    
    // CanvasZoomLayerの中心（ローカル座標）
    const centerLocalX = zoomLayerWidth / 2;
    const centerLocalY = zoomLayerHeight / 2;
    
    console.log("[PinchEnd] Pinch center (local):", pinchCenterLocal);
    console.log("[PinchEnd] ZoomLayer center (local):", { x: centerLocalX, y: centerLocalY });
    console.log("[PinchEnd] ZoomLayer size:", { width: zoomLayerWidth, height: zoomLayerHeight });
    
    // ピンチ中心から中心への相対位置
    const relativeX = centerLocalX - pinchCenterLocal.x;
    const relativeY = centerLocalY - pinchCenterLocal.y;
    
    console.log("[PinchEnd] Relative position (center - pinch center):", { x: relativeX, y: relativeY });
    
    // transform-originをピンチ中心からcenter centerに変更する際の補正を計算
    // 
    // 前提：
    // - transform-originがピンチ中心の場合、ピンチ中心は固定（viewport座標で）
    // - transform-originがcenter centerの場合、中心は固定（viewport座標で）
    // - 見た目を維持するには、ピンチ中心の位置（viewport座標）が変わらないようにする必要がある
    //
    // 計算方法：
    // 1. ピンチ中心のviewport座標を計算（現在の状態）
    //    pinchCenterViewport = {zoomLayerRect.left + pinchCenterLocal.x, zoomLayerRect.top + pinchCenterLocal.y}
    //
    // 2. transform-originがcenter centerの場合、ピンチ中心の位置を維持するには：
    //    - 中心からピンチ中心への相対位置を計算
    //    - スケールを考慮して、translateを補正
    //
    // 3. 補正量の計算：
    //    - ピンチ中心から中心への相対位置（ローカル座標）: relativeX, relativeY
    //    - transform-originがピンチ中心の場合、ピンチ中心は固定
    //    - transform-originがcenter centerの場合、中心は固定
    //    - ピンチ中心の位置を維持するには、translateを補正する必要がある
    //
    // 4. 補正量 = ピンチ中心から中心への相対位置 * (1 - 1/scale)
    //    または = ピンチ中心から中心への相対位置 * (scale - 1) / scale
    //
    // より正確な計算：
    // transform-originがピンチ中心の場合：
    //   - ピンチ中心は固定（viewport座標で）
    //   - ピンチ中心のviewport座標: pinchCenterViewport = {zoomLayerRect.left + px, zoomLayerRect.top + py}
    //
    // transform-originがcenter centerの場合：
    //   - 中心は固定（viewport座標で）
    //   - 中心のviewport座標: centerViewport = {zoomLayerRect.left + width/2, zoomLayerRect.top + height/2}
    //   - ピンチ中心の位置を維持するには、translateを補正する必要がある
    //
    // 補正量の計算：
    //   - ピンチ中心から中心への相対位置（ローカル座標）: relativeX = centerLocalX - pinchCenterLocal.x
    //   - スケールを考慮して、translateを補正
    //   - 補正量 = relativeX * (1 - 1/scale) = relativeX * (scale - 1) / scale
    
    // 補正量の計算
    // ピンチ中心から中心への相対位置を、スケールを考慮して補正
    // 補正量 = 相対位置 * (1 - 1/scale) = 相対位置 * (scale - 1) / scale
    const correctionX = relativeX * (1 - 1 / currentScale);
    const correctionY = relativeY * (1 - 1 / currentScale);
    
    console.log("[PinchEnd] Correction:", { x: correctionX, y: correctionY });
    
    // 新しいtranslateを計算
    const newTranslateX = currentTranslate.x + correctionX;
    const newTranslateY = currentTranslate.y + correctionY;
    
    console.log("[PinchEnd] New translate (calculated):", { x: newTranslateX, y: newTranslateY });
    
    // transform-originをcenter centerに変更し、同時にtranslateを適用
    setTransformOrigin("center center");
    setCanvasTranslate({ x: newTranslateX, y: newTranslateY });
    
    // ピンチ開始時の記録をクリア
    pinchStartDistanceRef.current = null;
    pinchStartCenterLocalRef.current = null;
    
    console.log("[PinchEnd] ===== ピンチ終了（1フレーム後） =====");
    console.log("[PinchEnd] Transform-origin (after): center center");
    console.log("[PinchEnd] Scale (after):", currentScale);
    console.log("[PinchEnd] Translate (after):", { x: newTranslateX, y: newTranslateY });
    console.log("[PinchEnd] =====================");
  }, [canvasScale, canvasTranslate, transformOrigin, canvasZoomLayerRef]);

  return {
    canvasScale,
    canvasTranslate,
    transformOrigin,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}

