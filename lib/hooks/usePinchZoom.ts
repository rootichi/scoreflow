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
  const [transformOrigin, setTransformOrigin] = useState<string>("center center");
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartImagePointRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の画像内の位置（画像要素の左上を基準、px単位）
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
    if (pinchStartImagePointRef.current) {
      const originX = pinchStartImagePointRef.current.x;
      const originY = pinchStartImagePointRef.current.y;
      setCanvasTranslate((currentTranslate) => {
        return clampTranslate(currentTranslate, canvasScale, originX, originY);
      });
    }
  }, [canvasScale, clampTranslate]);

  /**
   * ピンチ開始
   */
  const handlePinchStart = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      // タッチ点の座標を取得（デバッグ用）
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
      // 注意: 既にtransformが適用されているため、スケール後の座標が返される
      const imageRect = imgElement.getBoundingClientRect();
      const viewportRect = imageContainerRef.current.getBoundingClientRect();
      
      // CanvasZoomLayerの位置を取得（transform-originの基準となる）
      const zoomLayerRect = canvasZoomLayerRef?.current?.getBoundingClientRect() || viewportRect;
      
      console.log("[PinchStart] Image rect (scaled):", {
        left: imageRect.left,
        top: imageRect.top,
        width: imageRect.width,
        height: imageRect.height,
      });
      
      console.log("[PinchStart] ZoomLayer rect:", {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
      });
      
      // 2点の中点をCanvasZoomLayerの座標系に変換（CanvasZoomLayerの左上を基準、px単位）
      // transform-originはCanvasZoomLayerに適用されるため、CanvasZoomLayerの座標系で指定する必要がある
      const zoomLayerPointX = centerX - zoomLayerRect.left;
      const zoomLayerPointY = centerY - zoomLayerRect.top;
      
      console.log("[PinchStart] Center point (zoomLayer coordinates):", {
        x: zoomLayerPointX,
        y: zoomLayerPointY,
      });
      
      // transform-originを設定（CanvasZoomLayerの左上からの相対位置、px単位）
      const originX = zoomLayerPointX;
      const originY = zoomLayerPointY;
      setTransformOrigin(`${originX}px ${originY}px`);
      
      console.log("[PinchStart] Transform origin:", `${originX}px ${originY}px`);
      
      // ピンチ開始時の画像内の位置を記録（画像要素の座標系、スケール前の座標）
      // スケール前の画像要素の位置を計算
      const unscaledImageWidth = imageRect.width / canvasScale;
      const unscaledImageHeight = imageRect.height / canvasScale;
      const unscaledImageLeft = zoomLayerRect.left + zoomLayerRect.width / 2 - (unscaledImageWidth / 2) - canvasTranslate.x;
      const unscaledImageTop = zoomLayerRect.top + zoomLayerRect.height / 2 - (unscaledImageHeight / 2) - canvasTranslate.y;
      
      const imagePointX = centerX - unscaledImageLeft;
      const imagePointY = centerY - unscaledImageTop;
      
      pinchStartImagePointRef.current = { x: imagePointX, y: imagePointY };
      pinchStartImageRectRef.current = new DOMRect(unscaledImageLeft, unscaledImageTop, unscaledImageWidth, unscaledImageHeight);
      
      // ビューポート中心を基準とした相対位置も記録（パン用）
      const viewportCenterX = viewportRect.left + viewportRect.width / 2;
      const viewportCenterY = viewportRect.top + viewportRect.height / 2;
      const relativeCenterX = centerX - viewportCenterX;
      const relativeCenterY = centerY - viewportCenterY;
      pinchStartCenterRef.current = { x: relativeCenterX, y: relativeCenterY };

      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = canvasScale;
      pinchStartTranslateRef.current = { ...canvasTranslate };
    },
    [canvasScale, canvasTranslate, imageContainerRef, canvasRef, canvasZoomLayerRef, initialImageSizeRef]
  );

  /**
   * ピンチ移動
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartImagePointRef.current === null) {
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

      // CanvasZoomLayerの位置を取得（transform-originの基準となる）
      const zoomLayerRect = canvasZoomLayerRef?.current?.getBoundingClientRect() || viewportRect;
      
      console.log("[PinchMove] ZoomLayer rect:", {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
      });
      
      // 現在の2点の中点をCanvasZoomLayerの座標系に変換（CanvasZoomLayerの左上を基準、px単位）
      const currentZoomLayerPointX = currentCenterX - zoomLayerRect.left;
      const currentZoomLayerPointY = currentCenterY - zoomLayerRect.top;
      
      console.log("[PinchMove] Center point (zoomLayer coordinates):", {
        x: currentZoomLayerPointX,
        y: currentZoomLayerPointY,
      });
      
      // transform-originを設定（現在の位置を基準にズーム）
      // ピンチ操作中は、現在の位置を基準にズームする
      const originX = currentZoomLayerPointX;
      const originY = currentZoomLayerPointY;
      setTransformOrigin(`${originX}px ${originY}px`);
      
      console.log("[PinchMove] Transform origin:", `${originX}px ${originY}px`);
      
      // ピンチ開始時の位置（CanvasZoomLayerの座標系）
      const startZoomLayerPointX = pinchStartImageRectRef.current 
        ? (pinchStartImageRectRef.current.left + pinchStartImagePointRef.current.x) - zoomLayerRect.left
        : originX;
      const startZoomLayerPointY = pinchStartImageRectRef.current
        ? (pinchStartImageRectRef.current.top + pinchStartImagePointRef.current.y) - zoomLayerRect.top
        : originY;
      
      console.log("[PinchMove] Start point (zoomLayer coordinates):", {
        x: startZoomLayerPointX,
        y: startZoomLayerPointY,
      });
      
      // 現在の位置が画面上で固定されるようにtranslateを計算
      // transform-originを基準にした場合、スケール後の位置は以下のように計算される
      // スケール前の位置: currentZoomLayerPointX, currentZoomLayerPointY
      // スケール後の位置: originX + (currentZoomLayerPointX - originX) * scaleRatio
      const scaleRatio = newScale / pinchStartScaleRef.current;
      
      // 現在の位置が画面上で固定されるようにtranslateを計算
      // transform-originを基準にスケールする場合、その位置が画面上で固定されるようにtranslateを調整する必要がある
      // スケール前の位置: currentZoomLayerPointX, currentZoomLayerPointY
      // スケール後の位置: originX + (currentZoomLayerPointX - originX) * scaleRatio
      // 位置の差: currentZoomLayerPointX - (originX + (currentZoomLayerPointX - originX) * scaleRatio)
      // = currentZoomLayerPointX - originX - (currentZoomLayerPointX - originX) * scaleRatio
      // = (currentZoomLayerPointX - originX) * (1 - scaleRatio)
      
      // 現在の位置を基準にしたスケール後の位置
      const scaledCurrentZoomLayerPointX = originX + (currentZoomLayerPointX - originX) * scaleRatio;
      const scaledCurrentZoomLayerPointY = originY + (currentZoomLayerPointY - originY) * scaleRatio;
      
      // 現在の位置が画面上で固定されるようにtranslateを計算
      // スケール前の位置とスケール後の位置の差を計算
      const currentDeltaX = currentZoomLayerPointX - scaledCurrentZoomLayerPointX;
      const currentDeltaY = currentZoomLayerPointY - scaledCurrentZoomLayerPointY;
      
      // 開始時の位置を基準にしたスケール後の位置（開始時のtransform-originを基準に計算）
      const startOriginX = startZoomLayerPointX;
      const startOriginY = startZoomLayerPointY;
      const scaledStartZoomLayerPointX = startOriginX + (startZoomLayerPointX - startOriginX) * scaleRatio;
      const scaledStartZoomLayerPointY = startOriginY + (startZoomLayerPointY - startOriginY) * scaleRatio;
      
      // 開始時の位置の移動分
      const startDeltaX = startZoomLayerPointX - scaledStartZoomLayerPointX;
      const startDeltaY = startZoomLayerPointY - scaledStartZoomLayerPointY;
      
      console.log("[PinchMove] Scaled positions:", {
        start: { x: scaledStartZoomLayerPointX, y: scaledStartZoomLayerPointY },
        current: { x: scaledCurrentZoomLayerPointX, y: scaledCurrentZoomLayerPointY },
      });
      
      console.log("[PinchMove] Deltas:", {
        start: { x: startDeltaX, y: startDeltaY },
        current: { x: currentDeltaX, y: currentDeltaY },
      });
      
      // translateを計算（現在の位置が画面上で固定されるように）
      // 開始時の位置の移動分から現在の位置の移動分を引く
      const newTranslateX = pinchStartTranslateRef.current.x + startDeltaX - currentDeltaX;
      const newTranslateY = pinchStartTranslateRef.current.y + startDeltaY - currentDeltaY;
      
      console.log("[PinchMove] Translate:", { x: newTranslateX, y: newTranslateY });
      
      // 移動範囲を制限
      // clampTranslateには画像要素の座標系でのoriginX, originYを渡す必要がある
      // スケール前の画像要素の位置を計算
      const unscaledImageWidth = initialImageSizeRef.current ? initialImageSizeRef.current.width : 0;
      const unscaledImageHeight = initialImageSizeRef.current ? initialImageSizeRef.current.height : 0;
      const unscaledImageLeft = zoomLayerRect.left + zoomLayerRect.width / 2 - (unscaledImageWidth / 2) - newTranslateX;
      const unscaledImageTop = zoomLayerRect.top + zoomLayerRect.height / 2 - (unscaledImageHeight / 2) - newTranslateY;
      
      const imageOriginX = currentCenterX - unscaledImageLeft;
      const imageOriginY = currentCenterY - unscaledImageTop;
      
      const clampedTranslate = clampTranslate({ x: newTranslateX, y: newTranslateY }, newScale, imageOriginX, imageOriginY);
      
      setCanvasScale(newScale);
      setCanvasTranslate(clampedTranslate);
    },
    [clampTranslate, imageContainerRef, canvasRef]
  );

  /**
   * ピンチ終了
   */
  const handlePinchEnd = useCallback(() => {
    pinchStartDistanceRef.current = null;
    pinchStartCenterRef.current = null;
    pinchStartImagePointRef.current = null;
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

