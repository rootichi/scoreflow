"use client";

import { EditMode } from "@/lib/types/canvas";
import { Mark, LineMark, ScoreMark } from "@/lib/firebase/types";
import { Timestamp } from "firebase/firestore";
import { addMark, deleteMark } from "@/lib/firebase/tournaments";
import { showPrompt } from "@/lib/utils/notification";
import { COPY_OFFSET } from "@/lib/constants";

interface EditToolbarProps {
  mode: EditMode;
  scoreValue: string;
  selectedMarkId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  marks: Array<Mark & { id: string }>;
  tournamentId: string;
  isDrawing: boolean;
  onModeChange: (mode: EditMode) => void;
  onScoreValueChange: (value: string) => void;
  onSelectedMarkIdChange: (id: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddAction: (action: any) => void;
  onSetCopiedMark: (mark: Mark & { id: string } | null) => void;
  onSetDrawing: (drawing: boolean) => void;
  onSetLineStart: (start: { x: number; y: number } | null) => void;
  onSetLineEnd: (end: { x: number; y: number } | null) => void;
  onEditModeEndDrawing: () => void;
  onEditModeStartDrawing: () => void;
  onEditModeResetToPan: () => void;
  onEditModeSelectObject: (id: string) => void;
}

export function EditToolbar({
  mode,
  scoreValue,
  selectedMarkId,
  canUndo,
  canRedo,
  marks,
  tournamentId,
  isDrawing,
  onModeChange,
  onScoreValueChange,
  onSelectedMarkIdChange,
  onUndo,
  onRedo,
  onAddAction,
  onSetCopiedMark,
  onSetDrawing,
  onSetLineStart,
  onSetLineEnd,
  onEditModeEndDrawing,
  onEditModeStartDrawing,
  onEditModeResetToPan,
  onEditModeSelectObject,
}: EditToolbarProps) {
  const handleLineModeToggle = () => {
    if (mode === "line") {
      onModeChange(null);
      onEditModeEndDrawing();
    } else {
      onModeChange("line");
      onEditModeStartDrawing();
    }
    onSetDrawing(false);
    onSetLineStart(null);
    onSetLineEnd(null);
  };

  const handleScoreModeToggle = () => {
    if (mode === "score") {
      onModeChange(null);
      onEditModeEndDrawing();
    } else {
      onModeChange("score");
      onEditModeStartDrawing();
      const value = showPrompt("スコアを入力してください:");
      if (value) {
        onScoreValueChange(value);
      } else {
        onModeChange(null);
        onEditModeEndDrawing();
      }
    }
  };

  const handleDelete = async () => {
    if (selectedMarkId) {
      const mark = marks.find((m) => m.id === selectedMarkId);
      if (mark) {
        await deleteMark(tournamentId, selectedMarkId);
        onAddAction({
          type: "delete",
          markId: selectedMarkId,
          mark,
        });
        onSelectedMarkIdChange(null);
        onEditModeResetToPan();
      }
    }
  };

  const handleCopy = async () => {
    if (selectedMarkId) {
      const mark = marks.find((m) => m.id === selectedMarkId);
      if (mark) {
        onSetCopiedMark(mark);
        // コピーと同時に貼り付けも実行
        const markData = {
          type: mark.type,
          pageNumber: mark.pageNumber,
          ...(mark.type === "line"
            ? {
                x1: (mark as LineMark).x1 + COPY_OFFSET,
                y1: (mark as LineMark).y1 + COPY_OFFSET,
                x2: (mark as LineMark).x2 + COPY_OFFSET,
                y2: (mark as LineMark).y2 + COPY_OFFSET,
                color: mark.color,
              }
            : {
                x: (mark as ScoreMark).x + COPY_OFFSET,
                y: (mark as ScoreMark).y + COPY_OFFSET,
                value: (mark as ScoreMark).value,
                fontSize: (mark as ScoreMark).fontSize,
                color: mark.color,
              }),
        };
        const newMarkId = await addMark(tournamentId, markData);
        onAddAction({
          type: "add",
          markId: newMarkId,
          mark: {
            ...markData,
            createdAt: Timestamp.now(),
          } as Mark,
        });
        onSelectedMarkIdChange(newMarkId);
        onEditModeSelectObject(newMarkId);
      }
    }
  };

  const buttonBaseClass = "p-2 rounded-lg transition flex-shrink-0";
  const undoButtonClass = `${buttonBaseClass} ${
    canUndo
      ? "bg-gray-600 text-white hover:bg-gray-700"
      : "bg-gray-200 text-gray-400 cursor-not-allowed"
  }`;
  const redoButtonClass = `${buttonBaseClass} ${
    canRedo
      ? "bg-gray-600 text-white hover:bg-gray-700"
      : "bg-gray-200 text-gray-400 cursor-not-allowed"
  }`;
  const lineButtonClass = `${buttonBaseClass} ${
    mode === "line"
      ? "bg-red-600 text-white"
      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
  }`;
  const scoreButtonClass = `${buttonBaseClass} ${
    mode === "score"
      ? "bg-blue-600 text-white"
      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
  }`;
  const deleteButtonClass = `${buttonBaseClass} ${
    selectedMarkId
      ? "bg-red-50 text-red-600 hover:bg-red-100"
      : "bg-red-50/30 text-red-600/30"
  }`;
  const copyButtonClass = `${buttonBaseClass} ${
    selectedMarkId
      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
      : "bg-blue-50/30 text-blue-600/30"
  }`;

  return (
    <div className="fixed top-[calc(4rem+3rem)] left-0 right-0 z-30 bg-white border-b border-gray-200" style={{ touchAction: "pan-x pan-y manipulation" }}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="bg-white">
          {/* スマホ版 */}
          <div className="md:hidden overflow-x-auto">
            <div className="flex items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2 min-w-max">
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={undoButtonClass}
                  title="元に戻す"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className={redoButtonClass}
                  title="やり直す"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
                <div className="border-l border-gray-300 h-6 mx-1"></div>
                <button
                  onClick={handleLineModeToggle}
                  className={lineButtonClass}
                  title="ライン追加"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12l4-4m-4 4l4 4" />
                  </svg>
                </button>
                <button
                  onClick={handleScoreModeToggle}
                  className={scoreButtonClass}
                  title="スコア追加"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2 min-w-max">
                <button
                  onClick={handleDelete}
                  disabled={!selectedMarkId}
                  className={deleteButtonClass}
                  type="button"
                  title="削除"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!selectedMarkId}
                  className={copyButtonClass}
                  type="button"
                  title="コピー&貼り付け"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            {/* ステータス表示（スマホ版） */}
            {(mode === "line" && isDrawing) && (
              <div className="px-2 pb-2">
                <span className="text-xs text-gray-600">ドラッグして線を描画</span>
              </div>
            )}
            {mode === "score" && scoreValue && (
              <div className="px-2 pb-2">
                <span className="text-xs text-gray-600">スコア: {scoreValue} - 配置位置をタップ</span>
              </div>
            )}
          </div>

          {/* PC版 */}
          <div className="hidden md:flex justify-between items-center gap-2 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={undoButtonClass}
                title="元に戻す (Ctrl+Z)"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={redoButtonClass}
                title="やり直す (Ctrl+Y)"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <div className="border-l border-gray-300 h-6 mx-1"></div>
              <button
                onClick={handleLineModeToggle}
                className={lineButtonClass}
                title="ライン追加"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12l4-4m-4 4l4 4" />
                </svg>
              </button>
              <button
                onClick={handleScoreModeToggle}
                className={scoreButtonClass}
                title="スコア追加"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={!selectedMarkId}
                className={deleteButtonClass}
                type="button"
                title="削除"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={handleCopy}
                disabled={!selectedMarkId}
                className={copyButtonClass}
                type="button"
                title="コピー&貼り付け"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

