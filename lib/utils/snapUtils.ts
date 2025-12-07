import { LineMark, Mark, ScoreMark } from "@/lib/firebase/types";
import {
  findSnapPositionForHandle,
  findSnapPositionForHandleVertical,
  findSnapPosition,
  findSnapPositionVertical,
  findSnapPositionForScore,
  clampCoordinate,
  getHorizontalLineEndpoints,
  getVerticalLineEndpoints,
} from "./canvasUtils";
import { updateMarkCoordinates } from "./markUtils";

export interface SnapGuide {
  x?: number;
  y?: number;
  visible: boolean;
}

/**
 * 水平線のハンドルドラッグ時のスナップ処理
 */
export const handleHorizontalHandleSnap = (
  targetX: number,
  canvasWidth: number,
  marks: Array<Mark & { id: string }>,
  markId: string
): { snappedX: number; snapGuide: SnapGuide | null } => {
  const { snappedX, snapTarget } = findSnapPositionForHandle(
    targetX,
    canvasWidth,
    marks,
    markId
  );
  
  return {
    snappedX,
    snapGuide: snapTarget !== null ? { x: snapTarget, visible: true } : null,
  };
};

/**
 * 垂直線のハンドルドラッグ時のスナップ処理
 */
export const handleVerticalHandleSnap = (
  targetY: number,
  canvasHeight: number,
  marks: Array<Mark & { id: string }>,
  markId: string
): { snappedY: number; snapGuide: SnapGuide | null } => {
  const { snappedY, snapTarget } = findSnapPositionForHandleVertical(
    targetY,
    canvasHeight,
    marks,
    markId
  );
  
  return {
    snappedY,
    snapGuide: snapTarget !== null ? { y: snapTarget, visible: true } : null,
  };
};

/**
 * 水平線のドラッグ時のスナップ処理
 */
export const handleHorizontalLineDragSnap = (
  coords: { x: number; y: number },
  canvasWidth: number,
  marks: Array<Mark & { id: string }>,
  movedLine: LineMark & { id: string }
): { adjustedLine: LineMark & { id: string }; snapGuide: SnapGuide | null } => {
  const { snappedX, snapTargetX, snapToLeft } = findSnapPosition(
    coords.x,
    coords.y,
    canvasWidth,
    marks,
    false,
    null,
    movedLine
  );

  const movedEndpoints = getHorizontalLineEndpoints(movedLine);
  let adjustedX1 = movedLine.x1;
  let adjustedX2 = movedLine.x2;

  if (snapTargetX !== null) {
    const offset = snapToLeft
      ? snapTargetX - movedEndpoints.left
      : snapTargetX - movedEndpoints.right;
    adjustedX1 = clampCoordinate(movedLine.x1 + offset);
    adjustedX2 = clampCoordinate(movedLine.x2 + offset);
  }

  return {
    adjustedLine: {
      ...movedLine,
      x1: adjustedX1,
      x2: adjustedX2,
    },
    snapGuide: snapTargetX !== null ? { x: snapTargetX, visible: true } : null,
  };
};

/**
 * 垂直線のドラッグ時のスナップ処理
 */
export const handleVerticalLineDragSnap = (
  coords: { x: number; y: number },
  canvasHeight: number,
  marks: Array<Mark & { id: string }>,
  movedLine: LineMark & { id: string }
): { adjustedLine: LineMark & { id: string }; snapGuide: SnapGuide | null } => {
  const { snappedY, snapTargetY, snapToTop } = findSnapPositionVertical(
    coords.x,
    coords.y,
    canvasHeight,
    marks,
    false,
    null,
    movedLine
  );

  const movedEndpoints = getVerticalLineEndpoints(movedLine);
  let adjustedY1 = movedLine.y1;
  let adjustedY2 = movedLine.y2;

  if (snapTargetY !== null) {
    const offset = snapToTop
      ? snapTargetY - movedEndpoints.top
      : snapTargetY - movedEndpoints.bottom;
    adjustedY1 = clampCoordinate(movedLine.y1 + offset);
    adjustedY2 = clampCoordinate(movedLine.y2 + offset);
  }

  return {
    adjustedLine: {
      ...movedLine,
      y1: adjustedY1,
      y2: adjustedY2,
    },
    snapGuide: snapTargetY !== null ? { y: snapTargetY, visible: true } : null,
  };
};

/**
 * スコアのドラッグ時のスナップ処理
 */
export const handleScoreDragSnap = (
  movedScore: ScoreMark & { id: string },
  canvasWidth: number,
  canvasHeight: number,
  marks: Array<Mark & { id: string }>,
  markId: string
): { adjustedScore: ScoreMark & { id: string }; snapGuide: SnapGuide | null } => {
  const { snappedX, snappedY, snapTargetX, snapTargetY } = findSnapPositionForScore(
    movedScore.x,
    movedScore.y,
    canvasWidth,
    canvasHeight,
    marks,
    markId
  );

  return {
    adjustedScore: {
      ...movedScore,
      x: snappedX,
      y: snappedY,
    },
    snapGuide:
      snapTargetX !== null || snapTargetY !== null
        ? {
            x: snapTargetX !== null ? snapTargetX : undefined,
            y: snapTargetY !== null ? snapTargetY : undefined,
            visible: true,
          }
        : null,
  };
};

