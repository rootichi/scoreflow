import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 画像のスケールを計算するカスタムフック
 * 表示サイズと自然サイズの比率を返す
 */
export function useImageScale() {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageScale, setImageScale] = useState<number | null>(null); // null = 未計算
  const observerRef = useRef<ResizeObserver | null>(null);
  const imageLoadHandlerRef = useRef<(() => void) | null>(null);

  const calculateImageScale = useCallback(() => {
    if (imageContainerRef.current) {
      const imgElement = imageContainerRef.current.querySelector("img");
      if (imgElement) {
        // 画像が読み込まれているか確認
        if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) {
          const scale = imgElement.offsetWidth / imgElement.naturalWidth;
          setImageScale(scale);
          return true; // スケール計算成功
        }
      }
    }
    return false; // スケール計算失敗（画像未読み込み）
  }, []);

  useEffect(() => {
    // 既存のloadハンドラーをクリーンアップ
    if (imageLoadHandlerRef.current) {
      const imgElement = imageContainerRef.current?.querySelector("img");
      if (imgElement) {
        imgElement.removeEventListener("load", imageLoadHandlerRef.current);
      }
    }

    // 初回計算を試みる
    const calculated = calculateImageScale();

    // リサイズイベントの監視
    window.addEventListener("resize", calculateImageScale);

    // ResizeObserverで画像コンテナのサイズ変更を監視
    if (imageContainerRef.current) {
      observerRef.current = new ResizeObserver(() => {
        calculateImageScale();
      });
      observerRef.current.observe(imageContainerRef.current);
    }

    // 画像要素の読み込み完了を監視
    const imgElement = imageContainerRef.current?.querySelector("img");
    if (imgElement) {
      // 既に読み込まれている場合
      if (imgElement.complete && imgElement.naturalWidth > 0) {
        calculateImageScale();
      } else {
        // 読み込み完了を待つ
        const handleLoad = () => {
          // 少し待ってから計算（レイアウトが確定するまで）
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              calculateImageScale();
            });
          });
        };
        imageLoadHandlerRef.current = handleLoad;
        imgElement.addEventListener("load", handleLoad, { once: true });
      }
    }

    return () => {
      window.removeEventListener("resize", calculateImageScale);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (imageLoadHandlerRef.current && imgElement) {
        imgElement.removeEventListener("load", imageLoadHandlerRef.current);
      }
    };
  }, [calculateImageScale]);

  // imageScaleがnullの場合は1を返す（後方互換性のため）
  return { imageContainerRef, imageScale: imageScale ?? 1, calculateImageScale, isImageScaleReady: imageScale !== null };
}

