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
  collectHorizontalLineYCoordinates,
  collectVerticalLineXCoordinates,
} from "./canvasUtils";
import { updateMarkCoordinates } from "./markUtils";
import { SNAP_DISTANCE_PX } from "@/lib/constants";

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
  
  // 垂直線のX座標もスナップ候補に追加
  const verticalLineXCoordinates = collectVerticalLineXCoordinates(marks, markId);
  const snapDistance = SNAP_DISTANCE_PX / canvasWidth;
  let minDistance = snapDistance;
  let snapTargetFromVertical: number | null = null;
  
  verticalLineXCoordinates.forEach((xCoord) => {
    const distance = Math.abs(targetX - xCoord);
    if (distance < minDistance) {
      minDistance = distance;
      snapTargetFromVertical = xCoord;
    }
  });
  
  // 水平線のX座標と垂直線のX座標の両方を考慮し、最も近いものを選択
  let finalSnappedX = snappedX;
  let finalSnapTarget: number | null = null;
  
  if (snapTarget !== null && snapTargetFromVertical !== null) {
    const distanceToHorizontal = Math.abs(targetX - snapTarget);
    const distanceToVertical = Math.abs(targetX - snapTargetFromVertical);
    if (distanceToVertical < distanceToHorizontal) {
      finalSnappedX = snapTargetFromVertical;
      finalSnapTarget = snapTargetFromVertical;
    } else {
      finalSnappedX = snapTarget;
      finalSnapTarget = snapTarget;
    }
  } else if (snapTargetFromVertical !== null) {
    finalSnappedX = snapTargetFromVertical;
    finalSnapTarget = snapTargetFromVertical;
  } else if (snapTarget !== null) {
    finalSnappedX = snapTarget;
    finalSnapTarget = snapTarget;
  }
  
  return {
    snappedX: finalSnappedX,
    snapGuide: finalSnapTarget !== null ? { x: finalSnapTarget, visible: true } : null,
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
  
  // 水平線のY座標もスナップ候補に追加
  const horizontalLineYCoordinates = collectHorizontalLineYCoordinates(marks, markId);
  const snapDistance = SNAP_DISTANCE_PX / canvasHeight;
  let minDistance = snapDistance;
  let snapTargetFromHorizontal: number | null = null;
  
  horizontalLineYCoordinates.forEach((yCoord) => {
    const distance = Math.abs(targetY - yCoord);
    if (distance < minDistance) {
      minDistance = distance;
      snapTargetFromHorizontal = yCoord;
    }
  });
  
  // 垂直線のY座標と水平線のY座標の両方を考慮し、最も近いものを選択
  let finalSnappedY = snappedY;
  let finalSnapTarget: number | null = null;
  
  if (snapTarget !== null && snapTargetFromHorizontal !== null) {
    const distanceToVertical = Math.abs(targetY - snapTarget);
    const distanceToHorizontal = Math.abs(targetY - snapTargetFromHorizontal);
    if (distanceToHorizontal < distanceToVertical) {
      finalSnappedY = snapTargetFromHorizontal;
      finalSnapTarget = snapTargetFromHorizontal;
    } else {
      finalSnappedY = snapTarget;
      finalSnapTarget = snapTarget;
    }
  } else if (snapTargetFromHorizontal !== null) {
    finalSnappedY = snapTargetFromHorizontal;
    finalSnapTarget = snapTargetFromHorizontal;
  } else if (snapTarget !== null) {
    finalSnappedY = snapTarget;
    finalSnapTarget = snapTarget;
  }
  
  return {
    snappedY: finalSnappedY,
    snapGuide: finalSnapTarget !== null ? { y: finalSnapTarget, visible: true } : null,
  };
};

/**
 * 水平線のドラッグ時のスナップ処理
 */
