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
  const pinchStartMatrixRef = useRef<DOMMatrix | null>(null); // ピンチ開始時の基準行列（M_old）
  const pinchStartCenterScreenRef = useRef<{ x: number; y: number } | null>(null); // ピンチ開始時の中心位置（screen座標）
  const zoomLayerRectRef = useRef<DOMRect | null>(null); // ピンチ開始時のCanvasZoomLayerのrect（local座標変換用）
  
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

  // デバッグログをファイルに記録するためのref
  const debugLogRef = useRef<Array<{
    timestamp: number;
    event: string;
    data: any;
  }>>([]);

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

      // 2点の中点を取得（screen座標 = ビューポート座標系）
      // 重要: pivot は常に screen 座標で固定し、変換しない
      const centerXScreen = (touch1.clientX + touch2.clientX) / 2;
      const centerYScreen = (touch1.clientY + touch2.clientY) / 2;
      
      // デバッグ用: 画像の実際のサイズを取得
      const imgElement = canvasZoomLayerRef.current.querySelector("img");
      const imageNaturalSize = imgElement ? {
        width: imgElement.naturalWidth,
        height: imgElement.naturalHeight,
      } : null;
      const imageDisplaySize = imgElement ? {
        width: imgElement.offsetWidth,
        height: imgElement.offsetHeight,
      } : null;
      
      // デバッグ用: ヘッダーの高さを取得
      const headerElement = document.querySelector("nav, header");
      const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : 0;
      
      // デバッグ用: ビューポートのサイズを取得
      const viewportSize = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      
      // デバッグ用: スクロール位置を取得
      const scrollPosition = {
        x: window.scrollX,
        y: window.scrollY,
      };
      
      // 重要: CanvasZoomLayerの位置とサイズを取得（local座標変換用）
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

      // ピンチ中フラグを設定
      setIsPinching(true);
      pointerCountRef.current = 2;
      
      // eventSourceを設定（次のフレームでログ出力）
      currentEventSourceRef.current = "pinch-start";
      eventSourceFrameRef.current = frameIdRef.current + 1;
      
      // ピンチ開始時の基準値を記録
      // 重要: ピンチ中はrefから取得、ピンチ中でない場合はstateから取得
      const currentMatrix = isPinching ? transformMatrixRef.current : transformMatrix;
      // DOMMatrixをコピー（M_old）
      pinchStartMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]);
      
      // transformMatrixRefも更新（ピンチ開始時の状態を保持）
      transformMatrixRef.current = new DOMMatrix([
        currentMatrix.a, currentMatrix.b,
        currentMatrix.c, currentMatrix.d,
        currentMatrix.e, currentMatrix.f
      ]);
      
      // 重要: pivot は screen 座標で取得・保持
      // DOMMatrixに渡す前にlocal座標に変換する
      pinchStartDistanceRef.current = distance;
      pinchStartCenterScreenRef.current = { x: centerXScreen, y: centerYScreen };
      
      // デバッグ情報を構築
      const debugInfo = {
        timestamp: performance.now(),
        event: "pinch-start",
        data: {
          pinchStartCenter: {
            screen: { x: centerXScreen, y: centerYScreen },
          },
          zoomLayerRect: {
            left: zoomLayerRect.left,
            top: zoomLayerRect.top,
            width: zoomLayerRect.width,
            height: zoomLayerRect.height,
            right: zoomLayerRect.right,
            bottom: zoomLayerRect.bottom,
            x: zoomLayerRect.x,
            y: zoomLayerRect.y,
          },
          imageSize: {
            natural: imageNaturalSize,
            display: imageDisplaySize,
          },
          headerHeight: headerHeight,
          viewportSize: viewportSize,
          scrollPosition: scrollPosition,
          pinchStartMatrix: {
            a: pinchStartMatrixRef.current.a,
            b: pinchStartMatrixRef.current.b,
            c: pinchStartMatrixRef.current.c,
            d: pinchStartMatrixRef.current.d,
            e: pinchStartMatrixRef.current.e,
            f: pinchStartMatrixRef.current.f,
          },
          initialDistance: distance,
        },
      };
      
      // デバッグログに追加
      debugLogRef.current.push(debugInfo);
      
      // コンソールにも出力（開発用）
      console.log("[PinchStart] ===== ピンチ開始 =====", {
        pinchStartCenter: {
          screen: { x: centerXScreen.toFixed(2), y: centerYScreen.toFixed(2) },
        },
        説明: "ピンチ中心はscreen座標で固定（変換しない）",
        zoomLayerRect: {
          left: zoomLayerRect.left.toFixed(2),
          top: zoomLayerRect.top.toFixed(2),
          width: zoomLayerRect.width.toFixed(2),
          height: zoomLayerRect.height.toFixed(2),
        },
        imageSize: {
          natural: imageNaturalSize,
          display: imageDisplaySize,
        },
        headerHeight: headerHeight.toFixed(2),
        viewportSize: viewportSize,
        scrollPosition: scrollPosition,
        pinchStartMatrix: {
          a: pinchStartMatrixRef.current.a.toFixed(4),
          b: pinchStartMatrixRef.current.b.toFixed(4),
          c: pinchStartMatrixRef.current.c.toFixed(4),
          d: pinchStartMatrixRef.current.d.toFixed(4),
          e: pinchStartMatrixRef.current.e.toFixed(4),
          f: pinchStartMatrixRef.current.f.toFixed(4),
        },
        initialDistance: distance.toFixed(2),
      });
    },
    [transformMatrix, canvasZoomLayerRef, isPinching]
  );

  /**
   * ピンチ移動
   * 
   * ピンチ中心（pivot）を screen 座標で固定し、その点を基準にスケーリング
   * 数学的には: M_new = T(pivot) * S(scaleRatio) * T(-pivot) * M_old
   * ここで pivot は screen 座標（変換しない）
   */
  const handlePinchMove = useCallback(
    (touch1: React.Touch, touch2: React.Touch) => {
      // ピンチ中でない場合は処理しない
      if (!isPinching) {
        return;
      }
      
      if (pinchStartDistanceRef.current === null || pinchStartCenterScreenRef.current === null || pinchStartMatrixRef.current === null) {
        return;
      }

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // スケール比を計算（scaleRatio）
      const scaleRatio = currentDistance / pinchStartDistanceRef.current;

      // スケール比が1.0に近い場合は行列を更新しない（必須のガード処理）
      if (Math.abs(scaleRatio - 1) <= SCALE_EPSILON) {
        return;
      }

      if (!canvasZoomLayerRef?.current || !zoomLayerRectRef.current) {
        return;
      }

      // 重要: pivot は screen 座標で取得するが、
      // DOMMatrix に渡す前に zoomLayer の local 座標へ変換する必要がある
      // DOMMatrix は transform 対象要素の local 座標系で解釈されるため
      const pivotScreenX = pinchStartCenterScreenRef.current.x;
      const pivotScreenY = pinchStartCenterScreenRef.current.y;
      
      // screen座標からlocal座標へ変換
      const pivotLocalX = pivotScreenX - zoomLayerRectRef.current.left;
      const pivotLocalY = pivotScreenY - zoomLayerRectRef.current.top;
      
      // 重要: M_new = T(pivotLocal) * S(scaleRatio) * T(-pivotLocal) * M_old
      // DOMMatrix のメソッドは右から左に適用されるため、順序に注意
      // 1. M_old から開始
      // 2. T(-pivotLocal) を適用
      // 3. S(scaleRatio) を適用
      // 4. T(pivotLocal) を適用
      const newMatrix = new DOMMatrix([
        pinchStartMatrixRef.current.a,
        pinchStartMatrixRef.current.b,
        pinchStartMatrixRef.current.c,
        pinchStartMatrixRef.current.d,
        pinchStartMatrixRef.current.e,
        pinchStartMatrixRef.current.f,
      ])
        .translate(-pivotLocalX, -pivotLocalY)  // T(-pivotLocal)
        .scale(scaleRatio, scaleRatio)          // S(scaleRatio)
        .translate(pivotLocalX, pivotLocalY);    // T(pivotLocal)
      
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
    const startCenterScreen = pinchStartCenterScreenRef.current;
    
    if (startMatrix && startCenterScreen) {
      // 最終的なスケール比を計算（開始時の距離と終了時の距離の比）
      // ただし、終了時には距離が取得できないため、行列からスケールを計算
      const startScale = Math.sqrt(startMatrix.a * startMatrix.a + startMatrix.b * startMatrix.b);
      const finalScale = Math.sqrt(finalMatrix.a * finalMatrix.a + finalMatrix.b * finalMatrix.b);
      const scaleRatio = finalScale / startScale;
      
      // 重要: pivot は screen 座標で取得するが、
      // DOMMatrix に渡す前に local 座標へ変換する必要がある
      const pivotScreenX = startCenterScreen.x;
      const pivotScreenY = startCenterScreen.y;
      
      // 現在のCanvasZoomLayerの位置とサイズを取得（ピンチ終了時）
      const currentZoomLayerRect = canvasZoomLayerRef?.current?.getBoundingClientRect();
      if (!currentZoomLayerRect) {
        return;
      }
      
      // 不動点条件の検証: screen座標のpivotが、transform適用後も同じscreen座標に表示されるか
      // 検証のため、pivotをlocal座標に変換してからstartMatrixで変換
      const pivotLocalX = pivotScreenX - currentZoomLayerRect.left;
      const pivotLocalY = pivotScreenY - currentZoomLayerRect.top;
      
      // pivot（local座標）をstartMatrixで変換した座標
      const pivotStartTransformed = new DOMPoint(pivotLocalX, pivotLocalY).matrixTransform(startMatrix);
      // pivot（local座標）をfinalMatrixで変換した座標
      const pivotFinalTransformed = new DOMPoint(pivotLocalX, pivotLocalY).matrixTransform(finalMatrix);
      // 期待値: pivotStartTransformed * scaleRatio（不動点条件により、この点が不動点になる）
      const pivotExpected = new DOMPoint(
        pivotStartTransformed.x * scaleRatio,
        pivotStartTransformed.y * scaleRatio
      );
      // 差分（不動点条件の満足度を検証）
      const pivotDiff = {
        x: pivotFinalTransformed.x - pivotExpected.x,
        y: pivotFinalTransformed.y - pivotExpected.y,
      };
      // 距離の差分（不動点条件の満足度）
      const pivotDistance = Math.sqrt(
        pivotDiff.x * pivotDiff.x + pivotDiff.y * pivotDiff.y
      );
      
      // isIdentityの判定
      const isIdentity = 
        Math.abs(startMatrix.a - 1) < 0.0001 &&
        Math.abs(startMatrix.b) < 0.0001 &&
        Math.abs(startMatrix.c) < 0.0001 &&
        Math.abs(startMatrix.d - 1) < 0.0001 &&
        Math.abs(startMatrix.e) < 0.0001 &&
        Math.abs(startMatrix.f) < 0.0001;
      const currentImageElement = canvasZoomLayerRef?.current?.querySelector("img");
      const currentImageSize = currentImageElement ? {
        natural: { width: currentImageElement.naturalWidth, height: currentImageElement.naturalHeight },
        display: { width: currentImageElement.offsetWidth, height: currentImageElement.offsetHeight },
      } : null;
      
      // デバッグ情報を構築
      const debugInfo = {
        timestamp: performance.now(),
        event: "pinch-end",
        data: {
          scaleRatio: scaleRatio,
          pinchType: scaleRatio > 1 ? "OUT" : "IN",
          isIdentity: isIdentity,
          pinchStartCenter: {
            screen: { x: startCenterScreen.x, y: startCenterScreen.y },
            local: { x: pivotLocalX, y: pivotLocalY },
          },
          pivot: {
            screen: { x: pivotScreenX, y: pivotScreenY },
            local: { x: pivotLocalX, y: pivotLocalY },
          },
          startMatrix: {
            a: startMatrix.a,
            b: startMatrix.b,
            c: startMatrix.c,
            d: startMatrix.d,
            e: startMatrix.e,
            f: startMatrix.f,
          },
          finalMatrix: {
            a: finalMatrix.a,
            b: finalMatrix.b,
            c: finalMatrix.c,
            d: finalMatrix.d,
            e: finalMatrix.e,
            f: finalMatrix.f,
          },
          fixedPointVerification: {
            pivotStartTransformed: { x: pivotStartTransformed.x, y: pivotStartTransformed.y },
            pivotFinalTransformed: { x: pivotFinalTransformed.x, y: pivotFinalTransformed.y },
            pivotExpected: { x: pivotExpected.x, y: pivotExpected.y },
            diff: { x: pivotDiff.x, y: pivotDiff.y },
            distance: pivotDistance,
            satisfied: pivotDistance < 0.1,
          },
          currentZoomLayerRect: currentZoomLayerRect ? {
            left: currentZoomLayerRect.left,
            top: currentZoomLayerRect.top,
            width: currentZoomLayerRect.width,
            height: currentZoomLayerRect.height,
            right: currentZoomLayerRect.right,
            bottom: currentZoomLayerRect.bottom,
            x: currentZoomLayerRect.x,
            y: currentZoomLayerRect.y,
          } : null,
          currentImageSize: currentImageSize,
          viewportSize: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          scrollPosition: {
            x: window.scrollX,
            y: window.scrollY,
          },
        },
      };
      
      // デバッグログに追加
      debugLogRef.current.push(debugInfo);
      
      // ログが10件以上になったら、ファイルに保存してクリア
      if (debugLogRef.current.length >= 10) {
        const logData = JSON.stringify(debugLogRef.current, null, 2);
        const blob = new Blob([logData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pinch-zoom-debug-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        debugLogRef.current = [];
      }
      
      // コンソールにも出力（開発用）
      console.log("[PinchEnd] ===== ピンチ終了 =====");
      console.log("[PinchEnd] scaleRatio:", scaleRatio.toFixed(6));
      console.log("[PinchEnd] pinchType:", scaleRatio > 1 ? "OUT" : "IN");
      console.log("[PinchEnd] isIdentity:", isIdentity);
      console.log("[PinchEnd] pinchStartCenter (screen座標):", { x: startCenterScreen.x.toFixed(2), y: startCenterScreen.y.toFixed(2) });
      console.log("[PinchEnd] pivot (screen座標):", { x: pivotScreenX.toFixed(4), y: pivotScreenY.toFixed(4) });
      console.log("[PinchEnd] pivot (local座標):", { x: pivotLocalX.toFixed(4), y: pivotLocalY.toFixed(4) });
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
      console.log("[PinchEnd] === 不動点条件の検証 ===");
      console.log("[PinchEnd] pivot (local座標)をstartMatrixで変換:", {
        x: pivotStartTransformed.x.toFixed(4),
        y: pivotStartTransformed.y.toFixed(4),
      });
      console.log("[PinchEnd] pivot (local座標)をfinalMatrixで変換:", {
        x: pivotFinalTransformed.x.toFixed(4),
        y: pivotFinalTransformed.y.toFixed(4),
      });
      console.log("[PinchEnd] 期待値 (startMatrix変換 * scaleRatio):", {
        x: pivotExpected.x.toFixed(4),
        y: pivotExpected.y.toFixed(4),
      });
      console.log("[PinchEnd] 差分:", {
        x: pivotDiff.x.toFixed(4),
        y: pivotDiff.y.toFixed(4),
        distance: pivotDistance.toFixed(4),
      });
      console.log("[PinchEnd] 不動点条件:", pivotDistance < 0.1 ? "✓ 満足" : "✗ 不満足");
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
    pinchStartCenterScreenRef.current = null;
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
        pinchCenterX: pinchStartCenterScreenRef.current?.x ?? null,
        pinchCenterY: pinchStartCenterScreenRef.current?.y ?? null,
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

  // デバッグログをダウンロードする関数
  const downloadDebugLog = useCallback(() => {
    if (debugLogRef.current.length === 0) {
      console.warn("[PinchZoom] デバッグログが空です");
      return;
    }
    const logData = JSON.stringify(debugLogRef.current, null, 2);
    const blob = new Blob([logData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pinch-zoom-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    debugLogRef.current = [];
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
    downloadDebugLog,
  };
}
