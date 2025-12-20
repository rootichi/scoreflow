import { LineMark, Mark, ScoreMark } from "@/lib/firebase/types";
import { SNAP_DISTANCE_PX, MIN_LINE_LENGTH } from "@/lib/constants";

export interface Coordinates {
  x: number;
  y: number;
}

export interface SnapResult {
  snappedX: number;
  snapTargetX: number | null;
  snapToLeft: boolean;
}

export interface VerticalSnapResult {
  snappedY: number;
  snapTargetY: number | null;
  snapToTop: boolean;
}

/**
 * 水平線の端点を取得（相対座標）
 */
export const getHorizontalLineEndpoints = (
  line: LineMark & { id: string }
): { left: number; right: number } => {
  return {
    left: Math.min(line.x1, line.x2),
    right: Math.max(line.x1, line.x2),
  };
};

/**
 * 線が水平かどうかを判定
 */
export const isHorizontalLine = (line: LineMark): boolean => {
  return Math.abs(line.x2 - line.x1) > Math.abs(line.y2 - line.y1);
};

/**
 * 線が垂直かどうかを判定
 */
export const isVerticalLine = (line: LineMark): boolean => {
  return Math.abs(line.y2 - line.y1) > Math.abs(line.x2 - line.x1);
};

/**
 * 既存の水平線の端点を収集
 */
export const collectHorizontalEndpoints = (
  marks: Array<Mark & { id: string }>,
  excludeMarkId?: string
): number[] => {
  const endpoints: number[] = [];
  marks
    .filter((m) => m.type === "line" && (!excludeMarkId || m.id !== excludeMarkId))
    .forEach((mark) => {
      const line = mark as LineMark & { id: string };
      if (isHorizontalLine(line)) {
        const lineEndpoints = getHorizontalLineEndpoints(line);
        endpoints.push(lineEndpoints.left, lineEndpoints.right);
      }
    });
  return endpoints;
};

/**
 * 垂直線の端点を取得（相対座標）
 */
export const getVerticalLineEndpoints = (
  line: LineMark & { id: string }
): { top: number; bottom: number } => {
  return {
    top: Math.min(line.y1, line.y2),
    bottom: Math.max(line.y1, line.y2),
  };
};

/**
 * 既存の垂直線の端点を収集
 */
export const collectVerticalEndpoints = (
  marks: Array<Mark & { id: string }>,
  excludeMarkId?: string
): number[] => {
  const endpoints: number[] = [];
  marks
    .filter((m) => m.type === "line" && (!excludeMarkId || m.id !== excludeMarkId))
    .forEach((mark) => {
      const line = mark as LineMark & { id: string };
      if (isVerticalLine(line)) {
        const lineEndpoints = getVerticalLineEndpoints(line);
        endpoints.push(lineEndpoints.top, lineEndpoints.bottom);
      }
    });
  return endpoints;
};

/**
 * 既存の水平線のY座標を収集（一直線上に並べるため）
 */
export const collectHorizontalLineYCoordinates = (
  marks: Array<Mark & { id: string }>,
  excludeMarkId?: string
): number[] => {
  const yCoordinates: number[] = [];
  marks
    .filter((m) => m.type === "line" && (!excludeMarkId || m.id !== excludeMarkId))
    .forEach((mark) => {
      const line = mark as LineMark & { id: string };
      if (isHorizontalLine(line)) {
        // 水平線のY座標（y1とy2は同じ）
        yCoordinates.push(line.y1);
      }
    });
  return yCoordinates;
};

/**
 * 既存の垂直線のX座標を収集（一直線上に並べるため）
 */
export const collectVerticalLineXCoordinates = (
  marks: Array<Mark & { id: string }>,
  excludeMarkId?: string
): number[] => {
  const xCoordinates: number[] = [];
  marks
    .filter((m) => m.type === "line" && (!excludeMarkId || m.id !== excludeMarkId))
    .forEach((mark) => {
      const line = mark as LineMark & { id: string };
      if (isVerticalLine(line)) {
        // 垂直線のX座標（x1とx2は同じ）
        xCoordinates.push(line.x1);
      }
    });
  return xCoordinates;
};

/**
 * スナップ位置を計算（ハンドルドラッグ用 - 水平線）
 */
export const findSnapPositionForHandle = (
  targetX: number,
  canvasWidth: number,
  marks: Array<Mark & { id: string }>,
  excludeMarkId: string
): { snappedX: number; snapTarget: number | null } => {
  const snapDistance = SNAP_DISTANCE_PX / canvasWidth;
  const existingEndpoints = collectHorizontalEndpoints(marks, excludeMarkId);

  let minDistance = snapDistance;
  let snapTarget: number | null = null;

  existingEndpoints.forEach((endpoint) => {
    const distance = Math.abs(targetX - endpoint);
    if (distance < minDistance) {
      minDistance = distance;
      snapTarget = endpoint;
    }
  });

  return {
    snappedX: snapTarget !== null ? snapTarget : targetX,
    snapTarget,
  };
};

/**
 * スナップ位置を計算（ハンドルドラッグ用 - 垂直線）
 */
