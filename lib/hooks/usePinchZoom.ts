import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// フレーム単位ログ用の型定義
interface FrameLog {
  frameId: number;
  timestamp: number;
  eventSource: string;
  isPinching: boolean;
  pointerCount: number;
  scale: number;
  translateX: number;
  translateY: number;
  pinchCenterX: number | null;
  pinchCenterY: number | null;
  transformOrigin: string;
  matrix: string;
}

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
  
  // ピンチ中フラグ（stateとして管理して再レンダリングを制御）
  const [isPinching, setIsPinching] = useState<boolean>(false);
  
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartMatrixRef = useRef<DOMMatrix | null>(null); // ピンチ開始時の基準行列（baseMatrix）
  const pinchStartCenterLocalRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の基準中心位置（basePinchCenter）
  const zoomLayerRectRef = useRef<DOMRect | null>(null); // ピンチ開始時のCanvasZoomLayerのrect（レイアウト変更を防ぐため）
  
  // フレーム単位ログ用のref
  const frameIdRef = useRef<number>(0);
  const currentEventSourceRef = useRef<string>("none");
  const animationFrameIdRef = useRef<number | null>(null);
  const pointerCountRef = useRef<number>(0);

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
      
      // ピンチ中心をCanvasZoomLayerのローカル座標に変換（キャッシュされたrectを使用）
      const centerXLocal = centerXViewport - zoomLayerRectRef.current.left;
      const centerYLocal = centerYViewport - zoomLayerRectRef.current.top;

      // ピンチ中フラグを設定
      setIsPinching(true);
      pointerCountRef.current = 2;
      currentEventSourceRef.current = "pinch-start";
      
      // ピンチ開始時の基準値を記録（baseMatrix, baseScaleDistance, basePinchCenter）
      const currentMatrix = transformMatrix;
      // DOMMatrixをコピー（各要素を個別に設定）
      pinchStartMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]); // baseMatrix
      pinchStartDistanceRef.current = distance; // baseScaleDistance
      pinchStartCenterLocalRef.current = { x: centerXLocal, y: centerYLocal }; // basePinchCenter

      const scale = Math.sqrt(currentMatrix.a * currentMatrix.a + currentMatrix.b * currentMatrix.b);
      const translateX = currentMatrix.e;
      const translateY = currentMatrix.f;
      
      console.log("[PinchStart] scale:", scale, "translate:", { x: translateX, y: translateY });
      console.log("[PinchStart] pinch center (local):", { x: centerXLocal, y: centerYLocal });
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
      if (!isPinching) {
        console.log("[PinchMove] isPinching is false, skipping");
        return;
      }
      
      if (pinchStartDistanceRef.current === null || pinchStartCenterLocalRef.current === null || pinchStartMatrixRef.current === null) {
        return;
      }

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // 現在の2点の中点を取得（ビューポート座標系）
      const currentCenterXViewport = (touch1.clientX + touch2.clientX) / 2;
      const currentCenterYViewport = (touch1.clientY + touch2.clientY) / 2;

      // スケール比を計算（scaleRatio）
      const scaleRatio = currentDistance / pinchStartDistanceRef.current;

      // スケール比が1.0に近い場合は行列を更新しない（必須のガード処理）
      if (Math.abs(scaleRatio - 1) <= SCALE_EPSILON) {
        return;
      }

      if (!canvasZoomLayerRef?.current || !zoomLayerRectRef.current) {
        return;
      }

      // 現在のピンチ中心をCanvasZoomLayerのローカル座標に変換（キャッシュされたrectを使用）
      // 重要: getBoundingClientRect()を呼ばず、ピンチ開始時にキャッシュしたrectを使用
      // これにより、レイアウト変更（useScrollPreventionなど）による影響を防ぐ
      const currentCenterXLocal = currentCenterXViewport - zoomLayerRectRef.current.left;
      const currentCenterYLocal = currentCenterYViewport - zoomLayerRectRef.current.top;

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
      
      console.log("[PinchMove] scale:", scale, "translate:", { x: translateX, y: translateY }, "scaleRatio:", scaleRatio.toFixed(3));
      
      // eventSourceを設定してからtransformMatrixを更新
      currentEventSourceRef.current = "pinch-move";
      setTransformMatrix(newMatrix);
    },
    [canvasZoomLayerRef, isPinching, transformMatrix]
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
    console.log("[PinchEnd] scale:", scale, "translate:", { x: translateX, y: translateY });
    console.log("[PinchEnd] Matrix updated: false (no-op)");
    
    // eventSourceを設定（transformMatrixは更新しないが、ログには記録）
    currentEventSourceRef.current = "pinch-end";
    pointerCountRef.current = 0;
    
    // ピンチ中フラグを解除（stateを更新するが、transformMatrixは変更しない）
    setIsPinching(false);
    
    // ピンチ開始時の記録をクリア
    pinchStartDistanceRef.current = null;
    pinchStartMatrixRef.current = null;
    pinchStartCenterLocalRef.current = null;
    zoomLayerRectRef.current = null;
    
    // 重要: transformMatrixは一切更新しない
    // setTransformMatrix()を呼ばない
    // CSS transformを再適用しない
    // translate/clamp/normalize処理を行わない
    
    // 次のフレームでeventSourceをリセット
    requestAnimationFrame(() => {
      currentEventSourceRef.current = "none";
    });
    
    console.log("[PinchEnd] =====================");
  }, [transformMatrix]);

  // transform行列をCSSのmatrix()形式に変換（useMemoでメモ化して再計算を防ぐ）
  const transformString = useMemo(() => {
    return `matrix(${transformMatrix.a}, ${transformMatrix.b}, ${transformMatrix.c}, ${transformMatrix.d}, ${transformMatrix.e}, ${transformMatrix.f})`;
  }, [transformMatrix.a, transformMatrix.b, transformMatrix.c, transformMatrix.d, transformMatrix.e, transformMatrix.f]);

  // ピンチ終了後のログ出力を制限するためのref
  const pinchEndLogCountRef = useRef<number>(0);
  const MAX_PINCH_END_LOGS = 3; // ピンチ終了後、最大3フレームまでログ出力

  // フレーム単位ログ出力関数
  // 重要: ピンチ操作中またはピンチ終了直後の数フレームのみログ出力
  const logFrame = useCallback(() => {
    const eventSource = currentEventSourceRef.current;
    
    // ログを出力する条件:
    // 1. ピンチ中（isPinching === true）
    // 2. ピンチ関連のイベント（pinch-start, pinch-move, pinch-end）
    // 3. ピンチ終了直後の数フレームのみ（touch-end-after-pinchは最初の数フレームのみ）
    let shouldLog = false;
    
    if (isPinching) {
      // ピンチ中は常にログ出力
      shouldLog = true;
      pinchEndLogCountRef.current = 0; // リセット
    } else if (eventSource === "pinch-start" || eventSource === "pinch-move" || eventSource === "pinch-end") {
      // ピンチ関連イベントは常にログ出力
      shouldLog = true;
      pinchEndLogCountRef.current = 0; // リセット
    } else if (eventSource === "touch-end-after-pinch") {
      // ピンチ終了直後の数フレームのみログ出力
      if (pinchEndLogCountRef.current < MAX_PINCH_END_LOGS) {
        shouldLog = true;
        pinchEndLogCountRef.current++;
      } else {
        // 最大フレーム数に達したらeventSourceをリセット
        currentEventSourceRef.current = "none";
        shouldLog = false;
      }
    } else if (eventSource === "touch-end" && isPinching === false) {
      // touch-endはピンチ終了時のみ（1フレームのみ）
      shouldLog = true;
      // 次のフレームでeventSourceをリセット
      requestAnimationFrame(() => {
        currentEventSourceRef.current = "none";
      });
    }
    
    if (shouldLog) {
      const scale = Math.sqrt(transformMatrix.a * transformMatrix.a + transformMatrix.b * transformMatrix.b);
      const translateX = transformMatrix.e;
      const translateY = transformMatrix.f;
      
      const log: FrameLog = {
        frameId: frameIdRef.current++,
        timestamp: performance.now(),
        eventSource: eventSource,
        isPinching: isPinching,
        pointerCount: pointerCountRef.current,
        scale: scale,
        translateX: translateX,
        translateY: translateY,
        pinchCenterX: pinchStartCenterLocalRef.current?.x ?? null,
        pinchCenterY: pinchStartCenterLocalRef.current?.y ?? null,
        transformOrigin: transformOrigin,
        matrix: transformString,
      };
      
      console.log(`[Frame ${log.frameId}]`, log);
    } else {
      // ログを出力しない場合でもフレームIDはインクリメント（連続性を保つ）
      frameIdRef.current++;
    }
    
    // 次のフレームでログを出力
    animationFrameIdRef.current = requestAnimationFrame(logFrame);
  }, [transformMatrix, isPinching, transformOrigin, transformString]);

  // フレーム単位ログの開始
  useEffect(() => {
    // 初回フレームでログを開始
    animationFrameIdRef.current = requestAnimationFrame(logFrame);
    
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [logFrame]);

  // デバッグ: transformStringが再計算されるたびにログ出力
  // 重要: ピンチ操作中またはピンチ終了直後のみログ出力
  useEffect(() => {
    // ピンチ操作中またはピンチ終了直後のみログ出力
    if (!isPinching && currentEventSourceRef.current !== "pinch-end" && currentEventSourceRef.current !== "touch-end-after-pinch") {
      return;
    }
    
    const scale = Math.sqrt(transformMatrix.a * transformMatrix.a + transformMatrix.b * transformMatrix.b);
    const translateX = transformMatrix.e;
    const translateY = transformMatrix.f;
    
    console.log("[TransformString] ===== transformString再計算 =====");
    console.log("[TransformString] Event: render/re-render");
    console.log("[TransformString] isPinching:", isPinching);
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
  }, [transformMatrix, transformString, isPinching]);

  // 外部からeventSourceを設定する関数（ページ側のイベントハンドラで使用）
  const setEventSource = useCallback((source: string) => {
    currentEventSourceRef.current = source;
  }, []);

  // 外部からpointerCountを設定する関数（ページ側のイベントハンドラで使用）
  const setPointerCount = useCallback((count: number) => {
    pointerCountRef.current = count;
  }, []);

  return {
    transformString,
    transformOrigin,
    isPinching,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    setEventSource,
    setPointerCount,
  };
}
