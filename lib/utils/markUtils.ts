import { Mark, LineMark, ScoreMark } from "@/lib/firebase/types";
import { updateMark } from "@/lib/firebase/tournaments";
import { clampCoordinate } from "./canvasUtils";

/**
 * マークの更新データを作成
 */
export const createMarkUpdateData = (
  mark: Mark & { id: string }
): Partial<Omit<Mark, "createdAt">> => {
  if (mark.type === "line") {
    const lineMark = mark as LineMark & { id: string };
    return {
      type: "line" as const,
      pageNumber: lineMark.pageNumber,
      x1: lineMark.x1,
      y1: lineMark.y1,
      x2: lineMark.x2,
      y2: lineMark.y2,
      color: lineMark.color,
    } as Partial<Omit<LineMark, "createdAt">>;
  } else {
    const scoreMark = mark as ScoreMark & { id: string };
    return {
      type: "score" as const,
      pageNumber: scoreMark.pageNumber,
      x: scoreMark.x,
      y: scoreMark.y,
      value: scoreMark.value,
      fontSize: scoreMark.fontSize,
      color: scoreMark.color,
    } as Partial<Omit<ScoreMark, "createdAt">>;
  }
};

/**
 * マークを更新（エラーハンドリング付き）
 */
export const updateMarkSafely = async (
  tournamentId: string,
  markId: string,
  updates: Partial<Omit<Mark, "createdAt">>
): Promise<boolean> => {
  try {
    await updateMark(tournamentId, markId, updates);
    return true;
  } catch (error) {
    console.error("Error updating mark:", error);
    return false;
  }
};

/**
 * マークの座標を更新（ドラッグ用）
 */
export const updateMarkCoordinates = (
  mark: Mark & { id: string },
  dx: number,
  dy: number
): Mark & { id: string } => {
  if (mark.type === "line") {
    const lineMark = mark as LineMark & { id: string };
    return {
      ...lineMark,
      x1: clampCoordinate(lineMark.x1 + dx),
      y1: clampCoordinate(lineMark.y1 + dy),
      x2: clampCoordinate(lineMark.x2 + dx),
      y2: clampCoordinate(lineMark.y2 + dy),
    };
  } else {
    const scoreMark = mark as ScoreMark & { id: string };
    return {
      ...scoreMark,
      x: clampCoordinate(scoreMark.x + dx),
      y: clampCoordinate(scoreMark.y + dy),
    };
  }
};

