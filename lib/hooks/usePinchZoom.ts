import { useState, useRef, useCallback, useEffect } from "react";

/**
 * ピンチズーム用のカスタムフック
 */
export function usePinchZoom(
  imageContainerRef: React.RefObject<HTMLDivElement | null>,
  initialImageSizeRef: React.MutableRefObject<{ width: number; height: number } | null>,
  canvasRef?: React.RefObject<HTMLDivElement | null>
) {
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasTranslate, setCanvasTranslate] = useState({ x: 0, y: 0 });
  const [transformOrigin, setTransformOrigin] = useState<string>("center center");
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartImagePointRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の画像内の位置（画像要素の左上を基準、px単位）

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
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 2点の中点を取得（ビューポート座標系）
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      // 画像要素を取得
      const container = canvasRef?.current || imageContainerRef.current;
      const imgElement = container?.querySelector("img");
      
      if (imgElement && imageContainerRef.current) {
        // 画像要素のDOM実寸を取得（getBoundingClientRect）
        const imageRect = imgElement.getBoundingClientRect();
        const viewportRect = imageContainerRef.current.getBoundingClientRect();
        
        // 2点の中点を画像要素の座標系に変換（画像要素の左上を基準、px単位）
        const imagePointX = centerX - imageRect.left;
        const imagePointY = centerY - imageRect.top;
        
        // 画像要素のサイズを取得
        const imageWidth = imageRect.width;
        const imageHeight = imageRect.height;
        
        // transform-originを設定（画像要素の左上からの相対位置、px単位）
        const originX = imagePointX;
        const originY = imagePointY;
        setTransformOrigin(`${originX}px ${originY}px`);
        
        // ピンチ開始時の画像内の位置を記録
        pinchStartImagePointRef.current = { x: originX, y: originY };
        
        // ビューポート中心を基準とした相対位置も記録（パン用）
        const viewportCenterX = viewportRect.left + viewportRect.width / 2;
        const viewportCenterY = viewportRect.top + viewportRect.height / 2;
        const relativeCenterX = centerX - viewportCenterX;
        const relativeCenterY = centerY - viewportCenterY;
        pinchStartCenterRef.current = { x: relativeCenterX, y: relativeCenterY };
      } else {
        // フォールバック: 画像要素が見つからない場合
        pinchStartImagePointRef.current = null;
        setTransformOrigin("center center");
        if (imageContainerRef.current) {
          const viewportRect = imageContainerRef.current.getBoundingClientRect();
          const viewportCenterX = viewportRect.left + viewportRect.width / 2;
          const viewportCenterY = viewportRect.top + viewportRect.height / 2;
          const relativeCenterX = centerX - viewportCenterX;
          const relativeCenterY = centerY - viewportCenterY;
          pinchStartCenterRef.current = { x: relativeCenterX, y: relativeCenterY };
        } else {
          pinchStartCenterRef.current = { x: centerX, y: centerY };
        }
      }

      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = canvasScale;
      pinchStartTranslateRef.current = { ...canvasTranslate };
    },
    [canvasScale, canvasTranslate, imageContainerRef, canvasRef]
  );

  /**
   * ピンチ移動
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartImagePointRef.current === null) {
        return;
      }

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 現在の2点の中点を取得（ビューポート座標系）
      const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

      if (imageContainerRef.current) {
        const viewportRect = imageContainerRef.current.getBoundingClientRect();
        
        // スケール変更を計算
        const scaleChange = currentDistance / pinchStartDistanceRef.current;
        const newScale = Math.max(1.0, Math.min(5, pinchStartScaleRef.current * scaleChange));
        
        // 画像要素を取得
        const container = canvasRef?.current || imageContainerRef.current;
        const imgElement = container?.querySelector("img");
        
        if (imgElement) {
          // 画像要素のDOM実寸を取得（getBoundingClientRect）
          const imageRect = imgElement.getBoundingClientRect();
          
          // ピンチ開始時の画像内の位置（画像要素の左上を基準、px単位）
          const startImagePointX = pinchStartImagePointRef.current.x;
          const startImagePointY = pinchStartImagePointRef.current.y;
          
          // transform-originを設定（ピンチ開始時の位置を基準に固定）
          // ピンチ操作中は、開始時の位置を基準にズームする
          const originX = startImagePointX;
          const originY = startImagePointY;
          setTransformOrigin(`${originX}px ${originY}px`);
          
          // ピンチ開始時の位置が画面上で固定されるようにtranslateを計算
          // ビューポート中心を基準とした座標系で計算
          const viewportCenterX = viewportRect.left + viewportRect.width / 2;
          const viewportCenterY = viewportRect.top + viewportRect.height / 2;
          
          // ピンチ開始時の位置（ビューポート座標系）
          // 画像要素の左上からの相対位置をビューポート座標系に変換
          const startViewportX = imageRect.left + startImagePointX;
          const startViewportY = imageRect.top + startImagePointY;
          
          // 現在の位置（ビューポート座標系）
          const currentImagePointX = currentCenterX - imageRect.left;
          const currentImagePointY = currentCenterY - imageRect.top;
          const currentViewportX = imageRect.left + currentImagePointX;
          const currentViewportY = imageRect.top + currentImagePointY;
          
          // スケール変更による位置の変化を計算
          // ピンチ開始時の位置を基準にズームするため、その位置が画面上で固定されるようにtranslateを調整
          // transform-originを基準にした場合、スケール後の位置は以下のように計算される
          // スケール前の位置: startViewportX, startViewportY
          // スケール後の位置: viewportCenterX + (startViewportX - viewportCenterX) * scaleRatio
          const scaleRatio = newScale / pinchStartScaleRef.current;
          const scaledStartViewportX = viewportCenterX + (startViewportX - viewportCenterX) * scaleRatio;
          const scaledStartViewportY = viewportCenterY + (startViewportY - viewportCenterY) * scaleRatio;
          
          // 現在の位置との差を計算してtranslateを調整
          // ピンチ開始時の位置が画面上で固定されるように、現在の位置との差をtranslateに加算
          const deltaX = currentViewportX - scaledStartViewportX;
          const deltaY = currentViewportY - scaledStartViewportY;
          
          // translateを計算（ピンチ開始時の位置を基準に、現在の位置が画面上で固定されるように）
          const newTranslateX = pinchStartTranslateRef.current.x + deltaX;
          const newTranslateY = pinchStartTranslateRef.current.y + deltaY;
          
          // 移動範囲を制限
          const clampedTranslate = clampTranslate({ x: newTranslateX, y: newTranslateY }, newScale, originX, originY);
          
          setCanvasScale(newScale);
          setCanvasTranslate(clampedTranslate);
        }
      }
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

