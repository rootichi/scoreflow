import { useState, useRef, useCallback, useEffect } from "react";

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
  
  // スケール比の閾値（これより小さい変化は無視）
  const SCALE_EPSILON = 0.001;
  
  // ピンチ中フラグ（イベント責務分離のため）
  const isPinchingRef = useRef<boolean>(false);
  
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartMatrixRef = useRef<DOMMatrix | null>(null); // ピンチ開始時の基準行列（baseMatrix）
  const pinchStartCenterLocalRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の基準中心位置（basePinchCenter）

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

      // ピンチ中フラグを設定
      isPinchingRef.current = true;
      
      // ピンチ開始時の基準値を記録（baseMatrix, baseScaleDistance, basePinchCenter）
      const currentMatrix = transformMatrix;
      pinchStartMatrixRef.current = new DOMMatrix(currentMatrix); // baseMatrix
      pinchStartDistanceRef.current = distance; // baseScaleDistance
      pinchStartCenterLocalRef.current = { x: centerXLocal, y: centerYLocal }; // basePinchCenter

      const scale = Math.sqrt(currentMatrix.a * currentMatrix.a + currentMatrix.b * currentMatrix.b);
      const translateX = currentMatrix.e;
      const translateY = currentMatrix.f;
      
      console.log("[PinchStart] isPinching: true");
      console.log("[PinchStart] pointerCount: 2");
      console.log("[PinchStart] scale:", scale);
      console.log("[PinchStart] translateX:", translateX);
      console.log("[PinchStart] translateY:", translateY);
      console.log("[PinchStart] transform-origin:", transformOrigin);
      console.log("[PinchStart] Base matrix (saved):", {
        a: currentMatrix.a,
        b: currentMatrix.b,
        c: currentMatrix.c,
        d: currentMatrix.d,
        e: currentMatrix.e,
        f: currentMatrix.f,
      });
      console.log("[PinchStart] Base scale distance:", distance);
      console.log("[PinchStart] Base pinch center (local):", { x: centerXLocal, y: centerYLocal });
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
      // ピンチ中でない場合は処理しない
      if (!isPinchingRef.current) {
        console.log("[PinchMove] isPinching is false, skipping");
        return;
      }
      
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

      // スケール比を計算（scaleRatio）
      const scaleRatio = currentDistance / pinchStartDistanceRef.current;
      
      console.log("[PinchMove] Scale ratio:", scaleRatio);
      console.log("[PinchMove] Scale ratio - 1:", scaleRatio - 1);
      console.log("[PinchMove] |Scale ratio - 1|:", Math.abs(scaleRatio - 1));

      // スケール比が1.0に近い場合は行列を更新しない（必須のガード処理）
      if (Math.abs(scaleRatio - 1) <= SCALE_EPSILON) {
        console.log("[PinchMove] Scale ratio is 1.0 (within epsilon), skipping matrix update");
        console.log("[PinchMove] Matrix updated: false");
        console.log("[PinchMove] =====================");
        return;
      }

      if (!canvasZoomLayerRef?.current) {
        return;
      }

      // 現在のピンチ中心をCanvasZoomLayerのローカル座標に変換（検証用）
      const zoomLayerRect = canvasZoomLayerRef.current.getBoundingClientRect();
      const currentCenterXLocal = currentCenterXViewport - zoomLayerRect.left;
      const currentCenterYLocal = currentCenterYViewport - zoomLayerRect.top;
      
      console.log("[PinchMove] Current center point (local):", { x: currentCenterXLocal, y: currentCenterYLocal });
      console.log("[PinchMove] Base center point (local):", pinchStartCenterLocalRef.current);

      // ピンチ中心を基準にしたズーム行列を合成
      // T(cx, cy) → S(scaleRatio) → T(-cx, -cy)
      // 
      // DOMMatrixのmultiplyは右から左に適用される
      // A.multiply(B) は B * A を意味する
      // 
      // 欲しい変換: T(cx, cy) * S(scaleRatio) * T(-cx, -cy) * baseMatrix
      // これを実現するには:
      // baseMatrix.multiply(translateToOrigin).multiply(scaleMatrix).multiply(translateBack)
      
      const cx = pinchStartCenterLocalRef.current.x; // basePinchCenter.x
      const cy = pinchStartCenterLocalRef.current.y; // basePinchCenter.y
      
      // 1. ピンチ中心を原点に移動: T(-cx, -cy)
      const translateToOrigin = new DOMMatrix().translate(-cx, -cy);
      
      // 2. スケール: S(scaleRatio)
      const scaleMatrix = new DOMMatrix().scale(scaleRatio, scaleRatio);
      
      // 3. 元の位置に戻す: T(cx, cy)
      const translateBack = new DOMMatrix().translate(cx, cy);
      
      // 合成: baseMatrix * T(-cx, -cy) * S(scaleRatio) * T(cx, cy)
      // これは T(cx, cy) * S(scaleRatio) * T(-cx, -cy) * baseMatrix と等価
      const newMatrix = pinchStartMatrixRef.current
        .multiply(translateToOrigin)
        .multiply(scaleMatrix)
        .multiply(translateBack);
      
      const scale = Math.sqrt(newMatrix.a * newMatrix.a + newMatrix.b * newMatrix.b);
      const translateX = newMatrix.e;
      const translateY = newMatrix.f;
      
      console.log("[PinchMove] isPinching: true");
      console.log("[PinchMove] pointerCount: 2");
      console.log("[PinchMove] Matrix updated: true");
      console.log("[PinchMove] Event: pinch-move");
      console.log("[PinchMove] scale:", scale);
      console.log("[PinchMove] translateX:", translateX);
      console.log("[PinchMove] translateY:", translateY);
      console.log("[PinchMove] transform-origin:", transformOrigin);
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
   * transformMatrixを一切更新しない、再適用しない、正規化しない
   */
  const handlePinchEnd = useCallback(() => {
    const scale = Math.sqrt(transformMatrix.a * transformMatrix.a + transformMatrix.b * transformMatrix.b);
    const translateX = transformMatrix.e;
    const translateY = transformMatrix.f;
    
    console.log("[PinchEnd] ===== ピンチ終了 =====");
    console.log("[PinchEnd] isPinching: false (setting)");
    console.log("[PinchEnd] pointerCount: < 2");
    console.log("[PinchEnd] scale:", scale);
    console.log("[PinchEnd] translateX:", translateX);
    console.log("[PinchEnd] translateY:", translateY);
    console.log("[PinchEnd] transform-origin:", transformOrigin);
    console.log("[PinchEnd] Transform matrix (unchanged):", {
      a: transformMatrix.a,
      b: transformMatrix.b,
      c: transformMatrix.c,
      d: transformMatrix.d,
      e: transformMatrix.e,
      f: transformMatrix.f,
    });
    console.log("[PinchEnd] Pinch center (local):", pinchStartCenterLocalRef.current);
    console.log("[PinchEnd] Matrix updated: false");
    console.log("[PinchEnd] Event: pinch-end (no-op frame)");
    
    // ピンチ中フラグを解除
    isPinchingRef.current = false;
    
    // ピンチ開始時の記録をクリア
    pinchStartDistanceRef.current = null;
    pinchStartMatrixRef.current = null;
    pinchStartCenterLocalRef.current = null;
    
    // 重要: transformMatrixは一切更新しない
    // setTransformMatrix()を呼ばない
    // CSS transformを再適用しない
    // translate/clamp/normalize処理を行わない
    
    console.log("[PinchEnd] =====================");
  }, [transformMatrix]);

  // transform行列をCSSのmatrix()形式に変換
  const transformString = `matrix(${transformMatrix.a}, ${transformMatrix.b}, ${transformMatrix.c}, ${transformMatrix.d}, ${transformMatrix.e}, ${transformMatrix.f})`;

  // デバッグ: transformStringが再計算されるたびにログ出力
  useEffect(() => {
    const scale = Math.sqrt(transformMatrix.a * transformMatrix.a + transformMatrix.b * transformMatrix.b);
    const translateX = transformMatrix.e;
    const translateY = transformMatrix.f;
    
    console.log("[TransformString] ===== transformString再計算 =====");
    console.log("[TransformString] Event: render/re-render");
    console.log("[TransformString] isPinching:", isPinchingRef.current);
    console.log("[TransformString] scale:", scale);
    console.log("[TransformString] translateX:", translateX);
    console.log("[TransformString] translateY:", translateY);
    console.log("[TransformString] transform-origin:", transformOrigin);
    console.log("[TransformString] transform matrix:", {
      a: transformMatrix.a,
      b: transformMatrix.b,
      c: transformMatrix.c,
      d: transformMatrix.d,
      e: transformMatrix.e,
      f: transformMatrix.f,
    });
    console.log("[TransformString] transformString:", transformString);
    console.log("[TransformString] =====================");
  }, [transformMatrix, transformString]);

  // isPinchingの現在の状態を返す（ページ側でpan/drag処理を制御するため）
  const isPinching = isPinchingRef.current;

  return {
    transformString,
    transformOrigin,
    isPinching,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}
