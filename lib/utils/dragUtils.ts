import { Mark, LineMark, ScoreMark } from "@/lib/firebase/types";
import { isHorizontalLine, isVerticalLine } from "./canvasUtils";
import { handleHorizontalLineDragSnap, handleVerticalLineDragSnap, handleScoreDragSnap } from "./snapUtils";
import { updateMarkCoordinates } from "./markUtils";

interface DragContext {
  coords: { x: number; y: number };
  canvasRect: DOMRect;
  marks: Array<Mark & { id: string }>;
  setSnapGuide: (guide: { x?: number; y?: number; visible: boolean } | null) => void;
}

/**
 * マークをドラッグして更新する共通処理
 */
export const processMarkDrag = (
  mark: Mark & { id: string },
  dx: number,
  dy: number,
  context: DragContext
): Mark & { id: string } => {
  const { coords, canvasRect, marks, setSnapGuide } = context;

  if (mark.type === "line") {
    const original = mark as LineMark & { id: string };
    const movedLine = updateMarkCoordinates(original, dx, dy) as LineMark & { id: string };

    if (isHorizontalLine(original)) {
      const { adjustedLine, snapGuide } = handleHorizontalLineDragSnap(
        coords,
        canvasRect.width,
        canvasRect.height,
        marks,
        movedLine
      );
      setSnapGuide(snapGuide);
      return adjustedLine;
    } else if (isVerticalLine(original)) {
      const { adjustedLine, snapGuide } = handleVerticalLineDragSnap(
        coords,
        canvasRect.width,
        canvasRect.height,
        marks,
        movedLine
      );
      setSnapGuide(snapGuide);
      return adjustedLine;
    } else {
      setSnapGuide(null);
      return movedLine;
    }
  } else {
    const original = mark as ScoreMark & { id: string };
    const movedScore = updateMarkCoordinates(original, dx, dy) as ScoreMark & { id: string };
    const { adjustedScore, snapGuide } = handleScoreDragSnap(
      movedScore,
      canvasRect.width,
      canvasRect.height,
      marks,
      mark.id
    );
    setSnapGuide(snapGuide);
    return adjustedScore;
  }
};

