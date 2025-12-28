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
  const pinchStartMatrixInverseRef = useRef<DOMMatrix | null>(null); // ピンチ開始時の基準行列のinverse（world座標変換用）
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
      
      // 重要: pinchStartMatrixのinverseを計算して保存（world座標変換用）
      // ピンチ移動時は必ずこの保存されたinverseを使用する
      pinchStartMatrixInverseRef.current = pinchStartMatrixRef.current.inverse();
      
      // transformMatrixRefも更新（ピンチ開始時の状態を保持）
      transformMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]);
      pinchStartDistanceRef.current = distance; // baseScaleDistance
      pinchStartCenterLocalRef.current = { x: centerXLocal, y: centerYLocal }; // basePinchCenter
      
      // デバッグ: ピンチ開始時の状態を記録
      const isIdentity = 
        Math.abs(pinchStartMatrixRef.current.a - 1) < 0.0001 &&
        Math.abs(pinchStartMatrixRef.current.b) < 0.0001 &&
        Math.abs(pinchStartMatrixRef.current.c) < 0.0001 &&
        Math.abs(pinchStartMatrixRef.current.d - 1) < 0.0001 &&
        Math.abs(pinchStartMatrixRef.current.e) < 0.0001 &&
        Math.abs(pinchStartMatrixRef.current.f) < 0.0001;
      
      // デバッグ用: world座標も計算（比較用）
      const worldPointDebug = new DOMPoint(centerXLocal, centerYLocal).matrixTransform(pinchStartMatrixInverseRef.current);
      
      // 重要: pinchCenterScreenをstartMatrixで変換した座標（不動点条件の検証用）
      const pinchCenterTransformed = new DOMPoint(centerXLocal, centerYLocal).matrixTransform(pinchStartMatrixRef.current);
      
      console.log("[PinchStart] ===== ピンチ開始 =====", {
        pinchCenterScreen: {
          x: centerXLocal.toFixed(2),
          y: centerYLocal.toFixed(2),
        },
        pinchCenterScreen_変換後: {
          x: pinchCenterTransformed.x.toFixed(4),
          y: pinchCenterTransformed.y.toFixed(4),
        },
        pinchCenterWorld_参考: {
          x: worldPointDebug.x.toFixed(2),
          y: worldPointDebug.y.toFixed(2),
        },
        使用座標系: "screen座標（不動点条件を満たす実装）",
        pinchStartMatrix: {
          a: pinchStartMatrixRef.current.a.toFixed(4),
          b: pinchStartMatrixRef.current.b.toFixed(4),
          c: pinchStartMatrixRef.current.c.toFixed(4),
          d: pinchStartMatrixRef.current.d.toFixed(4),
          e: pinchStartMatrixRef.current.e.toFixed(4),
          f: pinchStartMatrixRef.current.f.toFixed(4),
        },
        isIdentity: isIdentity,
        initialDistance: distance.toFixed(2),
      });
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
      
      if (pinchStartDistanceRef.current === null || pinchStartCenterLocalRef.current === null || pinchStartMatrixRef.current === null || pinchStartMatrixInverseRef.current === null) {
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

      // 重要: 不動点条件を満たす実装
      // 「pinchCenterScreenをstartMatrixで変換した座標」を基準にスケーリングを行う
      // これにより、pinchCenterScreenをstartMatrixで変換した座標と、
      // pinchCenterScreenをfinalMatrixで変換した座標が一致する（不動点条件）
      // 
      // 数学的には:
      // P_start = pinchCenterScreen * startMatrix
      // P_final = pinchCenterScreen * finalMatrix
      // P_final = P_start * scaleRatio
      // 
      // これを満たすには:
      // finalMatrix = startMatrix * T(P_start.x, P_start.y) * S(scaleRatio) * T(-P_start.x, -P_start.y)
      const cx = currentCenterXLocal; // screen座標
      const cy = currentCenterYLocal; // screen座標
      
      // pinchCenterScreenをstartMatrixで変換した座標を取得
      const pinchCenterTransformed = new DOMPoint(cx, cy).matrixTransform(pinchStartMatrixRef.current);
      const transformedX = pinchCenterTransformed.x;
      const transformedY = pinchCenterTransformed.y;
      
      // 変換後の座標を基準にスケーリング
      // finalMatrix = startMatrix * T(transformedX, transformedY) * S(scaleRatio) * T(-transformedX, -transformedY)
      const newMatrix = new DOMMatrix([
        pinchStartMatrixRef.current.a,
        pinchStartMatrixRef.current.b,
        pinchStartMatrixRef.current.c,
        pinchStartMatrixRef.current.d,
        pinchStartMatrixRef.current.e,
        pinchStartMatrixRef.current.f,
      ])
        .translate(transformedX, transformedY)
        .scale(scaleRatio, scaleRatio)
        .translate(-transformedX, -transformedY);
      
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
    
    // デバッグ: ピンチ終了時の状態を記録
    // ピンチ開始時の値と比較するため、クリアする前に記録
    const startMatrix = pinchStartMatrixRef.current;
    const startInverse = pinchStartMatrixInverseRef.current;
    const startCenter = pinchStartCenterLocalRef.current;
    
    if (startMatrix && startInverse && startCenter) {
      // 最終的なスケール比を計算（開始時の距離と終了時の距離の比）
      // ただし、終了時には距離が取得できないため、行列からスケールを計算
      const startScale = Math.sqrt(startMatrix.a * startMatrix.a + startMatrix.b * startMatrix.b);
      const finalScale = Math.sqrt(finalMatrix.a * finalMatrix.a + finalMatrix.b * finalMatrix.b);
      const scaleRatio = finalScale / startScale;
      
      // 重要: 不動点条件を満たす実装に基づく理論値計算
      // pinchCenterScreenをstartMatrixで変換した座標を基準にスケーリング
      const cx = startCenter.x; // screen座標
      const cy = startCenter.y; // screen座標
      
      // pinchCenterScreenをstartMatrixで変換した座標
      const pinchCenterTransformed = new DOMPoint(cx, cy).matrixTransform(startMatrix);
      const transformedX = pinchCenterTransformed.x;
      const transformedY = pinchCenterTransformed.y;
      
      // 理論値の計算
      // 行列合成: startMatrix * T(transformedX, transformedY) * S(scaleRatio) * T(-transformedX, -transformedY)
      // 
      // この実装により、pinchCenterScreenをstartMatrixで変換した座標と、
      // pinchCenterScreenをfinalMatrixで変換した座標が一致する（不動点条件）
      const isIdentity = 
        Math.abs(startMatrix.a - 1) < 0.0001 &&
        Math.abs(startMatrix.b) < 0.0001 &&
        Math.abs(startMatrix.c) < 0.0001 &&
        Math.abs(startMatrix.d - 1) < 0.0001 &&
        Math.abs(startMatrix.e) < 0.0001 &&
        Math.abs(startMatrix.f) < 0.0001;
      
      // 理論値の計算（不動点条件を満たす実装に基づく）
      // finalMatrix = startMatrix * T(transformedX, transformedY) * S(scaleRatio) * T(-transformedX, -transformedY)
      // これを展開すると:
      // finalMatrix.e = startMatrix.e + transformedX * (1 - scaleRatio) * startScale
      // finalMatrix.f = startMatrix.f + transformedY * (1 - scaleRatio) * startScale
      let expectedTx: number;
      let expectedTy: number;
      
      if (isIdentity) {
        // identity行列の場合: transformedX = cx, transformedY = cy
        expectedTx = transformedX * (1 - scaleRatio);
        expectedTy = transformedY * (1 - scaleRatio);
      } else {
        // baseMatrixが既にスケール/トランスレートされている場合
        const baseTx = startMatrix.e;
        const baseTy = startMatrix.f;
        expectedTx = baseTx + transformedX * (1 - scaleRatio) * startScale;
        expectedTy = baseTy + transformedY * (1 - scaleRatio) * startScale;
      }
      
      // デバッグ用: world座標も計算（比較用）
      const worldPoint = new DOMPoint(startCenter.x, startCenter.y).matrixTransform(startInverse);
      
      // 重要: 不動点条件の検証
      // pinchCenterScreenをstartMatrixで変換した座標
      const pinchCenterStart = new DOMPoint(startCenter.x, startCenter.y).matrixTransform(startMatrix);
      // pinchCenterScreenをfinalMatrixで変換した座標
      const pinchCenterFinal = new DOMPoint(startCenter.x, startCenter.y).matrixTransform(finalMatrix);
      // 期待値: pinchCenterStart * scaleRatio
      const pinchCenterExpected = new DOMPoint(
        pinchCenterStart.x * scaleRatio,
        pinchCenterStart.y * scaleRatio
      );
      // 差分
      const pinchCenterDiff = {
        x: pinchCenterFinal.x - pinchCenterExpected.x,
        y: pinchCenterFinal.y - pinchCenterExpected.y,
      };
      // 距離の差分（不動点条件の満足度）
      const pinchCenterDistance = Math.sqrt(
        pinchCenterDiff.x * pinchCenterDiff.x + pinchCenterDiff.y * pinchCenterDiff.y
      );
      
      const actualTx = finalMatrix.e;
      const actualTy = finalMatrix.f;
      const diffTx = actualTx - expectedTx;
      const diffTy = actualTy - expectedTy;
      
      // ログを詳細に出力（数値を展開して確認できるように）
      console.log("[PinchEnd] ===== ピンチ終了 =====");
      console.log("[PinchEnd] scaleRatio:", scaleRatio.toFixed(6));
      console.log("[PinchEnd] pinchType:", scaleRatio > 1 ? "OUT" : "IN");
      console.log("[PinchEnd] isIdentity:", isIdentity);
      console.log("[PinchEnd] pinchCenterScreen:", { x: startCenter.x.toFixed(2), y: startCenter.y.toFixed(2) });
      console.log("[PinchEnd] pinchCenterWorld (参考):", { x: worldPoint.x.toFixed(2), y: worldPoint.y.toFixed(2) });
      console.log("[PinchEnd] 使用座標系: screen座標（world変換なし）");
      console.log("[PinchEnd] startMatrix:", {
        a: startMatrix.a.toFixed(4),
        b: startMatrix.b.toFixed(4),
        c: startMatrix.c.toFixed(4),
        d: startMatrix.d.toFixed(4),
        e: startMatrix.e.toFixed(4),
        f: startMatrix.f.toFixed(4),
      });
      console.log("[PinchEnd] finalMatrix:", {
        a: finalMatrix.a.toFixed(4),
        b: finalMatrix.b.toFixed(4),
        c: finalMatrix.c.toFixed(4),
        d: finalMatrix.d.toFixed(4),
        e: finalMatrix.e.toFixed(4),
        f: finalMatrix.f.toFixed(4),
      });
      console.log("[PinchEnd] expectedTranslate:", { x: expectedTx.toFixed(4), y: expectedTy.toFixed(4) });
      console.log("[PinchEnd] actualTranslate:", { x: actualTx.toFixed(4), y: actualTy.toFixed(4) });
      console.log("[PinchEnd] diffTranslate:", { x: diffTx.toFixed(4), y: diffTy.toFixed(4) });
      console.log("[PinchEnd] === 不動点条件の検証 ===");
      console.log("[PinchEnd] pinchCenterScreenをstartMatrixで変換:", {
        x: pinchCenterStart.x.toFixed(4),
        y: pinchCenterStart.y.toFixed(4),
      });
      console.log("[PinchEnd] pinchCenterScreenをfinalMatrixで変換:", {
        x: pinchCenterFinal.x.toFixed(4),
        y: pinchCenterFinal.y.toFixed(4),
      });
      console.log("[PinchEnd] 期待値 (startMatrix変換 * scaleRatio):", {
        x: pinchCenterExpected.x.toFixed(4),
        y: pinchCenterExpected.y.toFixed(4),
      });
      console.log("[PinchEnd] 差分:", {
        x: pinchCenterDiff.x.toFixed(4),
        y: pinchCenterDiff.y.toFixed(4),
        distance: pinchCenterDistance.toFixed(4),
      });
      console.log("[PinchEnd] 不動点条件:", pinchCenterDistance < 0.1 ? "✓ 満足" : "✗ 不満足");
      console.log("[PinchEnd] =====================");
    }
    
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
    pinchStartMatrixInverseRef.current = null;
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
    // 重要: pinch-move中のログは出力しない（ログが多すぎるため）
    // 重要: scale/translateの変化検出も無効化（ピンチ中は不要）
    let shouldLog = false;
    
    // pinch-start / pinch-endが発火したフレーム（1フレームのみ）
    if (eventSource === "pinch-start" || eventSource === "pinch-end") {
      if (eventSourceFrameRef.current === currentFrameId) {
        shouldLog = true;
      }
    }
    // ピンチ中でない場合のみ、scale/translateの変化を検出
    // ピンチ中はpinch-start/pinch-endのみログを出力
    else if (!isPinching && (
      Math.abs(scale - prevScale) > SCALE_EPSILON ||
      Math.abs(translateX - prevTranslateX) > 0.001 ||
      Math.abs(translateY - prevTranslateY) > 0.001
    )) {
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
