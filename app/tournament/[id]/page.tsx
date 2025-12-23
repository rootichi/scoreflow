"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase/auth";
import { getTournament, addMark, deleteMark, updateMark, subscribeMarks, deleteTournament } from "@/lib/firebase/tournaments";
import { Tournament, Mark, LineMark, ScoreMark } from "@/lib/firebase/types";
import { Timestamp } from "firebase/firestore";
import { useHistoryStore } from "@/lib/store/history";
import {
  isHorizontalLine,
  isVerticalLine,
  findSnapPosition,
  findSnapPositionVertical,
  clampCoordinate,
  isValidLineLength,
} from "@/lib/utils/canvasUtils";
import {
  handleHorizontalHandleSnap,
  handleVerticalHandleSnap,
  handleHorizontalLineDragSnap,
  handleVerticalLineDragSnap,
  handleScoreDragSnap,
} from "@/lib/utils/snapUtils";
import { createMarkUpdateData, updateMarkSafely, updateMarkCoordinates } from "@/lib/utils/markUtils";
import { getPublicUrl, copyToClipboard } from "@/lib/utils/url";
import { showError, showSuccess, showPrompt, showConfirm } from "@/lib/utils/notification";
import {
  DEFAULT_LINE_COLOR,
  DEFAULT_SCORE_COLOR,
  DEFAULT_SCORE_FONT_SIZE,
  DEFAULT_PAGE_NUMBER,
  MIN_LINE_LENGTH,
  COPY_OFFSET,
  SELECTED_COLOR,
  SNAP_GUIDE_COLOR,
  SNAP_GUIDE_STROKE_WIDTH,
  SNAP_GUIDE_OPACITY,
  HANDLE_RADIUS,
  HANDLE_STROKE_WIDTH,
} from "@/lib/constants";

