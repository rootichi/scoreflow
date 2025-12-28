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
  
  // transformStringをrefで管理（ピンチ中はReactのrender/re-renderで再計算されないようにする）
  const transformStringRef = useRef<string>("matrix(1, 0, 0, 1, 0, 0)");
  
  // transformMatrixの最新値をrefで保持（ピンチ中にDOMに直接適用するため）
  const transformMatrixRef = useRef<DOMMatrix>(new DOMMatrix());
  
  // 前フレームのtransformMatrixを保持（変化検出用）
  const prevTransformMatrixRef = useRef<DOMMatrix>(new DOMMatrix());
  
  // eventSourceが設定されたフレームを記録（1フレームのみログ出力するため）
  const eventSourceFrameRef = useRef<number>(-1);

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
      
      // eventSourceを設定（次のフレームでログ出力）
      currentEventSourceRef.current = "pinch-start";
      eventSourceFrameRef.current = frameIdRef.current + 1;
      
      // ピンチ開始時の基準値を記録（baseMatrix, baseScaleDistance, basePinchCenter）
      // 重要: ピンチ中はrefから取得、ピンチ中でない場合はstateから取得
      const currentMatrix = isPinching ? transformMatrixRef.current : transformMatrix;
      // DOMMatrixをコピー（各要素を個別に設定）
      pinchStartMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]); // baseMatrix
      
      // transformMatrixRefも更新（ピンチ開始時の状態を保持）
      transformMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]);
      pinchStartDistanceRef.current = distance; // baseScaleDistance
      pinchStartCenterLocalRef.current = { x: centerXLocal, y: centerYLocal }; // basePinchCenter
    },
    [transformMatrix, canvasZoomLayerRef, isPinching]
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

      // 重要: ピンチ中心は「現在のtransformを逆変換した座標（world座標）」を使用する
      // ピンチ中心（local座標）はtransform適用後の見た目上の座標であるため、
      // DOMMatrixによる行列合成（未変換のローカル座標系を前提）と座標系が一致していない
      // 
      // 解決策: baseMatrixのinverseを使って、ピンチ中心をworld座標に変換
      const inverseMatrix = pinchStartMatrixRef.current.inverse();
      const worldPoint = new DOMPoint(currentCenterXLocal, currentCenterYLocal).matrixTransform(inverseMatrix);
      
      const cx = worldPoint.x; // world座標系のピンチ中心
      const cy = worldPoint.y; // world座標系のピンチ中心
      
      // 正しい実装: baseMatrixをコピーしてから、T(cx, cy) * S(scaleRatio) * T(-cx, -cy) を適用
      // DOMMatrixのメソッドチェーンは左から右に適用される
      // newMatrix = baseMatrix * T(cx, cy) * S(scaleRatio) * T(-cx, -cy)
      // 
      // しかし、数学的には T(cx, cy) * S(scaleRatio) * T(-cx, -cy) * baseMatrix と等価
      // なぜなら、行列の結合則により:
      // baseMatrix * T(cx, cy) * S(scaleRatio) * T(-cx, -cy)
      // = [T(cx, cy) * S(scaleRatio) * T(-cx, -cy)] * baseMatrix
      // 
      // 正しい実装: baseMatrixをコピーしてから、T(cx, cy) * S(scaleRatio) * T(-cx, -cy) を適用
      // 1. baseMatrixをコピー（変更しない）
      // 2. T(cx, cy) を適用: baseMatrix * T(cx, cy)
      // 3. S(scaleRatio) を適用: baseMatrix * T(cx, cy) * S(scaleRatio)
      // 4. T(-cx, -cy) を適用: baseMatrix * T(cx, cy) * S(scaleRatio) * T(-cx, -cy)
      const newMatrix = new DOMMatrix([
        pinchStartMatrixRef.current.a,
        pinchStartMatrixRef.current.b,
        pinchStartMatrixRef.current.c,
        pinchStartMatrixRef.current.d,
        pinchStartMatrixRef.current.e,
        pinchStartMatrixRef.current.f,
      ])
        .translate(cx, cy)
        .scale(scaleRatio, scaleRatio)
        .translate(-cx, -cy);
      
      // デバッグ: ピンチ中心の座標変換と行列合成を確認
      console.log("[PinchMove] Matrix composition debug:", {
        scaleRatio: scaleRatio.toFixed(6),
        pinchType: scaleRatio > 1 ? "OUT" : "IN",
        pinchCenterScreen: {
          x: currentCenterXLocal.toFixed(2),
          y: currentCenterYLocal.toFixed(2),
        },
        pinchCenterWorld: {
          x: cx.toFixed(2),
          y: cy.toFixed(2),
        },
        currentMatrix: {
          a: pinchStartMatrixRef.current.a.toFixed(4),
          b: pinchStartMatrixRef.current.b.toFixed(4),
          c: pinchStartMatrixRef.current.c.toFixed(4),
          d: pinchStartMatrixRef.current.d.toFixed(4),
          e: pinchStartMatrixRef.current.e.toFixed(4),
          f: pinchStartMatrixRef.current.f.toFixed(4),
        },
        inverseMatrix: {
          a: inverseMatrix.a.toFixed(4),
          b: inverseMatrix.b.toFixed(4),
          c: inverseMatrix.c.toFixed(4),
          d: inverseMatrix.d.toFixed(4),
          e: inverseMatrix.e.toFixed(4),
          f: inverseMatrix.f.toFixed(4),
        },
        nextMatrix: {
          a: newMatrix.a.toFixed(4),
          b: newMatrix.b.toFixed(4),
          c: newMatrix.c.toFixed(4),
          d: newMatrix.d.toFixed(4),
          e: newMatrix.e.toFixed(4),
          f: newMatrix.f.toFixed(4),
        },
      });
      
      // eventSourceを設定（transformMatrixを更新したフレームのみ）
      currentEventSourceRef.current = "pinch-move";
      
      // transformMatrixRefを更新（ピンチ中はrefで管理）
      transformMatrixRef.current = new DOMMatrix([
        newMatrix.a, newMatrix.b,
        newMatrix.c, newMatrix.d,
        newMatrix.e, newMatrix.f
      ]);
      
      // transformStringを直接計算してrefに保存（Reactのrender/re-renderを経由しない）
      const newTransformString = `matrix(${newMatrix.a}, ${newMatrix.b}, ${newMatrix.c}, ${newMatrix.d}, ${newMatrix.e}, ${newMatrix.f})`;
      transformStringRef.current = newTransformString;
      
      // DOMに直接適用（Reactのrender/re-renderを経由しない）
      if (canvasZoomLayerRef?.current) {
        canvasZoomLayerRef.current.style.transform = newTransformString;
        canvasZoomLayerRef.current.style.transformOrigin = transformOrigin;
      }
      
      // stateも更新（ピンチ終了後のrender用、ただしピンチ中は使用しない）
      setTransformMatrix(newMatrix);
    },
    [canvasZoomLayerRef, isPinching]
  );

  /**
   * ピンチ終了
   * 
   * 何も変更しない（行列がそのまま残る）
   * transformMatrixを一切更新しない、再適用しない、正規化しない
   */
  const handlePinchEnd = useCallback(() => {
    // 重要: ピンチ終了時はrefから最新の値を取得（pinch-moveの最終フレームで確定した値）
    const finalMatrix = transformMatrixRef.current;
    
    // eventSourceを設定（次のフレームでログ出力）
    currentEventSourceRef.current = "pinch-end";
    eventSourceFrameRef.current = frameIdRef.current + 1;
    pointerCountRef.current = 0;
    
    // ピンチ中フラグを解除（stateを更新するが、transformMatrixは変更しない）
    setIsPinching(false);
    
    // 重要: ピンチ終了時は、refからstateに同期（ピンチ終了後のrender用）
    // ただし、DOMには既に適用済みなので、再適用は不要
    setTransformMatrix(new DOMMatrix([
      finalMatrix.a, finalMatrix.b,
      finalMatrix.c, finalMatrix.d,
      finalMatrix.e, finalMatrix.f
    ]));
    
    // ピンチ開始時の記録をクリア
    pinchStartDistanceRef.current = null;
    pinchStartMatrixRef.current = null;
    pinchStartCenterLocalRef.current = null;
    zoomLayerRectRef.current = null;
    
    // 重要: DOMへの再適用は不要（既にpinch-moveで適用済み）
    // CSS transformを再適用しない
    // translate/clamp/normalize処理を行わない
    
    // 次のフレームでeventSourceをリセット
    requestAnimationFrame(() => {
      currentEventSourceRef.current = "none";
      eventSourceFrameRef.current = -1;
    });
  }, []);

  // transform行列をCSSのmatrix()形式に変換
  // 重要: ピンチ中はReactのrender/re-renderで再計算されないように、refから取得
  // ピンチ中でない場合のみ、stateから計算（初期化時やピンチ終了後のrender用）
  const transformString = useMemo(() => {
    // ピンチ中はrefから取得（Reactのrender/re-renderを経由しない）
    if (isPinching) {
      return transformStringRef.current;
    }
    // ピンチ中でない場合はstateから計算（初期化時やピンチ終了後のrender用）
    return `matrix(${transformMatrix.a}, ${transformMatrix.b}, ${transformMatrix.c}, ${transformMatrix.d}, ${transformMatrix.e}, ${transformMatrix.f})`;
  }, [transformMatrix.a, transformMatrix.b, transformMatrix.c, transformMatrix.d, transformMatrix.e, transformMatrix.f, isPinching]);

  // フレーム単位ログ出力関数
  // 重要: transformMatrixが更新されたフレーム、pinch-start/pinch-endが発火したフレーム、scale/translateが変化したフレームのみログ出力
  const logFrame = useCallback(() => {
    const currentFrameId = frameIdRef.current++;
    const eventSource = currentEventSourceRef.current;
    
    // 重要: ピンチ中はrefから取得、ピンチ中でない場合はstateから取得
    const currentMatrix = isPinching ? transformMatrixRef.current : transformMatrix;
    const scale = Math.sqrt(currentMatrix.a * currentMatrix.a + currentMatrix.b * currentMatrix.b);
    const translateX = currentMatrix.e;
    const translateY = currentMatrix.f;
    
    // 前フレームとの比較（変化検出用）
    const prevScale = Math.sqrt(prevTransformMatrixRef.current.a * prevTransformMatrixRef.current.a + prevTransformMatrixRef.current.b * prevTransformMatrixRef.current.b);
    const prevTranslateX = prevTransformMatrixRef.current.e;
    const prevTranslateY = prevTransformMatrixRef.current.f;
    
    // ログを出力する条件:
    // 1. pinch-start / pinch-endが発火したフレーム（1フレームのみ）
    // 2. pinch-moveでtransformMatrixを更新したフレーム
    // 3. scaleまたはtranslateX/translateYが前フレームから変化したフレーム
    let shouldLog = false;
    
    // pinch-start / pinch-endが発火したフレーム（1フレームのみ）
    if (eventSource === "pinch-start" || eventSource === "pinch-end") {
      if (eventSourceFrameRef.current === currentFrameId) {
        shouldLog = true;
      }
    }
    // pinch-moveでtransformMatrixを更新したフレーム
    else if (eventSource === "pinch-move") {
      shouldLog = true;
    }
    // scaleまたはtranslateX/translateYが前フレームから変化したフレーム
    else if (
      Math.abs(scale - prevScale) > SCALE_EPSILON ||
      Math.abs(translateX - prevTranslateX) > 0.001 ||
      Math.abs(translateY - prevTranslateY) > 0.001
    ) {
      shouldLog = true;
    }
    
    if (shouldLog) {
      const currentTransformString = isPinching ? transformStringRef.current : transformString;
      
      const log: FrameLog = {
        frameId: currentFrameId,
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
        matrix: currentTransformString,
      };
      
      console.log(`[Frame ${log.frameId}]`, log);
      
      // 前フレームのtransformMatrixを更新
      prevTransformMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]);
    }
    
    // eventSourceをリセット（pinch-start/pinch-endは1フレームのみ）
    if (eventSource === "pinch-start" || eventSource === "pinch-end") {
      if (eventSourceFrameRef.current === currentFrameId) {
        // 次のフレームでeventSourceをリセット
        requestAnimationFrame(() => {
          if (currentEventSourceRef.current === eventSource) {
            currentEventSourceRef.current = "none";
            eventSourceFrameRef.current = -1;
          }
        });
      }
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

  
  // 初期化時とピンチ終了後に、refとstateを同期
  useEffect(() => {
    // ピンチ中は何もしない（pinch-moveで直接DOMに適用済み）
    if (isPinching) {
      return;
    }
    
    // ピンチ中でない場合のみ、stateからrefに同期（初期化時やピンチ終了後のrender用）
    transformMatrixRef.current = new DOMMatrix([
      transformMatrix.a, transformMatrix.b,
      transformMatrix.c, transformMatrix.d,
      transformMatrix.e, transformMatrix.f
    ]);
    
    transformStringRef.current = `matrix(${transformMatrix.a}, ${transformMatrix.b}, ${transformMatrix.c}, ${transformMatrix.d}, ${transformMatrix.e}, ${transformMatrix.f})`;
    
    // prevTransformMatrixRefも同期（初期化時やピンチ終了後のrender用）
    prevTransformMatrixRef.current = new DOMMatrix([
      transformMatrix.a, transformMatrix.b,
      transformMatrix.c, transformMatrix.d,
      transformMatrix.e, transformMatrix.f
    ]);
  }, [transformMatrix, isPinching]);

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
