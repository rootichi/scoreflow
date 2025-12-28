import { useEffect, useRef } from "react";

/**
 * 編集操作中にスクロールを無効化するカスタムフック
 * 
 * Canva方式: 画像コンテナが独立したスクロール領域として実装されているため、
 * パンモードでは一切の制御を行わず、編集モード時のみページ全体のスクロールを防止
 */
export function useScrollPrevention(
  isDrawing: boolean,
  draggingHandle: boolean,
  draggingMark: boolean,
  canEdit?: () => boolean,
  isPinching?: boolean // ピンチ中フラグを追加
) {
  const isEditingRef = useRef(false);

  useEffect(() => {
    // Canva風: 編集モードに基づいて判定
    if (canEdit) {
      isEditingRef.current = canEdit();
    } else {
      isEditingRef.current = isDrawing || draggingHandle || draggingMark;
    }
  }, [isDrawing, draggingHandle, draggingMark, canEdit]);

  useEffect(() => {
    // ピンチ中はスクロール制御を行わない（レイアウト変更を防ぐため）
    if (isPinching) {
      return;
    }

    // Canva風: 編集モードに基づいて判定
    const isEditing = canEdit ? canEdit() : (isDrawing || draggingHandle || draggingMark);

    if (isEditing) {
      // 編集モード時のみ、ページ全体のスクロールを無効化
      // 画像コンテナ内のスクロールは許可（独立したスクロール領域として動作）
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";

      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      };
    } else {
      // パンモードでは一切の制御を行わない
      // 画像コンテナ内のネイティブピンチズームとスクロールを完全に許可
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
  }, [isDrawing, draggingHandle, draggingMark, canEdit, isPinching]);
}