export default function TournamentEditPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const [user, loading] = useAuthState(auth!);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [marks, setMarks] = useState<Array<Mark & { id: string }>>([]);
  const [mode, setMode] = useState<"line" | "score" | null>(null);
  const [scoreValue, setScoreValue] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [lineEnd, setLineEnd] = useState<{ x: number; y: number } | null>(null);
  const { addAction, undo, redo, canUndo, canRedo, reset } = useHistoryStore();
  const [draggingMark, setDraggingMark] = useState<{ id: string; type: "line" | "score"; startX: number; startY: number; originalMark: Mark & { id: string } } | null>(null);
  const [localMarks, setLocalMarks] = useState<Array<Mark & { id: string }>>([]);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{ markId: string; handle: "start" | "end"; startX: number; startY: number; originalMark: LineMark & { id: string } } | null>(null);
  const [copiedMark, setCopiedMark] = useState<Mark & { id: string } | null>(null);
  const [snapGuide, setSnapGuide] = useState<{ x?: number; y?: number; visible: boolean } | null>(null); // スナップガイドライン（x: 垂直線、y: 水平線）
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null); // タッチ開始位置（スクロール判定用）
  const [isTouchDragging, setIsTouchDragging] = useState(false); // タッチドラッグ中かどうか
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageScale, setImageScale] = useState(1);

  useEffect(() => {
    if (!user || !tournamentId) return;

    const loadTournament = async () => {
      try {
      const data = await getTournament(tournamentId);
      if (!data) {
          showError("大会が見つかりません");
        router.push("/");
        return;
      }
      if (data.createdBy !== user.uid) {
          showError("この大会を編集する権限がありません");
        router.push("/");
        return;
      }
      setTournament(data);
      } catch (error) {
        console.error("Error loading tournament:", error);
        showError("大会の読み込みに失敗しました");
        router.push("/");
      }
    };

    loadTournament();
  }, [user, tournamentId, router]);

  useEffect(() => {
    if (!tournamentId) return;

    // 大会読み込み時に履歴をリセット
    reset();

    const unsubscribe = subscribeMarks(tournamentId, (updatedMarks) => {
      setMarks(updatedMarks);
      setLocalMarks(updatedMarks);
    });

    return () => unsubscribe();
  }, [tournamentId, reset]);

  // 画像スケール計算
  const calculateImageScale = useCallback(() => {
    if (imageContainerRef.current) {
      const imgElement = imageContainerRef.current.querySelector('img');
      if (imgElement && imgElement.naturalWidth && imgElement.offsetWidth) {
        setImageScale(imgElement.offsetWidth / imgElement.naturalWidth);
      }
    }
  }, []);

  useEffect(() => {
    if (tournament) {
      calculateImageScale();
      window.addEventListener('resize', calculateImageScale);
      const imgElement = imageContainerRef.current?.querySelector('img');
      if (imgElement) {
        imgElement.onload = calculateImageScale;
      }
    }
    return () => {
      window.removeEventListener('resize', calculateImageScale);
    };
  }, [tournament, calculateImageScale]);

  const getRelativeCoordinates = useCallback((
    e: React.MouseEvent<HTMLDivElement> | MouseEvent | React.TouchEvent<HTMLDivElement> | TouchEvent
  ): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    // タッチイベントの場合
    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
      };
    }
    
    // タッチ終了イベントの場合（changedTouchesから取得）
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) / rect.width,
        y: (touch.clientY - rect.top) / rect.height,
      };
    }
    
    // マウスイベントの場合
    if ('clientX' in e && 'clientY' in e) {
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    }
    
    return { x: 0, y: 0 };
  }, []);



  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const coords = getRelativeCoordinates(e);
    
    if (mode === "line" && isDrawing && lineStart) {
      // 水平/垂直の制限：より近い方向を選択
      const dx = Math.abs(coords.x - lineStart.x);
      const dy = Math.abs(coords.y - lineStart.y);
      
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        
        if (dx > dy) {
          // 水平線：スナップ処理
          const { snappedX, snapTargetX } = findSnapPosition(
            coords.x,
            coords.y,
            rect.width,
            marks,
            true,
            lineStart,
            null
          );
          setLineEnd({ x: snappedX, y: lineStart.y });
          if (snapTargetX !== null) {
            setSnapGuide({ x: snapTargetX, visible: true });
          } else {
            setSnapGuide(null);
          }
        } else {
          // 垂直線：スナップ処理
          const { snappedY, snapTargetY } = findSnapPositionVertical(
            coords.x,
            coords.y,
            rect.height,
            marks,
            true,
            lineStart,
            null
          );
          setLineEnd({ x: lineStart.x, y: snappedY });
          if (snapTargetY !== null) {
            setSnapGuide({ y: snapTargetY, visible: true });
          } else {
            setSnapGuide(null);
          }
        }
      }
    } else if (draggingHandle) {
      // ハンドルをドラッグ中：線の長さを調整
      const dx = coords.x - draggingHandle.startX;
      const dy = coords.y - draggingHandle.startY;
      const original = draggingHandle.originalMark;
      const isHorizontal = isHorizontalLine(original);
      
      let newX1 = original.x1;
      let newY1 = original.y1;
      let newX2 = original.x2;
      let newY2 = original.y2;
      
      if (!canvasRef.current) {
        setLocalMarks(localMarks);
        return;
      }
      
      const rect = canvasRef.current.getBoundingClientRect();
      
      if (draggingHandle.handle === "start") {
        // 開始点を移動（終了点は固定）
        if (isHorizontal) {
          const targetX = clampCoordinate(original.x1 + dx);
          const { snappedX, snapGuide: guide } = handleHorizontalHandleSnap(
            targetX,
            rect.width,
            marks,
            draggingHandle.markId
          );
          newX1 = snappedX;
          newY1 = original.y1;
          setSnapGuide(guide);
        } else {
          const targetY = clampCoordinate(original.y1 + dy);
          const { snappedY, snapGuide: guide } = handleVerticalHandleSnap(
            targetY,
            rect.height,
            marks,
            draggingHandle.markId
          );
          newX1 = original.x1;
          newY1 = snappedY;
          setSnapGuide(guide);
        }
      } else {
        // 終了点を移動（開始点は固定）
        if (isHorizontal) {
          const targetX = clampCoordinate(original.x2 + dx);
          const { snappedX, snapGuide: guide } = handleHorizontalHandleSnap(
            targetX,
            rect.width,
            marks,
            draggingHandle.markId
          );
          newX2 = snappedX;
          newY2 = original.y2;
          setSnapGuide(guide);
        } else {
          const targetY = clampCoordinate(original.y2 + dy);
          const { snappedY, snapGuide: guide } = handleVerticalHandleSnap(
            targetY,
            rect.height,
            marks,
            draggingHandle.markId
          );
          newX2 = original.x2;
          newY2 = snappedY;
          setSnapGuide(guide);
        }
      }
      
      const updatedMarks = localMarks.map((m) => {
        if (m.id === draggingHandle.markId && m.type === "line") {
          return {
            ...m,
            x1: newX1,
            y1: newY1,
            x2: newX2,
            y2: newY2,
          } as Mark & { id: string };
        }
        return m;
      });
      setLocalMarks(updatedMarks);
    } else if (draggingMark) {
      // ドラッグ中のマークをローカル状態で更新
      const dx = coords.x - draggingMark.startX;
      const dy = coords.y - draggingMark.startY;
      
      const updatedMarks = localMarks.map((m) => {
        if (m.id === draggingMark.id) {
            if (draggingMark.type === "line") {
              const original = draggingMark.originalMark as LineMark & { id: string };
              
              if (isHorizontalLine(original)) {
                const movedLine = updateMarkCoordinates(original, dx, dy) as LineMark & { id: string };
                if (canvasRef.current) {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const { adjustedLine, snapGuide: guide } = handleHorizontalLineDragSnap(
                    coords,
                    rect.width,
                    rect.height,
                    marks,
                    movedLine
                  );
                  setSnapGuide(guide);
                  return {
                    ...m,
                    ...adjustedLine,
                  } as Mark & { id: string };
                }
                return movedLine;
              } else if (isVerticalLine(original)) {
                const movedLine = updateMarkCoordinates(original, dx, dy) as LineMark & { id: string };
                if (canvasRef.current) {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const { adjustedLine, snapGuide: guide } = handleVerticalLineDragSnap(
                    coords,
                    rect.width,
                    rect.height,
                    marks,
                    movedLine
                  );
                  setSnapGuide(guide);
                  return {
                    ...m,
                    ...adjustedLine,
                  } as Mark & { id: string };
                }
                return movedLine;
              } else {
                setSnapGuide(null);
                return updateMarkCoordinates(original, dx, dy);
              }
          } else {
            const original = draggingMark.originalMark as ScoreMark & { id: string };
            const movedScore = updateMarkCoordinates(original, dx, dy) as ScoreMark & { id: string };
            
            if (canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const { adjustedScore, snapGuide: guide } = handleScoreDragSnap(
                movedScore,
                rect.width,
                rect.height,
                marks,
                draggingMark.id
              );
              setSnapGuide(guide);
              return {
                ...m,
                ...adjustedScore,
              } as Mark & { id: string };
            }
            
            return movedScore;
          }
        }
        return m;
      });
      setLocalMarks(updatedMarks);
    } else {
      setSnapGuide(null);
    }
  }, [
    mode,
    isDrawing,
    lineStart,
    draggingHandle,
    draggingMark,
    marks,
    localMarks,
    getRelativeCoordinates,
  ]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleCanvasMove(e);
  }, [handleCanvasMove]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPos) {
      // タッチ開始位置がない場合でも、編集操作中は処理を続行
      if (isDrawing || draggingHandle || draggingMark) {
        e.preventDefault();
        handleCanvasMove(e);
      }
      return;
    }
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    const SCROLL_THRESHOLD = 10; // px
    
    // 編集操作と判定された場合のみpreventDefault
    if (isDrawing || draggingHandle || draggingMark || deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) {
      e.preventDefault();
      setIsTouchDragging(true);
      handleCanvasMove(e);
    }
  }, [touchStartPos, isDrawing, draggingHandle, draggingMark, handleCanvasMove]);

  // Undo/Redo処理を先に定義（useEffectで使用するため）
  const handleUndo = useCallback(async () => {
    const action = undo();
    if (!action) return;

    if (action.type === "add") {
      // 追加を元に戻す = 削除
      // 削除前にマーク情報を取得して履歴に保存
      const mark = marks.find((m) => m.id === action.markId);
      if (mark) {
        // 履歴を更新してマーク情報を保存（Redo用）
        const { history, historyIndex } = useHistoryStore.getState();
        const updatedHistory = [...history];
        if (updatedHistory[historyIndex + 1]) {
          updatedHistory[historyIndex + 1].mark = mark;
        }
        useHistoryStore.setState({ history: updatedHistory });
      }
      await deleteMark(tournamentId, action.markId);
    } else if (action.type === "delete" && action.mark) {
      // 削除を元に戻す = 追加
      const markId = await addMark(tournamentId, action.mark);
      // 履歴を更新（Redo用）
      addAction({
        type: "add",
        markId,
        mark: action.mark,
      });
    } else if (action.type === "update" && action.mark && action.updatedMark) {
      // 更新を元に戻す = 変更前の状態に戻す
      // 現在のマーク状態を保存（Redo用）
      const currentMark = marks.find((m) => m.id === action.markId);
      if (currentMark) {
        // 履歴を更新して現在の状態を保存（Redo用）
        const { history, historyIndex } = useHistoryStore.getState();
        const updatedHistory = [...history];
        if (updatedHistory[historyIndex + 1]) {
          updatedHistory[historyIndex + 1].updatedMark = currentMark;
        }
        useHistoryStore.setState({ history: updatedHistory });
      }
      await updateMark(tournamentId, action.markId, action.mark);
    }
  }, [marks, tournamentId, undo, addAction]);

  const handleRedo = useCallback(async () => {
    const action = redo();
    if (!action) return;

    if (action.type === "add" && action.mark) {
      // 追加をやり直す = 再度追加
      const markId = await addMark(tournamentId, action.mark);
      // 履歴を更新
      addAction({
        type: "add",
        markId,
        mark: action.mark,
      });
    } else if (action.type === "delete") {
      // 削除をやり直す = 削除
      await deleteMark(tournamentId, action.markId);
    } else if (action.type === "update" && action.updatedMark) {
      // 更新をやり直す = 変更後の状態に戻す
      // 現在のマーク状態を保存（Undo用）
      const currentMark = marks.find((m) => m.id === action.markId);
      if (currentMark) {
        // 履歴を更新して現在の状態を保存（Undo用）
        const { history, historyIndex } = useHistoryStore.getState();
        const updatedHistory = [...history];
        if (updatedHistory[historyIndex]) {
          updatedHistory[historyIndex].mark = currentMark;
        }
        useHistoryStore.setState({ history: updatedHistory });
      }
      await updateMark(tournamentId, action.markId, action.updatedMark);
    }
  }, [marks, tournamentId, redo, addAction]);

  // キーボードイベント処理
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl/Cmd + Zで元に戻す（選択状態に関係なく動作）
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        await handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z または Ctrl/Cmd + Yでやり直す（選択状態に関係なく動作）
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") || ((e.ctrlKey || e.metaKey) && e.key === "y")) {
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
  }, [selectedMarkId, marks, tournamentId, copiedMark, addAction, handleUndo, handleRedo]);

  const handleMarkDragEnd = async () => {
    if (!draggingMark) return;
    
    const updatedMark = localMarks.find((m) => m.id === draggingMark.id);
    if (!updatedMark) {
      setDraggingMark(null);
      return;
    }

    // マークが実際に存在するか確認（削除された可能性がある）
    const existingMark = marks.find((m) => m.id === draggingMark.id);
    if (!existingMark) {
      setDraggingMark(null);
      return;
    }

    // 変更前のマーク情報を保存（Undo用）
    const originalMark = draggingMark.originalMark;

    const updateData = createMarkUpdateData(updatedMark);
    const success = await updateMarkSafely(tournamentId, draggingMark.id, updateData);

    if (success) {
      // 履歴に追加（変更前と変更後のマーク情報を保存）
      addAction({
        type: "update",
        markId: draggingMark.id,
        mark: originalMark,
        updatedMark: updatedMark,
      });
    }

    setDraggingMark(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;
    
    // ハンドルやマークのクリックでない場合のみ処理
    // マークやハンドルのクリックはstopPropagationされているので、ここに来るのは空白クリック
    if (mode === "line" && !isDrawing && !draggingHandle && !draggingMark) {
      const coords = getRelativeCoordinates(e);
      setIsDrawing(true);
      setLineStart(coords);
      setLineEnd(coords);
      setSelectedMarkId(null); // 新しい線を描画開始時は選択を解除
    } else if (mode === null && !draggingHandle && !draggingMark) {
      // 編集モードで空白をクリックした場合は選択を解除
      setSelectedMarkId(null);
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;
    
    // タッチ開始位置を記録（スクロール判定用）
    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setIsTouchDragging(false);
    
    // ハンドルやマークのタッチでない場合のみ処理
    if (mode === "line" && !isDrawing && !draggingHandle && !draggingMark) {
      const coords = getRelativeCoordinates(e);
      setIsDrawing(true);
      setLineStart(coords);
      setLineEnd(coords);
      setSelectedMarkId(null); // 新しい線を描画開始時は選択を解除
      e.preventDefault(); // スクロールを防止
    } else if (mode === null && !draggingHandle && !draggingMark) {
      // 編集モードで空白をタッチした場合は選択を解除
      setSelectedMarkId(null);
    }
  };

  const handleCanvasMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;

    // ハンドルのドラッグ終了
    if (draggingHandle) {
      const updatedMark = localMarks.find((m) => m.id === draggingHandle.markId);
      // マークが実際に存在するか確認（削除された可能性がある）
      const existingMark = marks.find((m) => m.id === draggingHandle.markId);
      if (updatedMark && updatedMark.type === "line" && existingMark) {
        // 変更前のマーク情報を保存（Undo用）
        const originalMark = draggingHandle.originalMark;
        
        const updateData = createMarkUpdateData(updatedMark);
        const success = await updateMarkSafely(tournamentId, draggingHandle.markId, updateData);

        if (success) {
          // 履歴に追加（変更前と変更後のマーク情報を保存）
          addAction({
            type: "update",
            markId: draggingHandle.markId,
            mark: originalMark,
            updatedMark: updatedMark,
          });
        }
      }
      setDraggingHandle(null);
      return;
    }

    // マークのドラッグ終了
    if (draggingMark) {
      await handleMarkDragEnd();
      return;
    }

    // 線の描画完了
    if (mode === "line" && isDrawing && lineStart && lineEnd) {
      // 線の長さが0の場合は描画しない
      if (!isValidLineLength(lineStart, lineEnd)) {
        setIsDrawing(false);
        setLineStart(null);
        setLineEnd(null);
        return;
      }

      const markData = {
        type: "line" as const,
        pageNumber: DEFAULT_PAGE_NUMBER,
        x1: lineStart.x,
        y1: lineStart.y,
        x2: lineEnd.x,
        y2: lineEnd.y,
        color: DEFAULT_LINE_COLOR,
      };
      const markId = await addMark(tournamentId, markData);
      // 履歴に追加（マーク情報も保存）
      addAction({
        type: "add",
        markId,
        mark: {
          ...markData,
          createdAt: Timestamp.now(),
        } as Mark,
      });
      setIsDrawing(false);
      setLineStart(null);
      setLineEnd(null);
      setMode(null);
      setSelectedMarkId(markId); // 作成した線を選択状態にする
    }
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;

    // ドラッグ中やハンドル操作中はクリックを無視
    if (draggingMark || draggingHandle) {
      return;
    }

    // スコア追加モード
    if (mode === "score") {
      if (!scoreValue.trim()) {
        showError("スコアを入力してください");
        return;
      }
      const coords = getRelativeCoordinates(e);
      const markData = {
        type: "score" as const,
        pageNumber: DEFAULT_PAGE_NUMBER,
        x: coords.x,
        y: coords.y,
        value: scoreValue,
        fontSize: DEFAULT_SCORE_FONT_SIZE,
        color: DEFAULT_LINE_COLOR,
      };
      const markId = await addMark(tournamentId, markData);
      // 履歴に追加（マーク情報も保存）
      addAction({
        type: "add",
        markId,
        mark: {
          ...markData,
          createdAt: Timestamp.now(),
        } as Mark,
      });
      setScoreValue("");
      setMode(null);
    }
  };

  const handleCanvasTouchEnd = async (e: React.TouchEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;

    // タッチ開始位置をリセット
    setTouchStartPos(null);

    // ドラッグ操作でない場合（タップのみ）はスコア追加を処理
    if (!isTouchDragging && !draggingMark && !draggingHandle && mode === "score") {
      if (!scoreValue.trim()) {
        showError("スコアを入力してください");
        setMode(null);
        return;
      }
      const coords = getRelativeCoordinates(e);
      const markData = {
        type: "score" as const,
        pageNumber: DEFAULT_PAGE_NUMBER,
        x: coords.x,
        y: coords.y,
        value: scoreValue,
        fontSize: DEFAULT_SCORE_FONT_SIZE,
        color: DEFAULT_LINE_COLOR,
      };
      const markId = await addMark(tournamentId, markData);
      // 履歴に追加（マーク情報も保存）
      addAction({
        type: "add",
        markId,
        mark: {
          ...markData,
          createdAt: Timestamp.now(),
        } as Mark,
      });
      setScoreValue("");
      setMode(null);
      setIsTouchDragging(false);
      return;
    }

    // ハンドルのドラッグ終了
    if (draggingHandle) {
      const updatedMark = localMarks.find((m) => m.id === draggingHandle.markId);
      // マークが実際に存在するか確認（削除された可能性がある）
      const existingMark = marks.find((m) => m.id === draggingHandle.markId);
      if (updatedMark && updatedMark.type === "line" && existingMark) {
        // 変更前のマーク情報を保存（Undo用）
        const originalMark = draggingHandle.originalMark;
        
        const updateData = createMarkUpdateData(updatedMark);
        const success = await updateMarkSafely(tournamentId, draggingHandle.markId, updateData);

        if (success) {
          // 履歴に追加（変更前と変更後のマーク情報を保存）
          addAction({
            type: "update",
            markId: draggingHandle.markId,
            mark: originalMark,
            updatedMark: updatedMark,
          });
        }
      }
      setDraggingHandle(null);
      setIsTouchDragging(false);
      return;
    }

    // マークのドラッグ終了
    if (draggingMark) {
      await handleMarkDragEnd();
      setIsTouchDragging(false);
      return;
    }

    // 線の描画完了
    if (mode === "line" && isDrawing && lineStart && lineEnd) {
      // 線の長さが0の場合は描画しない
      if (!isValidLineLength(lineStart, lineEnd)) {
        setIsDrawing(false);
        setLineStart(null);
        setLineEnd(null);
        setIsTouchDragging(false);
        return;
      }

      const markData = {
        type: "line" as const,
        pageNumber: DEFAULT_PAGE_NUMBER,
        x1: lineStart.x,
        y1: lineStart.y,
        x2: lineEnd.x,
        y2: lineEnd.y,
        color: DEFAULT_LINE_COLOR,
      };
      const markId = await addMark(tournamentId, markData);
      // 履歴に追加（マーク情報も保存）
      addAction({
        type: "add",
        markId,
        mark: {
          ...markData,
          createdAt: Timestamp.now(),
        } as Mark,
      });
      setIsDrawing(false);
      setLineStart(null);
      setLineEnd(null);
      setMode(null);
      setSelectedMarkId(markId); // 作成した線を選択状態にする
      setIsTouchDragging(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user || !tournament) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 統合ヘッダー */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-gray-200">
        {/* 1段目: ロゴとナビゲーション */}
        <nav className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <a
                  href="https://scoreflow-eight.vercel.app/"
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="relative h-6 w-6">
                    <Image 
                      src="/logo.png" 
                      alt="ScoreFlow" 
                      fill
                      className="object-contain"
                      unoptimized
                      onError={(e) => {
                        // 画像が読み込めない場合は非表示にする
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-xl font-bold text-gray-900">ScoreFlow</span>
                </a>
              </div>
              <div className="flex gap-4 items-center">
                <button
                  onClick={async () => {
                    try {
                      const url = getPublicUrl(tournament.publicUrlId);
                      await copyToClipboard(url);
                      showSuccess("公開URLをコピーしました");
                    } catch (error) {
                      console.error("Failed to copy URL:", error);
                      showError("URLのコピーに失敗しました");
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                  type="button"
                >
                  公開URL
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="text-sm text-gray-600 hover:text-gray-900"
                  type="button"
                >
                  戻る
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* 2段目: 大会名 */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-12">
              <h1 className="text-lg font-bold text-gray-900">{tournament.name}</h1>
            </div>
          </div>
        </div>

        {/* 2段目: 編集ツールバー */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="bg-white border-b border-gray-200">
            {/* スマホ版: コンパクトなアイコンボタン */}
            <div className="md:hidden overflow-x-auto">
              <div className="flex items-center gap-2 py-2 min-w-max">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    canUndo
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  title="元に戻す"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    canRedo
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  title="やり直す"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
                <div className="border-l border-gray-300 h-6 mx-1"></div>
                <button
                  onClick={() => {
                    setMode(mode === "line" ? null : "line");
                    setIsDrawing(false);
                    setLineStart(null);
                    setLineEnd(null);
                  }}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    mode === "line"
                      ? "bg-red-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  title="ライン追加"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12l4-4m-4 4l4 4" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setMode(mode === "score" ? null : "score");
                    const value = showPrompt("スコアを入力してください:");
                    if (value) {
                      setScoreValue(value);
                    } else {
                      setMode(null);
                    }
                  }}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    mode === "score"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  title="スコア追加"
                  type="button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </button>
                <div className="border-l border-gray-300 h-6 mx-1"></div>
                <button
                  onClick={async () => {
                    if (selectedMarkId) {
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
                  }}
                  disabled={!selectedMarkId}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    selectedMarkId
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-red-50/30 text-red-600/30"
                  }`}
                  type="button"
                  title="削除"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={async () => {
                    if (selectedMarkId) {
                      const mark = marks.find((m) => m.id === selectedMarkId);
                      if (mark) {
                        setCopiedMark(mark);
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
                  }}
                  disabled={!selectedMarkId}
                  className={`p-2 rounded-lg transition flex-shrink-0 ${
                    selectedMarkId
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "bg-blue-50/30 text-blue-600/30"
                  }`}
                  type="button"
                  title="コピー&貼り付け"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
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

            {/* PC版: 従来のレイアウト */}
            <div className="hidden md:flex justify-between items-center flex-wrap py-3">
              {/* 左側: 編集ツール */}
              <div className="flex gap-4 items-center flex-wrap">
                <span className="text-sm font-medium">編集モード:</span>
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`px-4 py-2 rounded-lg transition ${
                    canUndo
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  title="元に戻す (Ctrl+Z)"
                  type="button"
                >
                  ↶ 元に戻す
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`px-4 py-2 rounded-lg transition ${
                    canRedo
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  title="やり直す (Ctrl+Y)"
                  type="button"
                >
                  ↷ やり直す
                </button>
                <div className="border-l border-gray-300 h-6 mx-2"></div>
                <button
                  onClick={() => {
                    setMode(mode === "line" ? null : "line");
                    setIsDrawing(false);
                    setLineStart(null);
                    setLineEnd(null);
                  }}
                  className={`px-4 py-2 rounded-lg transition ${
                    mode === "line"
                      ? "bg-red-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  type="button"
                >
                  ライン追加
                </button>
                <button
                  onClick={() => {
                    setMode(mode === "score" ? null : "score");
                    const value = showPrompt("スコアを入力してください:");
                    if (value) {
                      setScoreValue(value);
                    } else {
                      setMode(null);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg transition ${
                    mode === "score"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  type="button"
                >
                  スコア追加
                </button>
                {mode === "line" && isDrawing && (
                  <span className="text-sm text-gray-600">
                    ドラッグして線を描画してください
                  </span>
                )}
                {selectedMarkId && mode === null && (
                  <>
                    <span className="text-sm text-gray-500">
                      選択中: Deleteキーで削除、Ctrl+C/Vでコピー&ペースト
                    </span>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={async () => {
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
                        }}
                        className="px-3 py-1.5 rounded-lg transition bg-red-50 text-red-600 hover:bg-red-100 text-sm"
                        type="button"
                        title="削除"
                      >
                        削除
                      </button>
                      <button
                        onClick={() => {
                          const mark = marks.find((m) => m.id === selectedMarkId);
                          if (mark) {
                            setCopiedMark(mark);
                            showSuccess("コピーしました");
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg transition bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm"
                        type="button"
                        title="コピー"
                      >
                        コピー
                      </button>
                      {copiedMark && (
                        <button
                          onClick={async () => {
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
                          }}
                          className="px-3 py-1.5 rounded-lg transition bg-green-50 text-green-600 hover:bg-green-100 text-sm"
                          type="button"
                          title="ペースト"
                        >
                          ペースト
                        </button>
                      )}
                    </div>
                  </>
                )}
                {mode === "score" && scoreValue && (
                  <span className="text-sm text-gray-600">
                    配置位置をクリックしてください（スコア: {scoreValue}）
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:pt-[calc(4rem+3rem+3.5rem+1rem)] pt-[calc(4rem+3rem+3rem+1rem)]">

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div
            ref={canvasRef}
            className={`relative ${mode === "line" ? "cursor-crosshair" : ""}`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
            style={{ aspectRatio: "auto", touchAction: "pan-x pan-y pinch-zoom" }}
          >
            <div ref={imageContainerRef} className="relative">
              <img
                src={tournament.pdfPageImage}
                alt="Tournament bracket"
                className="w-full h-auto"
              />
            {/* マークを描画（ドラッグ可能） */}
            {/* すべてのラインを1つのSVGにまとめる */}
            <svg
              className="absolute top-0 left-0 w-full h-full"
              style={{ zIndex: 10 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {(draggingMark || draggingHandle ? localMarks : marks)
                .filter((m) => m.type === "line")
                .map((mark) => {
                  const foundMark = (draggingMark || draggingHandle ? localMarks : marks).find((m) => m.id === mark.id) || mark;
                  const displayMark = foundMark as LineMark & { id: string };
                  return (
                  <g key={mark.id}>
                    {/* 見えるライン（選択時はハイライト） */}
                    <line
                      x1={displayMark.x1 * 100}
                      y1={displayMark.y1 * 100}
                      x2={displayMark.x2 * 100}
                      y2={displayMark.y2 * 100}
                      stroke={selectedMarkId === mark.id && mode === null ? SELECTED_COLOR : displayMark.color}
                      strokeWidth={selectedMarkId === mark.id && mode === null ? "0.4" : "0.3"}
                      pointerEvents="none"
                    />
                    {/* クリック可能な領域（透明な太い線） */}
                    <line
                      x1={displayMark.x1 * 100}
                      y1={displayMark.y1 * 100}
                      x2={displayMark.x2 * 100}
                      y2={displayMark.y2 * 100}
                      stroke="transparent"
                      strokeWidth="2"
                      style={{ cursor: mode === null ? "move" : "default" }}
                      onMouseDown={(e) => {
                        if (mode === null && !draggingHandle) {
                          e.stopPropagation();
                          const coords = getRelativeCoordinates(e as any);
                          setLocalMarks(marks); // ローカル状態を初期化
                          setSelectedMarkId(mark.id);
                          setDraggingMark({
                            id: mark.id,
                            type: "line",
                            startX: coords.x,
                            startY: coords.y,
                            originalMark: displayMark,
                          });
                        }
                      }}
                      onTouchStart={(e) => {
                        if (mode === null && !draggingHandle) {
                          e.stopPropagation();
                          const touch = e.touches[0];
                          setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                          setIsTouchDragging(false);
                          const coords = getRelativeCoordinates(e as any);
                          setLocalMarks(marks); // ローカル状態を初期化
                          setSelectedMarkId(mark.id);
                          setDraggingMark({
                            id: mark.id,
                            type: "line",
                            startX: coords.x,
                            startY: coords.y,
                            originalMark: displayMark,
                          });
                          e.preventDefault(); // スクロールを防止
                        }
                      }}
                    />
                    {/* 選択状態のハンドル */}
                    {selectedMarkId === mark.id && mode === null && !draggingHandle && (
                      <>
                        {/* 開始点のハンドル */}
                        <circle
                          cx={displayMark.x1 * 100}
                          cy={displayMark.y1 * 100}
                          r={HANDLE_RADIUS}
                          fill="transparent"
                          stroke={SELECTED_COLOR}
                          strokeWidth={HANDLE_STROKE_WIDTH}
                          style={{ cursor: "pointer" }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const coords = getRelativeCoordinates(e as any);
                            setLocalMarks(marks); // ローカル状態を初期化
                            setDraggingHandle({
                              markId: mark.id,
                              handle: "start",
                              startX: coords.x,
                              startY: coords.y,
                              originalMark: displayMark as LineMark & { id: string },
                            });
                            setDraggingMark(null);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            const touch = e.touches[0];
                            setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                            setIsTouchDragging(false);
                            const coords = getRelativeCoordinates(e as any);
                            setLocalMarks(marks); // ローカル状態を初期化
                            setDraggingHandle({
                              markId: mark.id,
                              handle: "start",
                              startX: coords.x,
                              startY: coords.y,
                              originalMark: displayMark as LineMark & { id: string },
                            });
                            setDraggingMark(null);
                            e.preventDefault(); // スクロールを防止
                          }}
                        />
                        {/* 終了点のハンドル */}
                        <circle
                          cx={displayMark.x2 * 100}
                          cy={displayMark.y2 * 100}
                          r={HANDLE_RADIUS}
                          fill="transparent"
                          stroke={SELECTED_COLOR}
                          strokeWidth={HANDLE_STROKE_WIDTH}
                          style={{ cursor: "pointer" }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const coords = getRelativeCoordinates(e as any);
                            setLocalMarks(marks); // ローカル状態を初期化
                            setDraggingHandle({
                              markId: mark.id,
                              handle: "end",
                              startX: coords.x,
                              startY: coords.y,
                              originalMark: displayMark as LineMark & { id: string },
                            });
                            setDraggingMark(null);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            const touch = e.touches[0];
                            setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                            setIsTouchDragging(false);
                            const coords = getRelativeCoordinates(e as any);
                            setLocalMarks(marks); // ローカル状態を初期化
                            setDraggingHandle({
                              markId: mark.id,
                              handle: "end",
                              startX: coords.x,
                              startY: coords.y,
                              originalMark: displayMark as LineMark & { id: string },
                            });
                            setDraggingMark(null);
                            e.preventDefault(); // スクロールを防止
                          }}
                        />
                      </>
                    )}
                  </g>
                );
                })}
            </svg>
            {/* スコアマーク */}
            {(draggingMark ? localMarks : marks)
              .filter((m) => m.type === "score")
              .map((mark) => (
                <div
                  key={mark.id}
                  className="absolute"
                  style={{
                    left: `${mark.x * 100}%`,
                    top: `${mark.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${mark.fontSize * imageScale}px`,
                    color: selectedMarkId === mark.id && mode === null ? SELECTED_COLOR : mark.color,
                    fontWeight: "bold",
                    zIndex: 10,
                    cursor: mode === null ? "move" : "default",
                  }}
                  onMouseDown={(e) => {
                    if (mode === null) {
                      e.stopPropagation();
                      const coords = getRelativeCoordinates(e as any);
                      setLocalMarks(marks); // ローカル状態を初期化
                      setSelectedMarkId(mark.id);
                      setDraggingMark({
                        id: mark.id,
                        type: "score",
                        startX: coords.x,
                        startY: coords.y,
                        originalMark: mark,
                      });
                    }
                  }}
                  onTouchStart={(e) => {
                    if (mode === null) {
                      e.stopPropagation();
                      const touch = e.touches[0];
                      setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                      setIsTouchDragging(false);
                      const coords = getRelativeCoordinates(e as any);
                      setLocalMarks(marks); // ローカル状態を初期化
                      setSelectedMarkId(mark.id);
                      setDraggingMark({
                        id: mark.id,
                        type: "score",
                        startX: coords.x,
                        startY: coords.y,
                        originalMark: mark,
                      });
                      e.preventDefault(); // スクロールを防止
                    }
                  }}
                >
                  {mark.value}
                </div>
              ))}
            {/* 描画中のライン（プレビュー） */}
            {isDrawing && lineStart && lineEnd && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 20 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <line
                  x1={lineStart.x * 100}
                  y1={lineStart.y * 100}
                  x2={lineEnd.x * 100}
                  y2={lineEnd.y * 100}
                  stroke="#ef4444"
                  strokeWidth="0.3"
                  opacity={0.5}
                />
                {/* スナップガイドライン */}
                {snapGuide && snapGuide.visible && (
                  <>
                    {/* 水平線用のスナップガイドライン（垂直線） */}
                    {snapGuide.x !== undefined && (
                      <line
                        x1={snapGuide.x * 100}
                        y1="0"
                        x2={snapGuide.x * 100}
                        y2="100"
                        stroke={SNAP_GUIDE_COLOR}
                        strokeWidth={SNAP_GUIDE_STROKE_WIDTH}
                        opacity={SNAP_GUIDE_OPACITY}
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
                        stroke={SNAP_GUIDE_COLOR}
                        strokeWidth={SNAP_GUIDE_STROKE_WIDTH}
                        opacity={SNAP_GUIDE_OPACITY}
                        strokeDasharray="0.5 0.5"
                      />
                    )}
                  </>
                )}
              </svg>
            )}
            {/* ドラッグ中のスナップガイドライン */}
            {((draggingMark || draggingHandle) && snapGuide && snapGuide.visible) && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 20 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* 水平線用のスナップガイドライン（垂直線） */}
                {snapGuide.x !== undefined && (
                  <line
                    x1={snapGuide.x * 100}
                    y1="0"
                    x2={snapGuide.x * 100}
                    y2="100"
                    stroke="#3b82f6"
                    strokeWidth="0.1"
                    strokeDasharray="0.5 0.5"
                    opacity="0.6"
                  />
                )}
                {/* 垂直線用のスナップガイドライン（水平線） */}
                {snapGuide.y !== undefined && (
                  <line
                    x1="0"
                    y1={snapGuide.y * 100}
                    x2="100"
                    y2={snapGuide.y * 100}
                    stroke="#3b82f6"
                    strokeWidth="0.1"
                    strokeDasharray="0.5 0.5"
                    opacity="0.6"
                  />
                )}
              </svg>
            )}
            </div>
          </div>
        </div>
      </main>

      {/* 大会削除ボタン（画面右下固定） */}
      <button
        onClick={async () => {
          if (showConfirm("この大会を完全に削除しますか？この操作は取り消せません。")) {
            try {
              await deleteTournament(tournamentId);
              showSuccess("大会を削除しました");
              router.push("/");
            } catch (error) {
              console.error("Failed to delete tournament:", error);
              showError("大会の削除に失敗しました");
            }
          }
        }}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 flex items-center justify-center"
        title="大会削除"
        type="button"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

