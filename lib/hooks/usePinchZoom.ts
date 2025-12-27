import { useState, useRef, useCallback } from "react";

/**
 * ピンチズーム用のカスタムフック
 * transformを行列（matrix）として管理する方式
 */
export function usePinchZoom(
  imageContainerRef: React.RefObject<HTMLDivElement | null>,
  initialImageSizeRef: React.MutableRefObject<{ width: number; height: number } | null>,
  canvasRef?: React.RefObject<HTMLDivElement | null>,
  canvasZoomLayerRef?: React.RefObject<HTMLDivElement | null>
) {
  // transformを行列として管理
  // 初期状態: 単位行列（scale=1, translate=0,0）
  const [transformMatrix, setTransformMatrix] = useState<DOMMatrix>(new DOMMatrix());
  
  // transform-originは常に0 0（左上）に固定
  const transformOrigin = "0 0";
  
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartMatrixRef = useRef<DOMMatrix | null>(null); // ピンチ開始時の行列
  const pinchStartCenterLocalRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の中心位置（CanvasZoomLayerローカル座標）

  /**
   * ピンチ開始
   * 
   * ピンチ中心をCanvasZoomLayerのローカル座標に変換し、
   * 現在のtransform行列を記録する
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
      const centerXLocal = centerXViewport - zoomLayerRect.left;
      const centerYLocal = centerYViewport - zoomLayerRect.top;

      console.log("[PinchStart] Center point (local):", { x: centerXLocal, y: centerYLocal });
      console.log("[PinchStart] ZoomLayer rect:", {
        left: zoomLayerRect.left,
        top: zoomLayerRect.top,
        width: zoomLayerRect.width,
        height: zoomLayerRect.height,
      });

      // 現在のtransform行列を記録
      const currentMatrix = transformMatrix;
      pinchStartMatrixRef.current = new DOMMatrix(currentMatrix);
      pinchStartDistanceRef.current = distance;
      pinchStartCenterLocalRef.current = { x: centerXLocal, y: centerYLocal };

      console.log("[PinchStart] Current transform matrix:", {
        a: currentMatrix.a,
        b: currentMatrix.b,
        c: currentMatrix.c,
        d: currentMatrix.d,
        e: currentMatrix.e,
        f: currentMatrix.f,
      });
      console.log("[PinchStart] =====================");
    },
    [transformMatrix, canvasZoomLayerRef]
  );

  /**
   * ピンチ移動
   * 
   * ピンチ中心を基準にしたズーム行列を合成
   * T(cx, cy) → S(scale) → T(-cx, -cy)
   * これを既存の行列に乗算
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      if (pinchStartDistanceRef.current === null || pinchStartCenterLocalRef.current === null || pinchStartMatrixRef.current === null) {
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
      
      // ピンチ開始時の行列から現在のスケールを取得
      const startScale = Math.sqrt(pinchStartMatrixRef.current.a * pinchStartMatrixRef.current.a + pinchStartMatrixRef.current.b * pinchStartMatrixRef.current.b);
      const newScale = Math.max(1.0, Math.min(5, startScale * scaleChange));
      
      console.log("[PinchMove] Scale change:", scaleChange);
      console.log("[PinchMove] Start scale:", startScale);
      console.log("[PinchMove] New scale:", newScale);

      if (!canvasZoomLayerRef?.current) {
        return;
      }

      // 現在のピンチ中心をCanvasZoomLayerのローカル座標に変換（検証用）
      const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
      const currentCenterXLocal = currentCenterXViewport - zoomLayerRect.left;
      const currentCenterYLocal = currentCenterYViewport - zoomLayerRect.top;
      
      console.log("[PinchMove] Current center point (local):", { x: currentCenterXLocal, y: currentCenterYLocal });

      // ピンチ中心を基準にしたズーム行列を合成
      // T(cx, cy) → S(scale) → T(-cx, -cy)
      // 
      // DOMMatrixのmultiplyは右から左に適用される
      // A.multiply(B) は B * A を意味する
      // 
      // 欲しい変換: T(cx, cy) * S(scale) * T(-cx, -cy) * startMatrix
      // これを実現するには:
      // startMatrix.multiply(translateToOrigin).multiply(scaleMatrix).multiply(translateBack)
      
      const cx = pinchStartCenterLocalRef.current.x;
      const cy = pinchStartCenterLocalRef.current.y;
      
      // 1. ピンチ中心を原点に移動: T(-cx, -cy)
      const translateToOrigin = new DOMMatrix().translate(-cx, -cy);
      
      // 2. スケール: S(scale)
      const scale = newScale / startScale; // 相対スケール
      const scaleMatrix = new DOMMatrix().scale(scale, scale);
      
      // 3. 元の位置に戻す: T(cx, cy)
      const translateBack = new DOMMatrix().translate(cx, cy);
      
      // 合成: startMatrix * T(-cx, -cy) * S(scale) * T(cx, cy)
      // これは T(cx, cy) * S(scale) * T(-cx, -cy) * startMatrix と等価
      const newMatrix = pinchStartMatrixRef.current
        .multiply(translateToOrigin)
        .multiply(scaleMatrix)
        .multiply(translateBack);
      
      console.log("[PinchMove] Zoom matrix:", {
        a: zoomMatrix.a,
        b: zoomMatrix.b,
        c: zoomMatrix.c,
        d: zoomMatrix.d,
        e: zoomMatrix.e,
        f: zoomMatrix.f,
      });
      console.log("[PinchMove] New transform matrix:", {
        a: newMatrix.a,
        b: newMatrix.b,
        c: newMatrix.c,
        d: newMatrix.d,
        e: newMatrix.e,
        f: newMatrix.f,
      });
      
      setTransformMatrix(newMatrix);
      
      console.log("[PinchMove] =====================");
    },
    [canvasZoomLayerRef]
  );

  /**
   * ピンチ終了
   * 
   * 何も変更しない（行列がそのまま残る）
   */
  const handlePinchEnd = useCallback(() => {
    console.log("[PinchEnd] ===== ピンチ終了 =====");
    console.log("[PinchEnd] Transform matrix:", {
      a: transformMatrix.a,
      b: transformMatrix.b,
      c: transformMatrix.c,
      d: transformMatrix.d,
      e: transformMatrix.e,
      f: transformMatrix.f,
    });
    console.log("[PinchEnd] Pinch center (local):", pinchStartCenterLocalRef.current);
    
    // ピンチ開始時の記録をクリア
    pinchStartDistanceRef.current = null;
    pinchStartMatrixRef.current = null;
    pinchStartCenterLocalRef.current = null;
    
    console.log("[PinchEnd] =====================");
  }, [transformMatrix]);

  // transform行列をCSSのmatrix()形式に変換
  const transformString = `matrix(${transformMatrix.a}, ${transformMatrix.b}, ${transformMatrix.c}, ${transformMatrix.d}, ${transformMatrix.e}, ${transformMatrix.f})`;

  return {
    transformString,
    transformOrigin,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}
