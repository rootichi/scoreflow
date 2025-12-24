import { useCallback, RefObject } from "react";

/**
 * キャンバス上の相対座標を取得するカスタムフック
 * SVG内のイベントも正しく処理できるように改善
 */
export function useCanvasCoordinates(
  canvasRef: RefObject<HTMLDivElement | null>
) {
  const getRelativeCoordinates = useCallback(
    (
      e:
        | React.MouseEvent<HTMLDivElement | SVGCircleElement | SVGLineElement>
        | MouseEvent
        | React.TouchEvent<HTMLDivElement | SVGCircleElement | SVGLineElement>
        | TouchEvent
    ): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      
      // SVG内のイベントの場合、SVG要素の座標系を考慮
      let rect: DOMRect;
      const currentTarget = (e as any).currentTarget;
      
      // SVG要素またはSVG内の要素からのイベントの場合
      if (currentTarget) {
        // SVG要素自体の場合
        if (currentTarget instanceof SVGSVGElement) {
          rect = currentTarget.getBoundingClientRect();
        }
        // SVG内の要素（circle, lineなど）の場合
        else if (currentTarget instanceof SVGElement) {
          const svgElement = currentTarget.ownerSVGElement || currentTarget.closest?.('svg');
          if (svgElement) {
            rect = svgElement.getBoundingClientRect();
          } else {
            rect = canvasRef.current.getBoundingClientRect();
          }
        }
        // 通常のdiv要素からのイベントの場合
        else {
          rect = canvasRef.current.getBoundingClientRect();
        }
      } else {
        // currentTargetがない場合（通常のイベント）
        rect = canvasRef.current.getBoundingClientRect();
      }

      // タッチイベントの場合
      if ("touches" in e && e.touches.length > 0) {
        const touch = e.touches[0];
        // getBoundingClientRect()はビューポート座標系を返すので、そのまま使用
        // transform: scale()が適用されていても、getBoundingClientRect()は正しい座標を返す
        return {
          x: (touch.clientX - rect.left) / rect.width,
          y: (touch.clientY - rect.top) / rect.height,
        };
      }

      // タッチ終了イベントの場合（changedTouchesから取得）
      if ("changedTouches" in e && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        // getBoundingClientRect()はビューポート座標系を返すので、そのまま使用
        return {
          x: (touch.clientX - rect.left) / rect.width,
          y: (touch.clientY - rect.top) / rect.height,
        };
      }

      // マウスイベントの場合
      if ("clientX" in e && "clientY" in e) {
        // getBoundingClientRect()はビューポート座標系を返すので、そのまま使用
        return {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        };
      }

      return { x: 0, y: 0 };
    },
    [canvasRef]
  );

  return { getRelativeCoordinates };
}

