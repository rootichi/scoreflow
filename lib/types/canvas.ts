import { Mark, LineMark, ScoreMark } from "@/lib/firebase/types";

/**
 * ドラッグ中のマーク情報
 */
export interface DraggingMark {
  id: string;
  type: "line" | "score";
  startX: number;
  startY: number;
  originalMark: Mark & { id: string };
}

/**
 * ドラッグ中のハンドル情報
 */
export interface DraggingHandle {
  markId: string;
  handle: "start" | "end";
  startX: number;
  startY: number;
  originalMark: LineMark & { id: string };
}

/**
 * スナップガイド情報
 */
export interface SnapGuide {
  x?: number;
  y?: number;
  visible: boolean;
}

/**
 * 編集モード
 */
export type EditMode = "line" | "score" | null;

