import { useCallback, RefObject } from "react";

/**
 * キャンバス上の相対座標を取得するカスタムフック
 */
export function useCanvasCoordinates(canvasRef: RefObject<HTMLDivElement | null>) {
  const getRelativeCoordinates = useCallback(
    (
      e:
        | React.MouseEvent<HTMLDivElement>
        | MouseEvent
        | React.TouchEvent<HTMLDivElement>
        | TouchEvent
    ): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();

      // タッチイベントの場合
      if ("touches" in e && e.touches.length > 0) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) / rect.width,
          y: (touch.clientY - rect.top) / rect.height,
        };
      }

      // タッチ終了イベントの場合（changedTouchesから取得）
      if ("changedTouches" in e && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        return {
          x: (touch.clientX - rect.left) / rect.width,
          y: (touch.clientY - rect.top) / rect.height,
        };
      }

      // マウスイベントの場合
      if ("clientX" in e && "clientY" in e) {
        return {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        };
      }

      return { x: 0, y: 0 };
    },
    []
  );

  return { getRelativeCoordinates };
}

