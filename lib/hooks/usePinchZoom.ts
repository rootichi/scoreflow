import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Canva風のピンチズーム・ドラッグ・パン操作を管理するカスタムフック
 * 
 * 設計原則:
 * 1. scaleとtranslateを独立して管理
 * 2. transform-originを動的に設定してピンチ中心を基準にしたズームを実現
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
  
  // transform-originを動的に管理（ピンチ中心の位置）
  const [transformOrigin, setTransformOrigin] = useState<string>("0 0");
  
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
      
      // transform-originをピンチ中心の位置に設定
      // これにより、ピンチ中心を基準にしたズームが自然に実現できる
      setTransformOrigin(`${centerXLocal}px ${centerYLocal}px`);
    },
    [scale, translateX, translateY, canvasZoomLayerRef]
  );

  /**
   * ピンチ移動
   * 
   * transform-originをピンチ中心に設定することで、
   * シンプルなscaleとtranslateの組み合わせでピンチ中心を基準にしたズームを実現
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

      // 現在のピンチ中心を取得（ビューポート座標系）
      const currentCenterXViewport = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterYViewport = (touch1.clientY + touch2.clientY) / 2;
      
      // ピンチ中心をCanvasZoomLayerのローカル座標に変換
      const currentCenterXLocal = currentCenterXViewport - zoomLayerRectRef.current.left;
      const currentCenterYLocal = currentCenterYViewport - zoomLayerRectRef.current.top;

      // transform-originをピンチ開始時の中心位置に固定
      // これにより、ピンチ開始時の中心位置を基準にしたズームが実現できる
      const startCenterX = pinchStartCenterRef.current.x;
      const startCenterY = pinchStartCenterRef.current.y;
      setTransformOrigin(`${startCenterX}px ${startCenterY}px`);

      // ピンチ中心を基準にしたズームを実現
      // transform-originがピンチ開始時の中心位置に設定されているため、
      // シンプルにscaleを更新するだけで、ピンチ開始時の中心位置を基準にしたズームが実現できる
      // 
      // ピンチ中に指が動いた場合、translateを調整して、
      // ピンチ開始時の中心位置が同じ画面位置に来るようにする
      // 
      // 計算式:
      // 開始時の中心位置（ローカル座標）を、現在のtransform（scale + translate）で変換した位置
      // = 開始時の中心位置（ローカル座標） * 開始時のscale + 開始時のtranslate
      // 
      // 新しいtransform（新しいscale + 新しいtranslate）で変換した位置が同じになるようにする
      // = 開始時の中心位置（ローカル座標） * 新しいscale + 新しいtranslate
      // 
      // したがって:
      // 新しいtranslate = 開始時の中心位置（ローカル座標） * 開始時のscale + 開始時のtranslate
      //                  - 開始時の中心位置（ローカル座標） * 新しいscale
      //                = 開始時の中心位置（ローカル座標） * (開始時のscale - 新しいscale) + 開始時のtranslate
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
    
    // transform-originをデフォルト（左上）に戻す
    // ピンチ終了後は、通常の操作（パンなど）でtransform-originが左上の方が自然
    setTransformOrigin("0 0");
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
  // transform-originが動的に設定されているため、シンプルなscaleとtranslateの組み合わせで実現
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