export const findSnapPositionForHandleVertical = (
  targetY: number,
  canvasHeight: number,
  marks: Array<Mark & { id: string }>,
  excludeMarkId: string
): { snappedY: number; snapTarget: number | null } => {
  const snapDistance = SNAP_DISTANCE_PX / canvasHeight;
  const existingEndpoints = collectVerticalEndpoints(marks, excludeMarkId);

  let minDistance = snapDistance;
  let snapTarget: number | null = null;

  existingEndpoints.forEach((endpoint) => {
    const distance = Math.abs(targetY - endpoint);
    if (distance < minDistance) {
      minDistance = distance;
      snapTarget = endpoint;
    }
  });

  return {
    snappedY: snapTarget !== null ? snapTarget : targetY,
    snapTarget,
  };
};

/**
 * スナップ位置を計算（描画・ドラッグ用）
 */
export const findSnapPosition = (
  currentX: number,
  currentY: number,
  canvasWidth: number,
  marks: Array<Mark & { id: string }>,
  isDrawing: boolean,
  lineStart: Coordinates | null,
  draggingLine: (LineMark & { id: string }) | null
): SnapResult => {
  const snapDistance = SNAP_DISTANCE_PX / canvasWidth;
  
  // 現在操作中の水平線の端点を取得
  let currentLineEndpoints: { left: number; right: number } | null = null;
  
  if (isDrawing && lineStart) {
    const dx = Math.abs(currentX - lineStart.x);
    const dy = Math.abs(currentY - lineStart.y);
    if (dx > dy) {
      currentLineEndpoints = {
        left: Math.min(lineStart.x, currentX),
        right: Math.max(lineStart.x, currentX),
      };
    }
  } else if (draggingLine && isHorizontalLine(draggingLine)) {
    currentLineEndpoints = getHorizontalLineEndpoints(draggingLine);
  }
  
  if (!currentLineEndpoints) {
    return { snappedX: currentX, snapTargetX: null, snapToLeft: false };
  }
  
  // 既存の水平線の端点を収集
  const existingEndpoints = collectHorizontalEndpoints(
    marks,
    draggingLine?.id
  );
  
  // 垂直線のX座標もスナップ候補に追加
  const verticalLineXCoordinates = collectVerticalLineXCoordinates(
    marks,
    draggingLine?.id
  );
  
  // すべてのスナップ候補を統合
  const allSnapTargets: number[] = [...existingEndpoints, ...verticalLineXCoordinates];
  
  // 左端と右端を別々に判定
  let leftMinDistance = snapDistance;
  let leftSnapTarget: number | null = null;
  let rightMinDistance = snapDistance;
  let rightSnapTarget: number | null = null;
  
  allSnapTargets.forEach((target) => {
    const leftDistance = Math.abs(currentLineEndpoints!.left - target);
    const rightDistance = Math.abs(currentLineEndpoints!.right - target);
    
    if (leftDistance < leftMinDistance) {
      leftMinDistance = leftDistance;
      leftSnapTarget = target;
    }
    if (rightDistance < rightMinDistance) {
      rightMinDistance = rightDistance;
      rightSnapTarget = target;
    }
  });
  
  // より近い方を選択
  let snapTarget: number | null = null;
  let snapToLeft: boolean = false;
  
  if (leftSnapTarget !== null && rightSnapTarget !== null) {
    if (leftMinDistance < rightMinDistance) {
      snapTarget = leftSnapTarget;
      snapToLeft = true;
    } else {
      snapTarget = rightSnapTarget;
      snapToLeft = false;
    }
  } else if (leftSnapTarget !== null) {
    snapTarget = leftSnapTarget;
    snapToLeft = true;
  } else if (rightSnapTarget !== null) {
    snapTarget = rightSnapTarget;
    snapToLeft = false;
  }
  
  if (snapTarget !== null) {
    const offset = snapToLeft
      ? snapTarget - currentLineEndpoints.left
      : snapTarget - currentLineEndpoints.right;
    return {
      snappedX: currentX + offset,
      snapTargetX: snapTarget,
      snapToLeft,
    };
  }
  
  return { snappedX: currentX, snapTargetX: null, snapToLeft: false };
};

/**
 * スナップ位置を計算（描画・ドラッグ用 - 垂直線）
 */
