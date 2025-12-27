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
} from "@/lib/constants";
import { useImageScale } from "@/lib/hooks/useImageScale";
import { useScrollPrevention } from "@/lib/hooks/useScrollPrevention";
import { useCanvasCoordinates } from "@/lib/hooks/useCanvasCoordinates";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useEditMode } from "@/lib/hooks/useEditMode";
import { useTouchGestures } from "@/lib/hooks/useTouchGestures";
import { usePinchZoom } from "@/lib/hooks/usePinchZoom";
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
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null); // タッチ開始位置（スクロール判定用）
  const [isTouchDragging, setIsTouchDragging] = useState(false); // タッチドラッグ中かどうか
  const [pinchTouchPoints, setPinchTouchPoints] = useState<{ touch1: { x: number; y: number } | null; touch2: { x: number; y: number } | null } | null>(null); // ピンチ操作中のタッチポイント（視覚化用）
  
  const canvasZoomLayerRef = useRef<HTMLDivElement>(null); // CanvasZoomLayerのref
  const initialImageSizeRef = useRef<{ width: number; height: number } | null>(null); // 初期画像サイズ（canvasScale=1.0の状態）
  
  // Canva風の編集モード管理
  const editMode = useEditMode();
  const touchGestures = useTouchGestures();
  
  // カスタムフック
  const { imageContainerRef, imageScale } = useImageScale();
  useScrollPrevention(isDrawing, !!draggingHandle, !!draggingMark, editMode.canEdit);
  const { getRelativeCoordinates } = useCanvasCoordinates(canvasRef);
  const {
    transformString,
    transformOrigin,
    isPinching,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  } = usePinchZoom(imageContainerRef, initialImageSizeRef, canvasRef, canvasZoomLayerRef);
  
  // 編集モードと選択状態を同期
  useEffect(() => {
    editMode.selectObject(selectedMarkId);
  }, [selectedMarkId, editMode]);
  
  // 描画モードの管理
  useEffect(() => {
    if (mode === "line" && isDrawing) {
      editMode.startDrawing();
    } else if (mode === null && !isDrawing && !draggingMark && !draggingHandle) {
      editMode.endDrawing();
    }
  }, [mode, isDrawing, draggingMark, draggingHandle, editMode]);

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

  // 初期画像サイズを記録（canvasScale=1.0の状態）
  useEffect(() => {
    const recordInitialImageSize = () => {
      if (!imageContainerRef.current || !tournament) return;
      
      const imgElement = imageContainerRef.current.querySelector("img");
      if (!imgElement || !imgElement.naturalWidth || !imgElement.naturalHeight) return;
      
      // 初期画像サイズを記録（canvasScale=1.0の状態）
      const imageDisplayWidth = imgElement.offsetWidth;
      const imageDisplayHeight = imgElement.offsetHeight;
      
      if (imageDisplayWidth > 0 && imageDisplayHeight > 0) {
        initialImageSizeRef.current = {
          width: imageDisplayWidth,
          height: imageDisplayHeight,
        };
      }
    };
    
    recordInitialImageSize();
    const imgElement = imageContainerRef.current?.querySelector("img");
    if (imgElement) {
      imgElement.onload = recordInitialImageSize;
    }
  }, [tournament]);


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
    // 複数のタッチポイントがある場合（ピンチ操作）
    if (e.touches.length > 1) {
      // 編集操作中はピンチ操作を無効化
      if (isDrawing || draggingHandle || draggingMark) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // カスタムピンチズームを処理
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches.length >= 2) {
        handlePinchMove(e.touches[0], e.touches[1]);
        // 視覚化用にタッチポイントを更新
        setPinchTouchPoints({
          touch1: { x: e.touches[0].clientX, y: e.touches[0].clientY },
          touch2: { x: e.touches[1].clientX, y: e.touches[1].clientY },
        });
      }
      
      return;
    }
    
    // ピンチ中またはピンチ終了直後のフレームでは、pan/drag処理を一切発火しない
    if (isPinching) {
      console.log("[TouchMove] isPinching is true, skipping pan/drag processing");
      return;
    }
    
    // パンモードで、編集操作中でない場合は、ネイティブ処理に委譲
    if (editMode.canPan() && !isDrawing && !draggingHandle && !draggingMark && !editMode.isObjectSelected) {
      // ネイティブスクロールを許可（何も処理しない）
      return;
    }
    
    // タッチジェスチャーを処理（単一タッチの場合のみ）
    touchGestures.handleTouchMove(e);
    
    // 編集操作中は常にpreventDefaultして処理を続行
    if (isDrawing || draggingHandle || draggingMark) {
      e.preventDefault();
      e.stopPropagation();
      setIsTouchDragging(true);
      editMode.startEdit();
      handleCanvasMove(e);
      return;
    }
    
    // ジェスチャーがドラッグの場合
    if (touchGestures.gesture?.type === "drag") {
      // オブジェクトが選択されている場合は編集操作
      if (editMode.isObjectSelected) {
        e.preventDefault();
        e.stopPropagation();
        setIsTouchDragging(true);
        editMode.startEdit();
        handleCanvasMove(e);
        return;
      }
      // オブジェクトが選択されていない場合はパン操作を許可
      // preventDefaultしない（パン操作を許可）
    }
  }, [touchStartPos, isDrawing, draggingHandle, draggingMark, handleCanvasMove, touchGestures, editMode, handlePinchMove, isPinching]);

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
      editMode.resetToPan();
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!tournament || !user) return;
    
    // 複数のタッチポイントがある場合（ピンチ操作）
    if (e.touches.length > 1) {
      // 編集操作中はピンチ操作を無効化
      if (isDrawing || draggingHandle || draggingMark) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // カスタムピンチズームを開始
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches.length >= 2) {
        handlePinchStart(e.touches[0], e.touches[1]);
        // 視覚化用にタッチポイントを記録
        setPinchTouchPoints({
          touch1: { x: e.touches[0].clientX, y: e.touches[0].clientY },
          touch2: { x: e.touches[1].clientX, y: e.touches[1].clientY },
        });
      }
      
      return;
    }
    
    // パンモードで、ライン追加モードでもない場合は、ネイティブ処理に委譲
    if (editMode.canPan() && mode !== "line" && !isDrawing && !draggingHandle && !draggingMark) {
      // ネイティブスクロールを許可（何も処理しない）
      return;
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
      editMode.startDrawing();
      e.preventDefault(); // スクロールを防止
    } else if (mode === null && !draggingHandle && !draggingMark) {
      // 編集モードで空白をタッチした場合は選択を解除
      setSelectedMarkId(null);
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
    if (draggingMark || draggingHandle) {
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

    // ピンチ操作が終了した場合、リセット
    const wasPinching = e.touches.length < 2 && isPinching;
    if (e.touches.length < 2) {
      handlePinchEnd();
      // 視覚化用のタッチポイントをクリア
      setPinchTouchPoints(null);
    }

    // ピンチ中またはピンチ終了直後のフレームでは、pan/drag関連の処理を一切発火しない
    // 重要: ピンチ終了フレームは「無操作フレーム」として扱う
    if (isPinching || wasPinching) {
      console.log("[TouchEnd] isPinching or pinch end frame, skipping pan/drag processing");
      console.log("[TouchEnd] pointerCount:", e.touches.length);
      // タッチ開始位置をリセット（これは安全）
      setTouchStartPos(null);
      return;
    }

    // タッチジェスチャーを処理
    touchGestures.handleTouchEnd(e);
    
    // タッチ開始位置をリセット
    setTouchStartPos(null);

    // タップジェスチャーの場合
    if (touchGestures.gesture?.type === "tap") {
      // スコア追加モードの場合
      if (mode === "score" && !draggingMark && !draggingHandle) {
        const coords = getRelativeCoordinates(e);
        await handleAddScore(coords);
        setIsTouchDragging(false);
        touchGestures.clearGesture();
        return;
      }
    }

    // ドラッグ操作でない場合（タップのみ）はスコア追加を処理（フォールバック）
    if (!isTouchDragging && !draggingMark && !draggingHandle && mode === "score") {
      const coords = getRelativeCoordinates(e);
      await handleAddScore(coords);
      setIsTouchDragging(false);
      touchGestures.clearGesture();
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
      {/* 統合ヘッダー */}
      <TournamentHeader tournament={tournament} />
      
      <div className="min-h-screen bg-gray-50" style={{ touchAction: "manipulation" }}>

      {/* 2段目: 編集ツールバー */}
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

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:pt-[calc(4rem+3rem+3.5rem+1rem)] pt-[calc(4rem+3rem+3rem+1rem)]" style={{ touchAction: "pan-x pan-y manipulation" }}>

        <div style={{ touchAction: "pan-x pan-y manipulation" }}>
          {/* Canva方式: 画像コンテナを独立したスクロール領域として実装 */}
          <div
            ref={imageContainerRef}
            data-canvas-container
            className={`relative ${mode === "line" ? "cursor-crosshair" : ""}`}
            style={{
              // 画面サイズに合わせた固定サイズ（ヘッダーとツールバーを除く）
              width: "100%",
              // ヘッダー(4rem) + ツールバー(3rem) + mainの上下パディング(2rem) = 9rem
              height: "calc(100vh - 9rem)",
              overflow: "hidden", // CanvasViewportで制御するため、ここではhidden
              touchAction: "pan-x pan-y", // ネイティブピンチズームを無効化（カスタム実装を使用）
              overscrollBehavior: "contain", // スクロールの伝播を制御
              WebkitOverflowScrolling: "touch", // iOSの慣性スクロールを有効化
              WebkitTouchCallout: "none", // iOSの長押しメニューを無効化
              userSelect: "none", // テキスト選択を無効化
              position: "relative", // 相対位置指定
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          >
            {/* CanvasViewport: 表示領域（固定サイズ） */}
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden", // 拡大したコンテンツがはみ出さないように
              }}
            >
              {/* CanvasZoomLayer: ここだけを拡大縮小 */}
              <div
                ref={canvasZoomLayerRef}
                style={{
                  transform: transformString,
                  transformOrigin: transformOrigin,
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
                      editMode.selectObject(mark.id);
                      setDraggingMark({
                        id: mark.id,
                        type: "score",
                        startX: coords.x,
                        startY: coords.y,
                        originalMark: mark,
                      });
                      editMode.startEdit();
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
                      editMode.selectObject(mark.id);
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
                <SnapGuideLines snapGuide={snapGuide} variant="drawing" />
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
                <SnapGuideLines snapGuide={snapGuide} variant="dragging" />
              </svg>
            )}
                </div>
              </div>
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
              await handleErrorWithNotification(error, { operation: "deleteTournament", details: { tournamentId } }, "大会の削除に失敗しました");
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

      {/* ピンチ操作の視覚化（デバッグ用） */}
      {pinchTouchPoints && pinchTouchPoints.touch1 && pinchTouchPoints.touch2 && (
        <div
          className="fixed top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 9998 }}
        >
          {/* タッチポイント1 */}
          <div
            className="absolute rounded-full border-4"
            style={{
              left: `${pinchTouchPoints.touch1.x}px`,
              top: `${pinchTouchPoints.touch1.y}px`,
              width: '40px',
              height: '40px',
              marginLeft: '-20px',
              marginTop: '-20px',
              borderColor: 'rgba(59, 130, 246, 0.6)',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
            }}
          />
          {/* タッチポイント2 */}
          <div
            className="absolute rounded-full border-4"
            style={{
              left: `${pinchTouchPoints.touch2.x}px`,
              top: `${pinchTouchPoints.touch2.y}px`,
              width: '40px',
              height: '40px',
              marginLeft: '-20px',
              marginTop: '-20px',
              borderColor: 'rgba(59, 130, 246, 0.6)',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
            }}
          />
          {/* 2点間の線 */}
          <svg
            className="absolute top-0 left-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          >
            <line
              x1={pinchTouchPoints.touch1.x}
              y1={pinchTouchPoints.touch1.y}
              x2={pinchTouchPoints.touch2.x}
              y2={pinchTouchPoints.touch2.y}
              stroke="rgba(59, 130, 246, 0.4)"
              strokeWidth="3"
              strokeDasharray="5,5"
            />
          </svg>
          {/* 2点を囲む矩形 */}
          <div
            className="absolute border-2"
            style={{
              left: `${Math.min(pinchTouchPoints.touch1.x, pinchTouchPoints.touch2.x)}px`,
              top: `${Math.min(pinchTouchPoints.touch1.y, pinchTouchPoints.touch2.y)}px`,
              width: `${Math.abs(pinchTouchPoints.touch2.x - pinchTouchPoints.touch1.x)}px`,
              height: `${Math.abs(pinchTouchPoints.touch2.y - pinchTouchPoints.touch1.y)}px`,
              borderColor: 'rgba(59, 130, 246, 0.5)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
            }}
          />
          {/* 中点（ピンチ中心） */}
          <div
            className="absolute rounded-full"
            style={{
              left: `${(pinchTouchPoints.touch1.x + pinchTouchPoints.touch2.x) / 2}px`,
              top: `${(pinchTouchPoints.touch1.y + pinchTouchPoints.touch2.y) / 2}px`,
              width: '20px',
              height: '20px',
              marginLeft: '-10px',
              marginTop: '-10px',
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              border: '2px solid white',
            }}
          />
        </div>
      )}
    </div>
    </>
  );
}