export const handleHorizontalLineDragSnap = (
  coords: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
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
  let adjustedY1 = movedLine.y1;
  let adjustedY2 = movedLine.y2;

  // X方向のスナップ（水平線の端点にスナップ）
  let snapTargetXFinal: number | null = snapTargetX;
  if (snapTargetX !== null) {
    const offset = snapToLeft
      ? snapTargetX - movedEndpoints.left
      : snapTargetX - movedEndpoints.right;
    adjustedX1 = clampCoordinate(movedLine.x1 + offset);
    adjustedX2 = clampCoordinate(movedLine.x2 + offset);
  }

  // X方向のスナップ（垂直線のX座標にスナップ）
  const verticalLineXCoordinates = collectVerticalLineXCoordinates(marks, movedLine.id);
  const snapDistanceXForVertical = SNAP_DISTANCE_PX / canvasWidth;
  let minDistanceXForVertical = snapDistanceXForVertical;
  let snapTargetXFromVertical: number | null = null;
  
  // 現在の水平線の端点（left/right）が垂直線のX座標に近いかチェック
  const currentLeft = movedEndpoints.left;
  const currentRight = movedEndpoints.right;
  
  verticalLineXCoordinates.forEach((xCoord) => {
    const leftDistance = Math.abs(currentLeft - xCoord);
    const rightDistance = Math.abs(currentRight - xCoord);
    const minDistance = Math.min(leftDistance, rightDistance);
    
    if (minDistance < minDistanceXForVertical) {
      minDistanceXForVertical = minDistance;
      snapTargetXFromVertical = xCoord;
    }
  });

  // 水平線のX座標と垂直線のX座標の両方を考慮し、最も近いものを選択
  if (snapTargetXFromVertical !== null) {
    if (snapTargetXFinal === null) {
      // 水平線のX座標へのスナップがない場合、垂直線のX座標にスナップ
      const leftDistance = Math.abs(currentLeft - snapTargetXFromVertical);
      const rightDistance = Math.abs(currentRight - snapTargetXFromVertical);
      const offset = leftDistance < rightDistance
        ? snapTargetXFromVertical - currentLeft
        : snapTargetXFromVertical - currentRight;
      adjustedX1 = clampCoordinate(movedLine.x1 + offset);
      adjustedX2 = clampCoordinate(movedLine.x2 + offset);
      snapTargetXFinal = snapTargetXFromVertical;
    } else {
      // 両方ある場合、より近い方を選択
      const distanceToHorizontal = Math.abs(currentLeft - snapTargetXFinal) < Math.abs(currentRight - snapTargetXFinal)
        ? Math.abs(currentLeft - snapTargetXFinal)
        : Math.abs(currentRight - snapTargetXFinal);
      const distanceToVertical = Math.min(
        Math.abs(currentLeft - snapTargetXFromVertical),
        Math.abs(currentRight - snapTargetXFromVertical)
      );
      
      if (distanceToVertical < distanceToHorizontal) {
        const leftDistance = Math.abs(currentLeft - snapTargetXFromVertical);
        const rightDistance = Math.abs(currentRight - snapTargetXFromVertical);
        const offset = leftDistance < rightDistance
          ? snapTargetXFromVertical - currentLeft
          : snapTargetXFromVertical - currentRight;
        adjustedX1 = clampCoordinate(movedLine.x1 + offset);
        adjustedX2 = clampCoordinate(movedLine.x2 + offset);
        snapTargetXFinal = snapTargetXFromVertical;
      }
    }
  }

  // Y方向のスナップ（他の水平線と一直線上に並べる）
  const horizontalLineYCoordinates = collectHorizontalLineYCoordinates(marks, movedLine.id);
  const snapDistanceY = SNAP_DISTANCE_PX / canvasHeight;
  let minDistanceY = snapDistanceY;
  let snapTargetY: number | null = null;
  
  // 現在の水平線のY座標（y1とy2は同じ）
  const currentY = movedLine.y1;
  
  horizontalLineYCoordinates.forEach((yCoord) => {
    const distance = Math.abs(currentY - yCoord);
    if (distance < minDistanceY) {
      minDistanceY = distance;
      snapTargetY = yCoord;
    }
  });

  // Y方向にスナップする場合、Y座標を調整
  if (snapTargetY !== null) {
    const yOffset = snapTargetY - currentY;
    adjustedY1 = clampCoordinate(movedLine.y1 + yOffset);
    adjustedY2 = clampCoordinate(movedLine.y2 + yOffset);
  }

  // スナップガイドラインを設定（X方向とY方向の両方）
  const snapGuide: SnapGuide = { visible: true };
  if (snapTargetXFinal !== null) {
    snapGuide.x = snapTargetXFinal;
  }
  if (snapTargetY !== null) {
    snapGuide.y = snapTargetY;
  }

  const finalSnapGuide = (snapTargetXFinal !== null || snapTargetY !== null) ? snapGuide : null;

  return {
    adjustedLine: {
      ...movedLine,
      x1: adjustedX1,
      x2: adjustedX2,
      y1: adjustedY1,
      y2: adjustedY2,
    },
    snapGuide: finalSnapGuide,
  };
};

/**
 * 垂直線のドラッグ時のスナップ処理
 */
