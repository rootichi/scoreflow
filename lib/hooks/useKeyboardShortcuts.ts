import { useEffect } from "react";
import { Mark, LineMark, ScoreMark } from "@/lib/firebase/types";
import { Timestamp } from "firebase/firestore";
import { COPY_OFFSET } from "@/lib/constants";
import { addMark, deleteMark } from "@/lib/firebase/tournaments";

interface UseKeyboardShortcutsParams {
  selectedMarkId: string | null;
  marks: Array<Mark & { id: string }>;
  tournamentId: string;
  copiedMark: (Mark & { id: string }) | null;
  setCopiedMark: (mark: (Mark & { id: string }) | null) => void;
  setSelectedMarkId: (id: string | null) => void;
  addAction: (action: any) => void;
  handleUndo: () => Promise<void>;
  handleRedo: () => Promise<void>;
}

/**
 * キーボードショートカットを処理するカスタムフック
 */
export function useKeyboardShortcuts({
  selectedMarkId,
  marks,
  tournamentId,
  copiedMark,
  setCopiedMark,
  setSelectedMarkId,
  addAction,
  handleUndo,
  handleRedo,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl/Cmd + Zで元に戻す（選択状態に関係なく動作）
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        await handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z または Ctrl/Cmd + Yでやり直す
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        await handleRedo();
        return;
      }

      // 以下は選択中のマークがある場合のみ動作
      if (!selectedMarkId) return;

      // Delete/Backspaceキーで削除
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const mark = marks.find((m) => m.id === selectedMarkId);
        if (mark) {
          await deleteMark(tournamentId, selectedMarkId);
          addAction({
            type: "delete",
            markId: selectedMarkId,
            mark,
          });
          setSelectedMarkId(null);
        }
      }

      // Ctrl/Cmd + Cでコピー
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        const mark = marks.find((m) => m.id === selectedMarkId);
        if (mark) {
          setCopiedMark(mark);
        }
      }

      // Ctrl/Cmd + Vで貼り付け
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        if (copiedMark && selectedMarkId) {
          const markData = {
            type: copiedMark.type,
            pageNumber: copiedMark.pageNumber,
            ...(copiedMark.type === "line"
              ? {
                  x1: (copiedMark as LineMark).x1 + COPY_OFFSET,
                  y1: (copiedMark as LineMark).y1 + COPY_OFFSET,
                  x2: (copiedMark as LineMark).x2 + COPY_OFFSET,
                  y2: (copiedMark as LineMark).y2 + COPY_OFFSET,
                  color: copiedMark.color,
                }
              : {
                  x: (copiedMark as ScoreMark).x + COPY_OFFSET,
                  y: (copiedMark as ScoreMark).y + COPY_OFFSET,
                  value: (copiedMark as ScoreMark).value,
                  fontSize: (copiedMark as ScoreMark).fontSize,
                  color: copiedMark.color,
                }),
          };
          const newMarkId = await addMark(tournamentId, markData);
          addAction({
            type: "add",
            markId: newMarkId,
            mark: {
              ...markData,
              createdAt: Timestamp.now(),
            } as Mark,
          });
          setSelectedMarkId(newMarkId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedMarkId,
    marks,
    tournamentId,
    copiedMark,
    setCopiedMark,
    setSelectedMarkId,
    addAction,
    handleUndo,
    handleRedo,
  ]);
}

