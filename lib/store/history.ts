import { create } from "zustand";
import { Mark } from "@/lib/firebase/types";

export interface HistoryAction {
  type: "add" | "delete" | "update";
  markId: string;
  mark?: Mark; // 削除されたマークまたは変更前のマークの情報を保存（Undo用）
  updatedMark?: Mark; // 変更後のマークの情報を保存（Redo用、updateタイプの場合）
}

interface HistoryState {
  history: HistoryAction[];
  historyIndex: number; // 現在の履歴位置
  canUndo: boolean;
  canRedo: boolean;
  addAction: (action: HistoryAction) => void;
  undo: () => HistoryAction | null;
  redo: () => HistoryAction | null;
  reset: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  addAction: (action: HistoryAction) => {
    const { history, historyIndex } = get();
    // 現在位置より後ろの履歴を削除（新しい操作が追加された場合）
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(action);
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: newHistory.length > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) return null;

    const action = history[historyIndex];
    set({
      historyIndex: historyIndex - 1,
      canUndo: historyIndex - 1 >= 0,
      canRedo: true,
    });
    return action;
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex + 1 >= history.length) return null;

    const action = history[historyIndex + 1];
    set({
      historyIndex: historyIndex + 1,
      canUndo: true,
      canRedo: historyIndex + 2 < history.length,
    });
    return action;
  },

  reset: () => {
    set({
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
    });
  },
}));