export const handleVerticalLineDragSnap = (
  coords: { x: number; y: number },
  canvasWidth: number,
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
  let adjustedX1 = movedLine.x1;
  let adjustedX2 = movedLine.x2;
  let adjustedY1 = movedLine.y1;
  let adjustedY2 = movedLine.y2;

  // Y方向のスナップ（垂直線の端点にスナップ）
  let snapTargetYFinal: number | null = snapTargetY;
  if (snapTargetY !== null) {
    const offset = snapToTop
      ? snapTargetY - movedEndpoints.top
      : snapTargetY - movedEndpoints.bottom;
    adjustedY1 = clampCoordinate(movedLine.y1 + offset);
    adjustedY2 = clampCoordinate(movedLine.y2 + offset);
  }

  // Y方向のスナップ（水平線のY座標にスナップ）
  const horizontalLineYCoordinates = collectHorizontalLineYCoordinates(marks, movedLine.id);
  const snapDistanceYForHorizontal = SNAP_DISTANCE_PX / canvasHeight;
  let minDistanceYForHorizontal = snapDistanceYForHorizontal;
  let snapTargetYFromHorizontal: number | null = null;
  
  // 現在の垂直線の端点（top/bottom）が水平線のY座標に近いかチェック
  const currentTop = movedEndpoints.top;
  const currentBottom = movedEndpoints.bottom;
  
  horizontalLineYCoordinates.forEach((yCoord) => {
    const topDistance = Math.abs(currentTop - yCoord);
    const bottomDistance = Math.abs(currentBottom - yCoord);
    const minDistance = Math.min(topDistance, bottomDistance);
    
    if (minDistance < minDistanceYForHorizontal) {
      minDistanceYForHorizontal = minDistance;
      snapTargetYFromHorizontal = yCoord;
    }
  });

  // 垂直線のY座標と水平線のY座標の両方を考慮し、最も近いものを選択
  if (snapTargetYFromHorizontal !== null) {
    if (snapTargetYFinal === null) {
      // 垂直線のY座標へのスナップがない場合、水平線のY座標にスナップ
      const topDistance = Math.abs(currentTop - snapTargetYFromHorizontal);
      const bottomDistance = Math.abs(currentBottom - snapTargetYFromHorizontal);
      const offset = topDistance < bottomDistance
        ? snapTargetYFromHorizontal - currentTop
        : snapTargetYFromHorizontal - currentBottom;
      adjustedY1 = clampCoordinate(movedLine.y1 + offset);
      adjustedY2 = clampCoordinate(movedLine.y2 + offset);
      snapTargetYFinal = snapTargetYFromHorizontal;
    } else {
      // 両方ある場合、より近い方を選択
      const distanceToVertical = Math.min(
        Math.abs(currentTop - snapTargetYFinal),
        Math.abs(currentBottom - snapTargetYFinal)
      );
      const distanceToHorizontal = Math.min(
        Math.abs(currentTop - snapTargetYFromHorizontal),
        Math.abs(currentBottom - snapTargetYFromHorizontal)
      );
      
      if (distanceToHorizontal < distanceToVertical) {
        const topDistance = Math.abs(currentTop - snapTargetYFromHorizontal);
        const bottomDistance = Math.abs(currentBottom - snapTargetYFromHorizontal);
        const offset = topDistance < bottomDistance
          ? snapTargetYFromHorizontal - currentTop
          : snapTargetYFromHorizontal - currentBottom;
        adjustedY1 = clampCoordinate(movedLine.y1 + offset);
        adjustedY2 = clampCoordinate(movedLine.y2 + offset);
        snapTargetYFinal = snapTargetYFromHorizontal;
      }
    }
  }

  // X方向のスナップ（他の垂直線と一直線上に並べる）
  const verticalLineXCoordinates = collectVerticalLineXCoordinates(marks, movedLine.id);
  const snapDistanceX = SNAP_DISTANCE_PX / canvasWidth;
  let minDistanceX = snapDistanceX;
  let snapTargetX: number | null = null;
  
  // 現在の垂直線のX座標（x1とx2は同じ）
  const currentX = movedLine.x1;
  
  verticalLineXCoordinates.forEach((xCoord) => {
    const distance = Math.abs(currentX - xCoord);
    if (distance < minDistanceX) {
      minDistanceX = distance;
      snapTargetX = xCoord;
    }
  });

  // X方向にスナップする場合、X座標を調整
  if (snapTargetX !== null) {
    const xOffset = snapTargetX - currentX;
    adjustedX1 = clampCoordinate(movedLine.x1 + xOffset);
    adjustedX2 = clampCoordinate(movedLine.x2 + xOffset);
  }

  // スナップガイドラインを設定（X方向とY方向の両方）
  const snapGuide: SnapGuide = { visible: true };
  if (snapTargetX !== null) {
    snapGuide.x = snapTargetX;
  }
  if (snapTargetYFinal !== null) {
    snapGuide.y = snapTargetYFinal;
  }

  const finalSnapGuide = (snapTargetX !== null || snapTargetYFinal !== null) ? snapGuide : null;

  return {
    adjustedLine: {
      ...movedLine,
      x1: adjustedX1,
      x2: adjustedX2,
      y1: adjustedY1,
      y2: adjustedY2,
    },
    snapGuide: finalSnapGuide,
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

  // 垂直線のX座標を収集してスナップ候補に追加
  const verticalLineXCoordinates = collectVerticalLineXCoordinates(marks, markId);
  const snapDistanceX = SNAP_DISTANCE_PX / canvasWidth;
  let minDistanceX = snapDistanceX;
  let snapTargetXFromVertical: number | null = null;
  
  verticalLineXCoordinates.forEach((xCoord) => {
    const distance = Math.abs(movedScore.x - xCoord);
    if (distance < minDistanceX) {
      minDistanceX = distance;
      snapTargetXFromVertical = xCoord;
    }
  });

  // 水平線のY座標を収集してスナップ候補に追加
  const horizontalLineYCoordinates = collectHorizontalLineYCoordinates(marks, markId);
  const snapDistanceY = SNAP_DISTANCE_PX / canvasHeight;
  let minDistanceY = snapDistanceY;
  let snapTargetYFromHorizontal: number | null = null;
  
  horizontalLineYCoordinates.forEach((yCoord) => {
    const distance = Math.abs(movedScore.y - yCoord);
    if (distance < minDistanceY) {
      minDistanceY = distance;
      snapTargetYFromHorizontal = yCoord;
    }
  });

  // スコア同士のスナップと垂直線・水平線のスナップを統合
  let finalSnappedX = snappedX;
  let finalSnappedY = snappedY;
  let finalSnapTargetX: number | null = null;
  let finalSnapTargetY: number | null = null;

  // X方向のスナップ判定（スコア同士と垂直線の両方を考慮）
  if (snapTargetX !== null && snapTargetXFromVertical !== null) {
    const distanceToScore = Math.abs(movedScore.x - snapTargetX);
    const distanceToVertical = Math.abs(movedScore.x - snapTargetXFromVertical);
    if (distanceToVertical < distanceToScore) {
      finalSnappedX = snapTargetXFromVertical;
      finalSnapTargetX = snapTargetXFromVertical;
    } else {
      finalSnappedX = snapTargetX;
      finalSnapTargetX = snapTargetX;
    }
  } else if (snapTargetXFromVertical !== null) {
    finalSnappedX = snapTargetXFromVertical;
    finalSnapTargetX = snapTargetXFromVertical;
  } else if (snapTargetX !== null) {
    finalSnappedX = snapTargetX;
    finalSnapTargetX = snapTargetX;
  }

  // Y方向のスナップ判定（スコア同士と水平線の両方を考慮）
  if (snapTargetY !== null && snapTargetYFromHorizontal !== null) {
    const distanceToScore = Math.abs(movedScore.y - snapTargetY);
    const distanceToHorizontal = Math.abs(movedScore.y - snapTargetYFromHorizontal);
    if (distanceToHorizontal < distanceToScore) {
      finalSnappedY = snapTargetYFromHorizontal;
      finalSnapTargetY = snapTargetYFromHorizontal;
    } else {
      finalSnappedY = snapTargetY;
      finalSnapTargetY = snapTargetY;
    }
  } else if (snapTargetYFromHorizontal !== null) {
    finalSnappedY = snapTargetYFromHorizontal;
    finalSnapTargetY = snapTargetYFromHorizontal;
  } else if (snapTargetY !== null) {
    finalSnappedY = snapTargetY;
    finalSnapTargetY = snapTargetY;
  }

  const finalSnapGuide =
    finalSnapTargetX !== null || finalSnapTargetY !== null
      ? {
          x: finalSnapTargetX !== null ? finalSnapTargetX : undefined,
          y: finalSnapTargetY !== null ? finalSnapTargetY : undefined,
          visible: true,
        }
      : null;

  return {
    adjustedScore: {
      ...movedScore,
      x: clampCoordinate(finalSnappedX),
      y: clampCoordinate(finalSnappedY),
    },
    snapGuide: finalSnapGuide,
  };
};

