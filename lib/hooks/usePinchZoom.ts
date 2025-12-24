import { useState, useRef, useCallback, useEffect } from "react";

/**
 * ピンチズーム用のカスタムフック
 */
export function usePinchZoom(
  imageContainerRef: React.RefObject<HTMLDivElement | null>,
  initialImageSizeRef: React.MutableRefObject<{ width: number; height: number } | null>
) {
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasTranslate, setCanvasTranslate] = useState({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 移動範囲を制限する関数
  const clampTranslate = useCallback(
    (translate: { x: number; y: number }, scale: number) => {
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

      // transform-origin: center centerを考慮した移動範囲の計算
      // 拡大縮小は中心を基準に行われるため、移動範囲は以下のように計算される
      // 左方向の最大移動: (scaledWidth - viewportWidth) / 2
      // 右方向の最大移動: (scaledWidth - viewportWidth) / 2
      // 上方向の最大移動: (scaledHeight - viewportHeight) / 2
      // 下方向の最大移動: (scaledHeight - viewportHeight) / 2
      const maxTranslateX = Math.max(0, (scaledWidth - viewportWidth) / 2);
      const maxTranslateY = Math.max(0, (scaledHeight - viewportHeight) / 2);

      // 移動範囲を制限（初期画像の境界を超えないように）
      const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translate.x));
      const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translate.y));

      return { x: clampedX, y: clampedY };
    },
    [imageContainerRef, initialImageSizeRef]
  );

  // スケール変更時に移動範囲を制限
  useEffect(() => {
    setCanvasTranslate((currentTranslate) => {
      return clampTranslate(currentTranslate, canvasScale);
    });
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

      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

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

      pinchStartDistanceRef.current = distance;
      pinchStartScaleRef.current = canvasScale;
      pinchStartTranslateRef.current = { ...canvasTranslate };
    },
    [canvasScale, canvasTranslate, imageContainerRef]
  );

  /**
   * ピンチ移動
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartCenterRef.current === null) {
        return;
      }

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

      if (imageContainerRef.current) {
        const viewportRect = imageContainerRef.current.getBoundingClientRect();
        const viewportCenterX = viewportRect.left + viewportRect.width / 2;
        const viewportCenterY = viewportRect.top + viewportRect.height / 2;

        const currentRelativeCenterX = currentCenterX - viewportCenterX;
        const currentRelativeCenterY = currentCenterY - viewportCenterY;

        const scaleChange = currentDistance / pinchStartDistanceRef.current;
        const newScale = Math.max(1.0, Math.min(5, pinchStartScaleRef.current * scaleChange));

        const centerDeltaX = currentRelativeCenterX - pinchStartCenterRef.current.x;
        const centerDeltaY = currentRelativeCenterY - pinchStartCenterRef.current.y;

        const newTranslateX = pinchStartTranslateRef.current.x + centerDeltaX;
        const newTranslateY = pinchStartTranslateRef.current.y + centerDeltaY;

        const clampedTranslate = clampTranslate({ x: newTranslateX, y: newTranslateY }, newScale);

        setCanvasScale(newScale);
        setCanvasTranslate(clampedTranslate);
      }
    },
    [clampTranslate, imageContainerRef]
  );

  /**
   * ピンチ終了
   */
  const handlePinchEnd = useCallback(() => {
    pinchStartDistanceRef.current = null;
    pinchStartCenterRef.current = null;
  }, []);

  return {
    canvasScale,
    canvasTranslate,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}

