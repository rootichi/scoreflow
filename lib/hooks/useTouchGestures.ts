import { useState, useRef, useCallback } from "react";

/**
 * タッチジェスチャーの種類
 */
export type TouchGestureType = "tap" | "longPress" | "drag" | "pinch" | "pan";

/**
 * タッチジェスチャーの判定結果
 */
export interface TouchGestureResult {
  type: TouchGestureType;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  distance: number;
  duration: number;
}

/**
 * Canva風のタッチジェスチャー管理フック
 * 
 * タップ、ロングプレス、ドラッグ、ピンチ、パンを判定
 */
export function useTouchGestures() {
  const [gesture, setGesture] = useState<TouchGestureResult | null>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    touches: Array<{ clientX: number; clientY: number }>;
  } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // ロングプレス判定の閾値（ミリ秒）
  const LONG_PRESS_DURATION = 300;
  // ドラッグ判定の閾値（ピクセル）
  const DRAG_THRESHOLD = 5;
  // タップ判定の最大移動距離（ピクセル）
  const TAP_MAX_DISTANCE = 10;

  /**
   * タッチ開始
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();

    // タッチ情報を配列に変換
    const touches = Array.from(e.touches).map(t => ({
      clientX: t.clientX,
      clientY: t.clientY,
    }));
    
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now,
      touches,
    };

    isLongPressRef.current = false;

    // ロングプレスタイマーを開始
    longPressTimerRef.current = setTimeout(() => {
      if (touchStartRef.current) {
        isLongPressRef.current = true;
        setGesture({
          type: "longPress",
          startX: touchStartRef.current.x,
          startY: touchStartRef.current.y,
          currentX: touch.clientX,
          currentY: touch.clientY,
          deltaX: 0,
          deltaY: 0,
          distance: 0,
          duration: Date.now() - touchStartRef.current.time,
        });
      }
    }, LONG_PRESS_DURATION);
  }, []);

  /**
   * タッチ移動
   */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - touchStartRef.current.time;

    // ロングプレスタイマーをキャンセル（移動が検出された場合）
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // 複数タッチの場合はピンチ
    if (e.touches.length > 1) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const startTouch1 = touchStartRef.current.touches[0];
      const startTouch2 = touchStartRef.current.touches[1] || startTouch1;

      const startDistance = Math.sqrt(
        Math.pow(startTouch2.clientX - startTouch1.clientX, 2) +
        Math.pow(startTouch2.clientY - startTouch1.clientY, 2)
      );
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      setGesture({
        type: "pinch",
        startX: touchStartRef.current.x,
        startY: touchStartRef.current.y,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX: deltaX,
        deltaY: deltaY,
        distance: currentDistance - startDistance,
        duration,
      });
      return;
    }

    // ドラッグ判定
    if (distance > DRAG_THRESHOLD) {
      setGesture({
        type: isLongPressRef.current ? "drag" : "drag",
        startX: touchStartRef.current.x,
        startY: touchStartRef.current.y,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX: deltaX,
        deltaY: deltaY,
        distance,
        duration,
      });
    } else {
      // パン判定（小さな移動）
      setGesture({
        type: "pan",
        startX: touchStartRef.current.x,
        startY: touchStartRef.current.y,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX: deltaX,
        deltaY: deltaY,
        distance,
        duration,
      });
    }
  }, []);

  /**
   * タッチ終了
   */
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    // ロングプレスタイマーをキャンセル
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - touchStartRef.current.time;

    // タップ判定（移動距離が少なく、ロングプレスでない場合）
    if (distance < TAP_MAX_DISTANCE && !isLongPressRef.current && duration < LONG_PRESS_DURATION) {
      setGesture({
        type: "tap",
        startX: touchStartRef.current.x,
        startY: touchStartRef.current.y,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX: 0,
        deltaY: 0,
        distance: 0,
        duration,
      });
    } else {
      // ジェスチャーをクリア
      setGesture(null);
    }

    // リセット
    touchStartRef.current = null;
    isLongPressRef.current = false;
  }, []);

  /**
   * ジェスチャーをクリア
   */
  const clearGesture = useCallback(() => {
    setGesture(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
    isLongPressRef.current = false;
  }, []);

  return {
    gesture,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearGesture,
  };
}

