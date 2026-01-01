import { SnapGuide } from "@/lib/types/canvas";
import {
  SNAP_GUIDE_COLOR,
  SNAP_GUIDE_STROKE_WIDTH,
  SNAP_GUIDE_OPACITY,
} from "@/lib/constants";

interface SnapGuideLinesProps {
  snapGuide: SnapGuide | null;
  variant?: "drawing" | "dragging";
}

export function SnapGuideLines({ snapGuide, variant = "drawing" }: SnapGuideLinesProps) {
  // デバッグログ
  console.log('[SnapGuideLines]', {
    snapGuide,
    variant,
    snapGuideX: snapGuide?.x,
    snapGuideY: snapGuide?.y,
    snapGuideVisible: snapGuide?.visible,
    willRender: snapGuide && snapGuide.visible,
  });
  
  if (!snapGuide || !snapGuide.visible) {
    return null;
  }

  const strokeColor = variant === "drawing" ? SNAP_GUIDE_COLOR : "#3b82f6";
  const strokeWidth = variant === "drawing" ? SNAP_GUIDE_STROKE_WIDTH : "0.1";
  const opacity = variant === "drawing" ? SNAP_GUIDE_OPACITY : "0.6";

  return (
    <>
      {/* 水平線用のスナップガイドライン（垂直線） */}
      {snapGuide.x !== undefined && (
        <line
          x1={snapGuide.x * 100}
          y1="0"
          x2={snapGuide.x * 100}
          y2="100"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeDasharray="0.5 0.5"
        />
      )}
      {/* 垂直線用のスナップガイドライン（水平線） */}
      {snapGuide.y !== undefined && (
        <line
          x1="0"
          y1={snapGuide.y * 100}
          x2="100"
          y2={snapGuide.y * 100}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeDasharray="0.5 0.5"
        />
      )}
    </>
  );
}