export const findSnapPositionVertical = (
  currentX: number,
  currentY: number,
  canvasHeight: number,
  marks: Array<Mark & { id: string }>,
  isDrawing: boolean,
  lineStart: Coordinates | null,
  draggingLine: (LineMark & { id: string }) | null
): VerticalSnapResult => {
  const snapDistance = SNAP_DISTANCE_PX / canvasHeight;
  
  // 現在操作中の垂直線の端点を取得
  let currentLineEndpoints: { top: number; bottom: number } | null = null;
  
  if (isDrawing && lineStart) {
    const dx = Math.abs(currentX - lineStart.x);
    const dy = Math.abs(currentY - lineStart.y);
    if (dy > dx) {
      currentLineEndpoints = {
        top: Math.min(lineStart.y, currentY),
        bottom: Math.max(lineStart.y, currentY),
      };
    }
  } else if (draggingLine && isVerticalLine(draggingLine)) {
    currentLineEndpoints = getVerticalLineEndpoints(draggingLine);
  }
  
  if (!currentLineEndpoints) {
    return { snappedY: currentY, snapTargetY: null, snapToTop: false };
  }
  
  // 既存の垂直線の端点を収集
  const existingEndpoints = collectVerticalEndpoints(
    marks,
    draggingLine?.id
  );
  
  // 水平線のY座標もスナップ候補に追加
  const horizontalLineYCoordinates = collectHorizontalLineYCoordinates(
    marks,
    draggingLine?.id
  );
  
  // すべてのスナップ候補を統合
  const allSnapTargets: number[] = [...existingEndpoints, ...horizontalLineYCoordinates];
  
  // 上端と下端を別々に判定
  let topMinDistance = snapDistance;
  let topSnapTarget: number | null = null;
  let bottomMinDistance = snapDistance;
  let bottomSnapTarget: number | null = null;
  
  allSnapTargets.forEach((target) => {
    const topDistance = Math.abs(currentLineEndpoints!.top - target);
    const bottomDistance = Math.abs(currentLineEndpoints!.bottom - target);
    
    if (topDistance < topMinDistance) {
      topMinDistance = topDistance;
      topSnapTarget = target;
    }
    if (bottomDistance < bottomMinDistance) {
      bottomMinDistance = bottomDistance;
      bottomSnapTarget = target;
    }
  });
  
  // より近い方を選択
  let snapTarget: number | null = null;
  let snapToTop: boolean = false;
  
  if (topSnapTarget !== null && bottomSnapTarget !== null) {
    if (topMinDistance < bottomMinDistance) {
      snapTarget = topSnapTarget;
      snapToTop = true;
    } else {
      snapTarget = bottomSnapTarget;
      snapToTop = false;
    }
  } else if (topSnapTarget !== null) {
    snapTarget = topSnapTarget;
    snapToTop = true;
  } else if (bottomSnapTarget !== null) {
    snapTarget = bottomSnapTarget;
    snapToTop = false;
  }
  
  if (snapTarget !== null) {
    const offset = snapToTop
      ? snapTarget - currentLineEndpoints.top
      : snapTarget - currentLineEndpoints.bottom;
    return {
      snappedY: currentY + offset,
      snapTargetY: snapTarget,
      snapToTop,
    };
  }
  
  return { snappedY: currentY, snapTargetY: null, snapToTop: false };
};

/**
 * スコア用のスナップ位置を計算（中心座標で判定）
 */
export interface ScoreSnapResult {
  snappedX: number;
  snappedY: number;
  snapTargetX: number | null;
  snapTargetY: number | null;
}

export const findSnapPositionForScore = (
  currentX: number,
  currentY: number,
  canvasWidth: number,
  canvasHeight: number,
  marks: Array<Mark & { id: string }>,
  excludeMarkId?: string
): ScoreSnapResult => {
  const snapDistanceX = SNAP_DISTANCE_PX / canvasWidth;
  const snapDistanceY = SNAP_DISTANCE_PX / canvasHeight;
  
  // X座標のスナップ候補を収集（スコアのみ）
  const xSnapTargets: number[] = [];
  // 他のスコアの中心X座標
  marks
    .filter((m) => m.type === "score" && (!excludeMarkId || m.id !== excludeMarkId))
    .forEach((mark) => {
      const scoreMark = mark as ScoreMark & { id: string };
      xSnapTargets.push(scoreMark.x);
    });
  
  // Y座標のスナップ候補を収集（スコアのみ）
  const ySnapTargets: number[] = [];
  // 他のスコアの中心Y座標
  marks
    .filter((m) => m.type === "score" && (!excludeMarkId || m.id !== excludeMarkId))
    .forEach((mark) => {
      const scoreMark = mark as ScoreMark & { id: string };
      ySnapTargets.push(scoreMark.y);
    });
  
  // X座標のスナップ判定
  let minDistanceX = snapDistanceX;
  let snapTargetX: number | null = null;
  xSnapTargets.forEach((target) => {
    const distance = Math.abs(currentX - target);
    if (distance < minDistanceX) {
      minDistanceX = distance;
      snapTargetX = target;
    }
  });
  
  // Y座標のスナップ判定
  let minDistanceY = snapDistanceY;
  let snapTargetY: number | null = null;
  ySnapTargets.forEach((target) => {
    const distance = Math.abs(currentY - target);
    if (distance < minDistanceY) {
      minDistanceY = distance;
      snapTargetY = target;
    }
  });
  
  return {
    snappedX: snapTargetX !== null ? snapTargetX : currentX,
    snappedY: snapTargetY !== null ? snapTargetY : currentY,
    snapTargetX,
    snapTargetY,
  };
};

/**
 * 座標を0-1の範囲に制限
 */
export const clampCoordinate = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

/**
 * 線の長さが最小値以上かチェック
 */
export const isValidLineLength = (
  start: Coordinates,
  end: Coordinates
): boolean => {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx >= MIN_LINE_LENGTH || dy >= MIN_LINE_LENGTH;
};

