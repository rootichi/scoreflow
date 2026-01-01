"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { showError, showSuccess, showPrompt, showConfirm } from "@/lib/utils/notification";
import { isValidCoordinate, isValidLineCoordinate } from "@/lib/utils/coordinateValidation";
import {
  DEFAULT_LINE_COLOR,
  DEFAULT_SCORE_FONT_SIZE,
  DEFAULT_PAGE_NUMBER,
  MIN_LINE_LENGTH,
  COPY_OFFSET,
  SELECTED_COLOR,
  SNAP_DISTANCE_PX,
} from "@/lib/constants";
import { useImageScale } from "@/lib/hooks/useImageScale";
import { useScrollPrevention } from "@/lib/hooks/useScrollPrevention";
import { useCanvasCoordinates } from "@/lib/hooks/useCanvasCoordinates";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useEditMode } from "@/lib/hooks/useEditMode";
import { useTouchGestures } from "@/lib/hooks/useTouchGestures";
import { handleErrorWithNotification } from "@/lib/utils/errorHandler";
import type { DraggingMark, DraggingHandle, SnapGuide, EditMode } from "@/lib/types/canvas";
import { TournamentHeader } from "@/components/tournament/TournamentHeader";
import { EditToolbar } from "@/components/tournament/EditToolbar";
import { SnapGuideLines } from "@/components/tournament/SnapGuideLines";

