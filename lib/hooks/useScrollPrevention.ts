import { useEffect, useRef } from "react";

/**
 * 編集操作中にスクロールを無効化するカスタムフック
 * 
 * 注意: touchstartではpreventDefault()しない
 * Reactのイベントハンドラーが先に動作し、draggingMark/draggingHandleの状態を設定する必要があるため
 * 
 * Canva風の実装: 編集モードに基づいてスクロールを制御
 */
export function useScrollPrevention(
  isDrawing: boolean,
  draggingHandle: boolean,
  draggingMark: boolean,
  canEdit?: () => boolean
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
    // Canva風: 編集モードに基づいて判定
    const isEditing = canEdit ? canEdit() : (isDrawing || draggingHandle || draggingMark);

    if (isEditing) {
      // スクロールを無効化
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";

      // touchmoveのみを制御（touchstartではpreventDefaultしない）
      // Reactのイベントハンドラーが先に動作する必要があるため
      const preventScroll = (e: TouchEvent) => {
        // 編集操作中の場合のみpreventDefault
        // ただし、キャンバス要素内のイベントは許可（Reactのハンドラーが処理する）
        if (isEditingRef.current) {
          // キャンバス要素内のイベントかどうかをチェック
          const target = e.target as HTMLElement;
          const canvasElement = target.closest('[data-canvas-container]');
          const isInCanvas = canvasElement !== null;
          
          if (!isInCanvas) {
            // キャンバス要素外のイベントのみpreventDefault
            e.preventDefault();
            e.stopPropagation();
          }
          // キャンバス要素内のイベントはpreventDefaultしない（Reactのハンドラーが処理する）
        }
      };

      const preventWheel = (e: WheelEvent) => {
        if (isEditingRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // touchmoveをバブリングフェーズで捕捉（キャプチャフェーズではなく）
      // これにより、Reactのイベントハンドラーが先に動作する
      document.addEventListener("touchmove", preventScroll, {
        passive: false,
        capture: false, // バブリングフェーズで捕捉
      });
      document.addEventListener("wheel", preventWheel, {
        passive: false,
        capture: true,
      });

      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
        document.removeEventListener("touchmove", preventScroll, {
          capture: false,
        } as any);
        document.removeEventListener("wheel", preventWheel, {
          capture: true,
        } as any);
      };
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
  }, [isDrawing, draggingHandle, draggingMark, canEdit]);
}
