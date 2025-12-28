import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Canva風のピンチズーム・ドラッグ・パン操作を管理するカスタムフック
 * 
 * 設計原則:
 * 1. scaleとtranslateを独立して管理
 * 2. ピンチ中心を基準にしたズームをmatrix形式で直接計算
 * 3. ドラッグ/パンでtranslateを更新
 * 4. シンプルで理解しやすい実装
 */
export function usePinchZoom(
  imageContainerRef: React.RefObject<HTMLDivElement | null>,
  initialImageSizeRef: React.MutableRefObject<{ width: number; height: number } | null>,
  canvasRef?: React.RefObject<HTMLDivElement | null>,
  canvasZoomLayerRef?: React.RefObject<HTMLDivElement | null>
) {
  // scaleとtranslateを独立して管理
  const [scale, setScale] = useState<number>(1);
  const [translateX, setTranslateX] = useState<number>(0);
  const [translateY, setTranslateY] = useState<number>(0);
  
  // transform-originは常に0 0（左上）に固定
  const transformOrigin = "0 0";
  
  // ピンチ中フラグ
  const [isPinching, setIsPinching] = useState<boolean>(false);
  
  // ピンチ開始時の基準値
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartTranslateXRef = useRef<number>(0);
  const pinchStartTranslateYRef = useRef<number>(0);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const zoomLayerRectRef = useRef<DOMRect | null>(null);
  
  // ドラッグ/パン用の基準値
  const panStartRef = useRef<{ x: number; y: number; translateX: number; translateY: number } | null>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  
  // スケール比の閾値
  const SCALE_EPSILON = 0.001;
  
  /**
   * ピンチ開始
   */
  const handlePinchStart = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (!canvasZoomLayerRef?.current) {
        return;
      }

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 2点の中点を取得（ビューポート座標系）
      const centerXViewport = (touch1.clientX + touch2.clientX) / 2;
      const centerYViewport = (touch1.clientY + touch2.clientY) / 2;

      // CanvasZoomLayerの位置とサイズを取得（ピンチ開始時にキャッシュ）
      const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
      zoomLayerRectRef.current = {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
        right: zoomLayerRect.right,
        bottom: zoomLayerRect.bottom,
        x: zoomLayerRect.x,
        y: zoomLayerRect.y,
      } as DOMRect;
      
      // ピンチ中心をCanvasZoomLayerのローカル座標に変換
      const centerXLocal = centerXViewport - zoomLayerRectRef.current.left;
      const centerYLocal = centerYViewport - zoomLayerRectRef.current.top;

      // ピンチ中フラグを設定
      setIsPinching(true);
      
      // ピンチ開始時の基準値を記録
      pinchStartScaleRef.current = scale;
      pinchStartTranslateXRef.current = translateX;
      pinchStartTranslateYRef.current = translateY;
      pinchStartDistanceRef.current = distance;
      pinchStartCenterRef.current = { x: centerXLocal, y: centerYLocal };
    },
    [scale, translateX, translateY, canvasZoomLayerRef]
  );

  /**
   * ピンチ移動
   * 
   * ピンチ中心を基準にしたズームを実現
   * 
   * 数学的には:
   * ピンチ開始時の中心位置（startCenterX, startCenterY）を、現在のtransformで変換した位置を保持する
   * 
   * 開始時のtransform: scale = startScale, translate = (startTranslateX, startTranslateY)
   * 開始時の中心位置を変換: (startCenterX * startScale + startTranslateX, startCenterY * startScale + startTranslateY)
   * 
   * 新しいtransform: scale = newScale, translate = (newTranslateX, newTranslateY)
   * 新しいtransformで開始時の中心位置を変換: (startCenterX * newScale + newTranslateX, startCenterY * newScale + newTranslateY)
   * 
   * 開始時の中心位置が同じ画面位置に来るようにする:
   * startCenterX * startScale + startTranslateX = startCenterX * newScale + newTranslateX
   * startCenterY * startScale + startTranslateY = startCenterY * newScale + newTranslateY
   * 
   * したがって:
   * newTranslateX = startCenterX * (startScale - newScale) + startTranslateX
   * newTranslateY = startCenterY * (startScale - newScale) + startTranslateY
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (!isPinching || !canvasZoomLayerRef?.current || !zoomLayerRectRef.current) {
        return;
      }
      
      if (pinchStartDistanceRef.current === null || pinchStartCenterRef.current === null) {
        return;
      }

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // スケール比を計算
      const scaleRatio = currentDistance / pinchStartDistanceRef.current;
      const newScale = pinchStartScaleRef.current * scaleRatio;

      // スケール比が1.0に近い場合は更新しない
      if (Math.abs(scaleRatio - 1) <= SCALE_EPSILON) {
        return;
      }

      // ピンチ中心を基準にしたズームを実現
      const startCenterX = pinchStartCenterRef.current.x;
      const startCenterY = pinchStartCenterRef.current.y;
      
      // ピンチ開始時の中心位置が同じ画面位置に来るようにtranslateを計算
      const newTranslateX = startCenterX * (pinchStartScaleRef.current - newScale) + pinchStartTranslateXRef.current;
      const newTranslateY = startCenterY * (pinchStartScaleRef.current - newScale) + pinchStartTranslateYRef.current;

      // 状態を更新
      setScale(newScale);
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    },
    [isPinching, canvasZoomLayerRef]
  );

  /**
   * ピンチ終了
   */
  const handlePinchEnd = useCallback(() => {
    setIsPinching(false);
    
    // ピンチ開始時の記録をクリア
    pinchStartDistanceRef.current = null;
    pinchStartCenterRef.current = null;
    zoomLayerRectRef.current = null;
  }, []);

  /**
   * パン開始
   */
  const handlePanStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasZoomLayerRef?.current) {
        return;
      }

      setIsPanning(true);
      panStartRef.current = {
        x: clientX,
        y: clientY,
        translateX: translateX,
        translateY: translateY,
      };
    },
    [translateX, translateY, canvasZoomLayerRef]
  );

  /**
   * パン移動
   */
  const handlePanMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isPanning || !panStartRef.current) {
        return;
      }

      const deltaX = clientX - panStartRef.current.x;
      const deltaY = clientY - panStartRef.current.y;

      setTranslateX(panStartRef.current.translateX + deltaX);
      setTranslateY(panStartRef.current.translateY + deltaY);
    },
    [isPanning]
  );

  /**
   * パン終了
   */
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // transform文字列を生成
  // transform-originは0 0に固定されているため、シンプルなscaleとtranslateの組み合わせ
  const transformString = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

  // DOMにtransformを適用
  useEffect(() => {
    if (!canvasZoomLayerRef?.current) {
      return;
    }
    
    canvasZoomLayerRef.current.style.transform = transformString;
    canvasZoomLayerRef.current.style.transformOrigin = transformOrigin;
  }, [transformString, transformOrigin, canvasZoomLayerRef]);

  return {
    transformString,
    transformOrigin,
    isPinching,
    isPanning,
    scale,
    translateX,
    translateY,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
  };
}
