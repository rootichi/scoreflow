import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 画像のスケールを計算するカスタムフック
 * 表示サイズと自然サイズの比率を返す
 */
export function useImageScale() {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageScale, setImageScale] = useState(1);
  const observerRef = useRef<ResizeObserver | null>(null);

  const calculateImageScale = useCallback(() => {
    if (imageContainerRef.current) {
      const imgElement = imageContainerRef.current.querySelector("img");
      if (imgElement) {
        // 画像が読み込まれているか確認
        if (imgElement.complete && imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) {
          const scale = imgElement.offsetWidth / imgElement.naturalWidth;
          setImageScale(scale);
        } else {
          // 画像がまだ読み込まれていない場合、読み込み完了を待つ
          const handleLoad = () => {
            if (imgElement.naturalWidth > 0 && imgElement.offsetWidth > 0) {
              const scale = imgElement.offsetWidth / imgElement.naturalWidth;
              setImageScale(scale);
            }
            imgElement.removeEventListener("load", handleLoad);
          };
          imgElement.addEventListener("load", handleLoad);
        }
      }
    }
  }, []);

  useEffect(() => {
    // 初回計算
    calculateImageScale();

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
        imgElement.addEventListener("load", calculateImageScale, { once: true });
      }
    }

    return () => {
      window.removeEventListener("resize", calculateImageScale);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [calculateImageScale]);

  return { imageContainerRef, imageScale, calculateImageScale };
}