export default function TournamentEditPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const [user, loading] = useAuthState(auth!);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [marks, setMarks] = useState<Array<Mark & { id: string }>>([]);
  const [mode, setMode] = useState<EditMode>(null);
  const [scoreValue, setScoreValue] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [lineEnd, setLineEnd] = useState<{ x: number; y: number } | null>(null);
  const { addAction, undo, redo, canUndo, canRedo, reset } = useHistoryStore();
  const [draggingMark, setDraggingMark] = useState<DraggingMark | null>(null);
  const [localMarks, setLocalMarks] = useState<Array<Mark & { id: string }>>([]);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<DraggingHandle | null>(null);
  const [copiedMark, setCopiedMark] = useState<Mark & { id: string } | null>(null);
  const [snapGuide, setSnapGuide] = useState<SnapGuide | null>(null); // スナップガイドライン（x: 垂直線、y: 水平線）
  
  // デバッグ: snapGuideの状態変化を監視
  useEffect(() => {
    console.log('[snapGuide state changed]', {
      snapGuide,
      snapGuideX: snapGuide?.x,
      snapGuideY: snapGuide?.y,
      snapGuideVisible: snapGuide?.visible,
      draggingMark: !!draggingMark,
      draggingHandle: !!draggingHandle,
    });
  }, [snapGuide, draggingMark, draggingHandle]);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null); // タッチ開始位置（スクロール判定用）
  const [isTouchDragging, setIsTouchDragging] = useState(false); // タッチドラッグ中かどうか
  const [draggingCrossArrow, setDraggingCrossArrow] = useState<{ startX: number; startY: number } | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Canva風の編集モード管理
  const editMode = useEditMode();
  const touchGestures = useTouchGestures();
  
  // カスタムフック
  const { imageContainerRef, imageScale } = useImageScale();
  const { getRelativeCoordinates } = useCanvasCoordinates(canvasRef);
  
  // v1仕様: 編集操作中のみスクロールを無効化（素材選択時はスクロールを許可）
  useScrollPrevention(isDrawing, !!draggingHandle, !!draggingMark || !!draggingCrossArrow, editMode.canEdit, false);
  
  // 編集モードと選択状態を同期
  useEffect(() => {
    editMode.selectObject(selectedMarkId);
  }, [selectedMarkId, editMode]);
  
  // 描画モードの管理
  useEffect(() => {
    if (mode === "line" && isDrawing) {
      editMode.startDrawing();
    } else if (mode === null && !isDrawing && !draggingMark && !draggingHandle && !draggingCrossArrow) {
      editMode.endDrawing();
    }
  }, [mode, isDrawing, draggingMark, draggingHandle, draggingCrossArrow, editMode]);

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
        await handleErrorWithNotification(error, { operation: "loadTournament", details: { tournamentId } }, "大会の読み込みに失敗しました");
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

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const coords = getRelativeCoordinates(e);
    
    // デバッグログ
    console.log('[handleCanvasMove]', {
      mode,
      isDrawing,
      lineStart: !!lineStart,
      draggingHandle: !!draggingHandle,
      draggingMark: !!draggingMark,
      draggingCrossArrow: !!draggingCrossArrow,
      selectedMarkId,
    });
    
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
          console.log('[handleCanvasMove - draggingHandle horizontal start]', {
            guide,
            guideX: guide?.x,
            guideY: guide?.y,
            guideVisible: guide?.visible,
          });
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
          console.log('[handleCanvasMove - draggingHandle vertical start]', {
            guide,
            guideX: guide?.x,
            guideY: guide?.y,
            guideVisible: guide?.visible,
          });
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
          console.log('[handleCanvasMove - draggingHandle horizontal end]', {
            guide,
            guideX: guide?.x,
            guideY: guide?.y,
            guideVisible: guide?.visible,
          });
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
          console.log('[handleCanvasMove - draggingHandle vertical end]', {
            guide,
            guideX: guide?.x,
            guideY: guide?.y,
            guideVisible: guide?.visible,
          });
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
    } else if (draggingCrossArrow) {
      // 十字矢印UIのドラッグ処理（既存のdraggingMarkロジックを使用）
      if (selectedMarkId) {
        const selectedMark = marks.find((m) => m.id === selectedMarkId);
        if (selectedMark) {
          const dx = coords.x - draggingCrossArrow.startX;
          const dy = coords.y - draggingCrossArrow.startY;
          
          const updatedMarks = localMarks.map((m) => {
            if (m.id === selectedMarkId) {
              if (selectedMark.type === "line") {
                // 既存のdraggingMarkロジックを使用してラインを移動
                const original = selectedMark as LineMark & { id: string };
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
                    console.log('[handleCanvasMove - draggingCrossArrow horizontal]', {
                      guide,
                      guideX: guide?.x,
                      guideY: guide?.y,
                      guideVisible: guide?.visible,
                    });
                    setSnapGuide(guide);
                    return {
                      ...m,
                      ...adjustedLine,
                    } as Mark & { id: string };
                  }
                  setSnapGuide(null);
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
                    console.log('[handleCanvasMove - draggingCrossArrow vertical]', {
                      guide,
                      guideX: guide?.x,
                      guideY: guide?.y,
                      guideVisible: guide?.visible,
                    });
                    setSnapGuide(guide);
                    return {
                      ...m,
                      ...adjustedLine,
                    } as Mark & { id: string };
                  }
                  setSnapGuide(null);
                  return movedLine;
                } else {
                  setSnapGuide(null);
                  return updateMarkCoordinates(original, dx, dy);
                }
              } else if (selectedMark.type === "score") {
                // スコアを移動
                const original = selectedMark as ScoreMark & { id: string };
                const movedScore = updateMarkCoordinates(original, dx, dy) as ScoreMark & { id: string };
                
                if (canvasRef.current) {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const { adjustedScore, snapGuide: guide } = handleScoreDragSnap(
                    movedScore,
                    rect.width,
                    rect.height,
                    marks,
                    selectedMarkId
                  );
                  console.log('[handleCanvasMove - draggingCrossArrow score]', {
                    guide,
                    guideX: guide?.x,
                    guideY: guide?.y,
                    guideVisible: guide?.visible,
                  });
                  setSnapGuide(guide);
                  return {
                    ...m,
                    ...adjustedScore,
                  } as Mark & { id: string };
                }
                
                setSnapGuide(null);
                return movedScore;
              }
            }
            return m;
          });
          setLocalMarks(updatedMarks);
        }
      }
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
                  console.log('[handleCanvasMove - draggingMark horizontal]', {
                    guide,
                    guideX: guide?.x,
                    guideY: guide?.y,
                    guideVisible: guide?.visible,
                  });
                  setSnapGuide(guide);
                  return {
                    ...m,
                    ...adjustedLine,
                  } as Mark & { id: string };
                }
                setSnapGuide(null);
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
                  console.log('[handleCanvasMove - draggingMark vertical]', {
                    guide,
                    guideX: guide?.x,
                    guideY: guide?.y,
                    guideVisible: guide?.visible,
                  });
                  setSnapGuide(guide);
                  return {
                    ...m,
                    ...adjustedLine,
                  } as Mark & { id: string };
                }
                setSnapGuide(null);
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
              console.log('[handleCanvasMove - draggingMark score]', {
                guide,
                guideX: guide?.x,
                guideY: guide?.y,
                guideVisible: guide?.visible,
              });
              setSnapGuide(guide);
              return {
                ...m,
                ...adjustedScore,
              } as Mark & { id: string };
            }
            
            setSnapGuide(null);
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
    draggingCrossArrow,
    selectedMarkId,
    marks,
    localMarks,
    getRelativeCoordinates,
  ]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleCanvasMove(e);
  }, [handleCanvasMove]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // v1仕様: 編集操作中のみピンチズームを無効化（通常時は許可）
    if ((isDrawing || draggingHandle || draggingMark || draggingCrossArrow) && e.touches.length > 1) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // v1仕様: 素材選択時のみパン操作を無効化（編集用ドラッグ操作が競合しないようにするため）
    if (selectedMarkId) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // タッチ開始位置から一定距離以上動いた場合はドラッグと判定
    if (touchStartPos && e.touches[0]) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const DRAG_THRESHOLD = 10; // 10px以上動いた場合はドラッグと判定
      
      if (distance > DRAG_THRESHOLD) {
        setIsTouchDragging(true);
      }
    }
    
    // タッチジェスチャーを処理（単一タッチの場合のみ）
    touchGestures.handleTouchMove(e);
    
    // 編集操作中は処理を続行
    if (isDrawing || draggingHandle || draggingMark || draggingCrossArrow) {
      setIsTouchDragging(true);
      editMode.startEdit();
      handleCanvasMove(e);
      return;
    }
    
    // ジェスチャーがドラッグの場合
    if (touchGestures.gesture?.type === "drag") {
      // オブジェクトが選択されている場合は編集操作
      if (editMode.isObjectSelected) {
        setIsTouchDragging(true);
        editMode.startEdit();
        handleCanvasMove(e);
        return;
      }
    }
  }, [isDrawing, draggingHandle, draggingMark, draggingCrossArrow, selectedMarkId, handleCanvasMove, touchGestures, editMode, touchStartPos]);

  // スコア追加の共通処理
  const handleAddScore = useCallback(async (coords: { x: number; y: number }) => {
    if (!scoreValue.trim()) {
      showError("スコアを入力してください");
      return;
    }
    
    // 座標が画像の範囲内にあるかを検証
    if (!isValidCoordinate(coords, canvasRef)) {
      showError("スコアは画像の範囲内に配置してください");
      return;
    }
    
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
    editMode.endDrawing();
  }, [scoreValue, tournamentId, addAction, editMode, canvasRef]);

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

  // キーボードショートカット
  useKeyboardShortcuts({
    selectedMarkId,
    marks,
    tournamentId,
    copiedMark,
    setCopiedMark,
    setSelectedMarkId,
    addAction,
    handleUndo,
    handleRedo,
  });

  const handleMarkDragEnd = async () => {
    // 十字矢印UIのドラッグ終了処理
    if (draggingCrossArrow) {
      if (selectedMarkId) {
        const updatedMark = localMarks.find((m) => m.id === selectedMarkId);
        if (updatedMark) {
          const existingMark = marks.find((m) => m.id === selectedMarkId);
          if (existingMark) {
            const originalMark = existingMark;
            const updateData = createMarkUpdateData(updatedMark);
            const success = await updateMarkSafely(tournamentId, selectedMarkId, updateData);
            
            if (success) {
              // 履歴に追加（変更前と変更後のマーク情報を保存）
              addAction({
                type: "update",
                markId: selectedMarkId,
                mark: originalMark,
                updatedMark: updatedMark,
              });
            }
          }
        }
      }
      setDraggingCrossArrow(null);
      setLocalMarks(marks); // ローカル状態をリセット
      return;
    }
    
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
      setSelectedPosition(null); // 選択位置をクリア
    } else if (mode === null && !draggingHandle && !draggingMark) {
      // 編集モードで空白をクリックした場合は選択を解除
      setSelectedMarkId(null);
      setSelectedPosition(null); // 選択位置をクリア
      editMode.resetToPan();
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;
    
    // v1仕様: 編集操作中のみピンチズームを無効化（通常時は許可）
    if ((mode === "line" || selectedMarkId) && e.touches.length > 1) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // v1仕様: 素材選択時のみパン操作を無効化（編集用ドラッグ操作が競合しないようにするため）
    if (selectedMarkId && mode !== "line") {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // タッチジェスチャーを処理（単一タッチの場合のみ）
    touchGestures.handleTouchStart(e);
    
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
      setSelectedPosition(null); // 選択位置をクリア
      editMode.startDrawing();
      e.preventDefault(); // スクロールを防止
    } else if (mode === null && !draggingHandle && !draggingMark) {
      // 編集モードで空白をタッチした場合は選択を解除
      setSelectedMarkId(null);
      setSelectedPosition(null); // 選択位置をクリア
      editMode.resetToPan();
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
      editMode.endEdit();
      return;
    }

    // マークのドラッグ終了
    if (draggingMark) {
      await handleMarkDragEnd();
      editMode.endEdit();
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

      // 座標が画像の範囲内にあるかを検証
      const lineCoords = {
        x1: lineStart.x,
        y1: lineStart.y,
        x2: lineEnd.x,
        y2: lineEnd.y,
      };
      if (!isValidLineCoordinate(lineCoords, canvasRef)) {
        showError("ラインは画像の範囲内に配置してください");
        setIsDrawing(false);
        setLineStart(null);
        setLineEnd(null);
        setMode(null);
        editMode.endDrawing();
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
      editMode.endDrawing();
      editMode.selectObject(markId);
    }
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;

    // ドラッグ中やハンドル操作中はクリックを無視
    if (draggingMark || draggingHandle || draggingCrossArrow) {
      return;
    }

    // スコア追加モード
    if (mode === "score") {
      const coords = getRelativeCoordinates(e);
      await handleAddScore(coords);
    }
  };

  const handleCanvasTouchEnd = async (e: React.TouchEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;

    // v1仕様: 編集操作中のみピンチズームを無効化（通常時は許可）
    if ((isDrawing || draggingHandle || draggingMark || draggingCrossArrow) && e.touches.length > 1) {
      e.preventDefault();
      e.stopPropagation();
      setTouchStartPos(null);
      return;
    }


    // タッチジェスチャーを処理
    touchGestures.handleTouchEnd(e);
    
    // タッチ終了位置を取得（選択判定用）
    const touchEndCoords = e.changedTouches[0] ? getRelativeCoordinates({
      ...e,
      touches: [e.changedTouches[0]],
    } as any) : null;

    // タップジェスチャーの場合
    if (touchGestures.gesture?.type === "tap") {
      // スコア追加モードの場合
      if (mode === "score" && !draggingMark && !draggingHandle) {
        const coords = getRelativeCoordinates(e);
        await handleAddScore(coords);
        setIsTouchDragging(false);
        touchGestures.clearGesture();
        setTouchStartPos(null);
        return;
      }
    }

    // ドラッグ操作でない場合（タップのみ）はスコア追加を処理（フォールバック）
    if (!isTouchDragging && !draggingMark && !draggingHandle && mode === "score") {
      const coords = getRelativeCoordinates(e);
      await handleAddScore(coords);
      setIsTouchDragging(false);
      touchGestures.clearGesture();
      setTouchStartPos(null);
      return;
    }

    // タッチ終了時にラインやスコアを選択する処理（タッチ中に指を動かしていない場合のみ）
    if (!isTouchDragging && !draggingMark && !draggingHandle && mode === null && touchEndCoords && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const touchThreshold = SNAP_DISTANCE_PX / Math.max(rect.width, rect.height); // 正規化座標でのタッチ判定距離
      
      // すべてのラインをチェック
      for (const mark of marks) {
        if (mark.type === "line") {
          const lineMark = mark as LineMark & { id: string };
          const isHorizontal = Math.abs(lineMark.x2 - lineMark.x1) > Math.abs(lineMark.y2 - lineMark.y1);
          
          if (isHorizontal) {
            // 水平線の場合
            const y = lineMark.y1;
            const x1 = Math.min(lineMark.x1, lineMark.x2);
            const x2 = Math.max(lineMark.x1, lineMark.x2);
            const distance = Math.abs(touchEndCoords.y - y);
            
            if (distance < touchThreshold && touchEndCoords.x >= x1 && touchEndCoords.x <= x2) {
              // ライン上をタッチした場合 - 選択する
              setLocalMarks(marks);
              setSelectedMarkId(mark.id);
              setSelectedPosition(touchEndCoords);
              editMode.selectObject(mark.id);
              touchGestures.clearGesture();
              setTouchStartPos(null);
              return;
            }
          } else {
            // 垂直線の場合
            const x = lineMark.x1;
            const y1 = Math.min(lineMark.y1, lineMark.y2);
            const y2 = Math.max(lineMark.y1, lineMark.y2);
            const distance = Math.abs(touchEndCoords.x - x);
            
            if (distance < touchThreshold && touchEndCoords.y >= y1 && touchEndCoords.y <= y2) {
              // ライン上をタッチした場合 - 選択する
              setLocalMarks(marks);
              setSelectedMarkId(mark.id);
              setSelectedPosition(touchEndCoords);
              editMode.selectObject(mark.id);
              touchGestures.clearGesture();
              setTouchStartPos(null);
              return;
            }
          }
        }
      }
      
      // すべてのスコアをチェック
      for (const mark of marks) {
        if (mark.type === "score") {
          const scoreMark = mark as ScoreMark & { id: string };
          const distance = Math.sqrt(
            Math.pow(touchEndCoords.x - scoreMark.x, 2) + Math.pow(touchEndCoords.y - scoreMark.y, 2)
          );
          
          if (distance < touchThreshold) {
            // スコア上をタッチした場合 - 選択する
            setLocalMarks(marks);
            setSelectedMarkId(mark.id);
            setSelectedPosition(touchEndCoords);
            editMode.selectObject(mark.id);
            touchGestures.clearGesture();
            setTouchStartPos(null);
            return;
          }
        }
      }
    }
    
    // タッチ開始位置をリセット
    setTouchStartPos(null);

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
      editMode.endEdit();
      touchGestures.clearGesture();
      return;
    }

    // マークのドラッグ終了
    if (draggingMark) {
      await handleMarkDragEnd();
      setIsTouchDragging(false);
      editMode.endEdit();
      touchGestures.clearGesture();
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
        editMode.endDrawing();
        touchGestures.clearGesture();
        return;
      }

      // 座標が画像の範囲内にあるかを検証
      const lineCoords = {
        x1: lineStart.x,
        y1: lineStart.y,
        x2: lineEnd.x,
        y2: lineEnd.y,
      };
      if (!isValidLineCoordinate(lineCoords, canvasRef)) {
        showError("ラインは画像の範囲内に配置してください");
        setIsDrawing(false);
        setLineStart(null);
        setLineEnd(null);
        setMode(null);
        setIsTouchDragging(false);
        editMode.endDrawing();
        touchGestures.clearGesture();
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
      editMode.endDrawing();
      touchGestures.clearGesture();
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
    <>
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
      {/* UIレイヤー: ヘッダー（固定表示、ブラウザピンチズームの影響を受けない） */}
      <TournamentHeader
        tournament={tournament}
        tournamentId={tournamentId}
        onDeleteTournament={async () => {
          try {
            await deleteTournament(tournamentId);
            showSuccess("大会を削除しました");
            router.push("/");
          } catch (error) {
            await handleErrorWithNotification(error, { operation: "deleteTournament", details: { tournamentId } }, "大会の削除に失敗しました");
          }
        }}
      />
      
      {/* UIレイヤー: 編集ツールバー（フッター風、ズーム時も位置とサイズを一定に保つ） */}
      <EditToolbar
        mode={mode}
        scoreValue={scoreValue}
        selectedMarkId={selectedMarkId}
        canUndo={canUndo}
        canRedo={canRedo}
        marks={marks}
        tournamentId={tournamentId}
        isDrawing={isDrawing}
        onModeChange={setMode}
        onScoreValueChange={setScoreValue}
        onSelectedMarkIdChange={setSelectedMarkId}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAddAction={addAction}
        onSetCopiedMark={setCopiedMark}
        onSetDrawing={setIsDrawing}
        onSetLineStart={setLineStart}
        onSetLineEnd={setLineEnd}
        onEditModeEndDrawing={editMode.endDrawing}
        onEditModeStartDrawing={editMode.startDrawing}
        onEditModeResetToPan={editMode.resetToPan}
        onEditModeSelectObject={editMode.selectObject}
      />

      {/* 編集レイヤー: メインコンテンツ（v2仕様: ヘッダーの下から開始、ツールバーは下部に配置） */}
      {/* ヘッダー(4rem + 3rem) + 余白(0.5rem) = 約7.5remの下から開始、ツールバー(約3rem)の上まで */}
      <div className="bg-gray-50" style={{ height: "calc(100vh - 4rem - 3rem - 0.5rem - 3rem)", position: "fixed", top: "calc(4rem + 3rem + 0.5rem)", left: 0, right: 0, bottom: "3rem" }}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full" style={{ zIndex: 10, height: "100%" }}>

        <div style={{ height: "100%" }}>
          {/* v1仕様: 画像コンテナ（スクロール有効化） */}
          <div
            ref={imageContainerRef}
            data-canvas-container
            className={`relative ${mode === "line" ? "cursor-crosshair" : ""}`}
            style={{
              width: "100%",
              height: "100%",
              touchAction: selectedMarkId ? "pinch-zoom" : "pan-x pan-y pinch-zoom", // v1仕様: 素材選択時のみパン操作を無効化
              WebkitTouchCallout: "none", // iOSの長押しメニューを無効化
              userSelect: "none", // テキスト選択を無効化
              position: "relative",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          >
            {/* v1仕様: ブラウザ標準のピンチズームを有効化 */}
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
              }}
            >
              {/* キャンバス要素（画像とSVGを含む） */}
              <div
                ref={canvasRef}
                data-canvas-container
                className="relative"
                style={{
                  width: "100%",
                  display: "inline-block", // コンテンツサイズに合わせる
                }}
          >
            <img
              src={tournament.pdfPageImage}
              alt="Tournament bracket"
                className="w-full h-auto block"
                style={{ 
                  display: "block",
                  border: "2px solid #e5e7eb", // グレーのボーダーで枠を表示
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)", // 影を追加してより見やすく
                  backgroundColor: "#ffffff", // 白い背景を追加（透明なPDFの場合）
                }}
            />
            {/* マークを描画（ドラッグ可能） */}
            {/* すべてのラインを1つのSVGにまとめる */}
            <svg
              ref={svgRef}
              className="absolute top-0 left-0 w-full h-full"
              style={{ zIndex: 10 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {(draggingMark || draggingHandle || draggingCrossArrow ? localMarks : marks)
                .filter((m) => m.type === "line")
                .map((mark) => {
                  const foundMark = (draggingMark || draggingHandle || draggingCrossArrow ? localMarks : marks).find((m) => m.id === mark.id) || mark;
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
                          setSelectedPosition(coords); // 選択位置を記録
                          editMode.selectObject(mark.id);
                          setDraggingMark({
                            id: mark.id,
                            type: "line",
                            startX: coords.x,
                            startY: coords.y,
                            originalMark: displayMark,
                          });
                          editMode.startEdit();
                        }
                      }}
                      onTouchStart={(e) => {
                        // タッチ開始時は選択処理を行わない（タッチ終了時に選択判定を行う）
                        // タッチ開始位置を記録するだけ
                        if (mode === null && !draggingHandle) {
                          e.stopPropagation();
                          const touch = e.touches[0];
                          setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                          setIsTouchDragging(false);
                        }
                      }}
                    />
                    {/* 選択状態のハンドル */}
                    {selectedMarkId === mark.id && mode === null && !draggingHandle && (
                      <>
                        {/* 開始点のハンドル */}
                        {/* タッチターゲット用の大きな透明な円（スマホ版用） */}
                        <circle
                          cx={displayMark.x1 * 100}
                          cy={displayMark.y1 * 100}
                          r="4.0"
                          fill="transparent"
                          stroke="transparent"
                          className="md:hidden"
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
                            editMode.startEdit();
                            e.preventDefault(); // スクロールを防止
                          }}
                        />
                        {/* 見た目のハンドル */}
                        <circle
                          cx={displayMark.x1 * 100}
                          cy={displayMark.y1 * 100}
                          r="2.0"
                          fill={SELECTED_COLOR}
                          fillOpacity="0.5"
                          stroke={SELECTED_COLOR}
                          strokeWidth="0.6"
                          style={{ 
                            cursor: "pointer",
                            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                          }}
                          className="md:r-[0.4] md:fill-opacity-[0.2] md:stroke-[0.2] md:animate-none"
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
                            editMode.startEdit();
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
                            editMode.startEdit();
                            e.preventDefault(); // スクロールを防止
                          }}
                        />
                        {/* 終了点のハンドル */}
                        {/* タッチターゲット用の大きな透明な円（スマホ版用） */}
                        <circle
                          cx={displayMark.x2 * 100}
                          cy={displayMark.y2 * 100}
                          r="4.0"
                          fill="transparent"
                          stroke="transparent"
                          className="md:hidden"
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
                            editMode.startEdit();
                            e.preventDefault(); // スクロールを防止
                          }}
                        />
                        {/* 見た目のハンドル */}
                        <circle
                          cx={displayMark.x2 * 100}
                          cy={displayMark.y2 * 100}
                          r="2.0"
                          fill={SELECTED_COLOR}
                          fillOpacity="0.5"
                          stroke={SELECTED_COLOR}
                          strokeWidth="0.6"
                          style={{ 
                            cursor: "pointer",
                            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                          }}
                          className="md:r-[0.4] md:fill-opacity-[0.2] md:stroke-[0.2] md:animate-none"
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
                            editMode.startEdit();
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
                            editMode.startEdit();
                            e.preventDefault(); // スクロールを防止
                          }}
                        />
                      </>
                    )}
                  </g>
                );
                })}
            </svg>
            {/* 十字矢印UI（Canvaスマホ版風） */}
            {selectedMarkId && mode === null && !draggingHandle && !draggingMark && selectedPosition && (() => {
              // ドラッグ中はlocalMarksから、そうでない場合はmarksから取得
              const displayMarks = draggingCrossArrow ? localMarks : marks;
              const selectedMark = displayMarks.find((m) => m.id === selectedMarkId);
              
              if (!selectedMark || !canvasRef.current) {
                return null;
              }

              const canvasRect = canvasRef.current.getBoundingClientRect();
              const offset = 0.05; // 相対座標でのオフセット（約5%）

              // 十字矢印UIの表示位置を計算
              let absoluteX = 0;
              let absoluteY = 0;

              if (selectedMark.type === "line") {
                const lineMark = selectedMark as LineMark & { id: string };
                const isHorizontal = isHorizontalLine(lineMark);
                const isVertical = isVerticalLine(lineMark);
                
                // ラインの中央座標を計算（相対座標系: 0-1）
                const centerX = (lineMark.x1 + lineMark.x2) / 2;
                const centerY = (lineMark.y1 + lineMark.y2) / 2;
                
                if (isHorizontal) {
                  // 並行ライン（水平ライン）: 選択素材の下に表示
                  absoluteX = centerX * canvasRect.width;
                  absoluteY = (centerY + offset) * canvasRect.height;
                } else if (isVertical) {
                  // 垂直ライン: 選択素材の右に表示
                  absoluteX = (centerX + offset) * canvasRect.width;
                  absoluteY = centerY * canvasRect.height;
                } else {
                  // 斜めのライン（フォールバック: 中央の少し下）
                  absoluteX = centerX * canvasRect.width;
                  absoluteY = (centerY + offset) * canvasRect.height;
                }
              } else if (selectedMark.type === "score") {
                // スコア: 選択素材の下に表示
                const scoreMark = selectedMark as ScoreMark & { id: string };
                absoluteX = scoreMark.x * canvasRect.width;
                absoluteY = (scoreMark.y + offset) * canvasRect.height;
              } else {
                return null;
              }
              
              return (
                <div
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${absoluteX}px`,
                    top: `${absoluteY}px`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 20,
                    width: "48px",
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "move",
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const coords = getRelativeCoordinates(e);
                    setLocalMarks(marks);
                    setDraggingCrossArrow({
                      startX: coords.x,
                      startY: coords.y,
                    });
                    editMode.startEdit();
                  }}
                  onMouseMove={(e) => {
                    if (draggingCrossArrow) {
                      e.stopPropagation();
                      e.preventDefault();
                      handleCanvasMove(e);
                    }
                  }}
                  onMouseUp={async (e) => {
                    if (draggingCrossArrow) {
                      e.stopPropagation();
                      e.preventDefault();
                      await handleMarkDragEnd();
                      editMode.endEdit();
                    }
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const touch = e.touches[0];
                    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                    setIsTouchDragging(false);
                    const coords = getRelativeCoordinates(e as any);
                    setLocalMarks(marks);
                    setDraggingCrossArrow({
                      startX: coords.x,
                      startY: coords.y,
                    });
                    editMode.startEdit();
                    e.preventDefault();
                  }}
                  onTouchMove={(e) => {
                    if (draggingCrossArrow) {
                      e.stopPropagation();
                      e.preventDefault();
                      handleCanvasMove(e);
                    }
                  }}
                  onTouchEnd={async (e) => {
                    if (draggingCrossArrow) {
                      e.stopPropagation();
                      e.preventDefault();
                      await handleMarkDragEnd();
                      editMode.endEdit();
                    }
                  }}
                >
                  {/* 十字矢印UI */}
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 48 48"
                    style={{ pointerEvents: "none" }}
                  >
                    {/* 上矢印 */}
                    <path
                      d="M 24 8 L 20 16 L 24 12 L 28 16 Z"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                    {/* 下矢印 */}
                    <path
                      d="M 24 40 L 20 32 L 24 36 L 28 32 Z"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                    {/* 左矢印 */}
                    <path
                      d="M 8 24 L 16 20 L 12 24 L 16 28 Z"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                    {/* 右矢印 */}
                    <path
                      d="M 40 24 L 32 20 L 36 24 L 32 28 Z"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                    {/* 中央の円 */}
                    <circle
                      cx="24"
                      cy="24"
                      r="6"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              );
            })()}
            {/* スコアマーク */}
            {(draggingMark || draggingCrossArrow ? localMarks : marks)
              .filter((m) => m.type === "score")
              .map((mark) => {
                const foundMark = (draggingMark || draggingCrossArrow ? localMarks : marks).find((m) => m.id === mark.id) || mark;
                const displayMark = foundMark as ScoreMark & { id: string };
                return (
                <div
                  key={mark.id}
                  className="absolute"
                  style={{
                    left: `${displayMark.x * 100}%`,
                    top: `${displayMark.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${displayMark.fontSize * imageScale}px`,
                    color: selectedMarkId === mark.id && mode === null ? SELECTED_COLOR : displayMark.color,
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
                      setSelectedPosition(coords); // 選択位置を記録
                      editMode.selectObject(mark.id);
                      setDraggingMark({
                        id: mark.id,
                        type: "score",
                        startX: coords.x,
                        startY: coords.y,
                        originalMark: displayMark,
                      });
                      editMode.startEdit();
                    }
                  }}
                  onTouchStart={(e) => {
                    // タッチ開始時は選択処理を行わない（タッチ終了時に選択判定を行う）
                    // タッチ開始位置を記録するだけ
                    if (mode === null) {
                      e.stopPropagation();
                      const touch = e.touches[0];
                      setTouchStartPos({ x: touch.clientX, y: touch.clientY });
                      setIsTouchDragging(false);
                    }
                  }}
                >
                  {displayMark.value}
                </div>
              );
              })}
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
                <SnapGuideLines snapGuide={snapGuide} variant="drawing" />
              </svg>
            )}
            {/* ドラッグ中のスナップガイドライン */}
            {(() => {
              const shouldRender = (draggingMark || draggingHandle) && snapGuide && snapGuide.visible;
              console.log('[render - dragging snap guide]', {
                draggingMark: !!draggingMark,
                draggingHandle: !!draggingHandle,
                snapGuide,
                snapGuideVisible: snapGuide?.visible,
                shouldRender,
              });
              return shouldRender;
            })() && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 20 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <SnapGuideLines snapGuide={snapGuide} variant="dragging" />
              </svg>
            )}
                </div>
            </div>
          </div>
        </div>
      </main>
      </div>

    </>
  );
}


