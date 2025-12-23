import { useState, useCallback, useRef, useEffect } from "react";

/**
 * 編集モードの状態
 */
export type EditModeState = "pan" | "edit" | "drawing";

/**
 * Canva風の編集モード管理フック
 * 
 * 編集モードとパンモードを明確に分離し、
 * 拡大時でも編集操作が安定して動作するようにする
 */
export function useEditMode() {
  const [mode, setMode] = useState<EditModeState>("pan");
  const [isObjectSelected, setIsObjectSelected] = useState(false);
  const modeRef = useRef<EditModeState>("pan");
  const isObjectSelectedRef = useRef(false);

  // リアルタイムで状態を更新
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isObjectSelectedRef.current = isObjectSelected;
  }, [isObjectSelected]);

  /**
   * オブジェクトを選択
   * 選択時は自動的に編集モードに切り替わる
   */
  const selectObject = useCallback((objectId: string | null) => {
    if (objectId) {
      setIsObjectSelected(true);
      setMode("edit");
    } else {
      setIsObjectSelected(false);
      setMode("pan");
    }
  }, []);

  /**
   * 編集操作を開始（ドラッグ開始時など）
   */
  const startEdit = useCallback(() => {
    if (isObjectSelectedRef.current) {
      setMode("edit");
    }
  }, []);

  /**
   * 編集操作を終了
   */
  const endEdit = useCallback(() => {
    // オブジェクトが選択されている場合は編集モードを維持
    if (isObjectSelectedRef.current) {
      setMode("edit");
    } else {
      setMode("pan");
    }
  }, []);

  /**
   * 描画モードを開始（ライン追加など）
   */
  const startDrawing = useCallback(() => {
    setMode("drawing");
  }, []);

  /**
   * 描画モードを終了
   */
  const endDrawing = useCallback(() => {
    if (isObjectSelectedRef.current) {
      setMode("edit");
    } else {
      setMode("pan");
    }
  }, []);

  /**
   * パンモードに戻す（オブジェクトの選択を解除）
   */
  const resetToPan = useCallback(() => {
    setIsObjectSelected(false);
    setMode("pan");
  }, []);

  /**
   * 現在のモードがパン可能かどうか
   */
  const canPan = useCallback(() => {
    return modeRef.current === "pan";
  }, []);

  /**
   * 現在のモードが編集可能かどうか
   */
  const canEdit = useCallback(() => {
    return modeRef.current === "edit" || modeRef.current === "drawing";
  }, []);

  return {
    mode,
    isObjectSelected,
    selectObject,
    startEdit,
    endEdit,
    startDrawing,
    endDrawing,
    resetToPan,
    canPan,
    canEdit,
  };
}

