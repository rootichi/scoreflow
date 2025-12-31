import { useEffect, useRef } from "react";

/**
 * 編集操作中にスクロールを無効化するカスタムフック
 * 
 * v1仕様: 編集操作中のみスクロールを無効化（素材選択時はスクロールを許可）
 */
export function useScrollPrevention(
  isDrawing: boolean,
  draggingHandle: boolean,
  draggingMark: boolean,
  canEdit?: () => boolean,
  isPinching?: boolean
) {
  useEffect(() => {
    // ピンチ中はスクロール制御を行わない（レイアウト変更を防ぐため）
    if (isPinching) {
      return;
    }

    // v1仕様: 編集操作中のみスクロールを無効化
    const isEditing = canEdit ? canEdit() : (isDrawing || draggingHandle || draggingMark);

    if (isEditing) {
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
      // 通常時はスクロールを許可
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
  }, [isDrawing, draggingHandle, draggingMark, canEdit, isPinching]);
}
