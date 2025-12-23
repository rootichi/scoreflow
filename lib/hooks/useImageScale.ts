import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 画像のスケールを計算するカスタムフック
 * 表示サイズと自然サイズの比率を返す
 */
export function useImageScale() {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageScale, setImageScale] = useState(1);

  const calculateImageScale = useCallback(() => {
    if (imageContainerRef.current) {
      const imgElement = imageContainerRef.current.querySelector("img");
      if (imgElement && imgElement.naturalWidth && imgElement.offsetWidth) {
        setImageScale(imgElement.offsetWidth / imgElement.naturalWidth);
      }
    }
  }, []);

  useEffect(() => {
    calculateImageScale();
    window.addEventListener("resize", calculateImageScale);
    const imgElement = imageContainerRef.current?.querySelector("img");
    if (imgElement) {
      imgElement.onload = calculateImageScale;
    }
    return () => {
      window.removeEventListener("resize", calculateImageScale);
    };
  }, [calculateImageScale]);

  return { imageContainerRef, imageScale, calculateImageScale };
}

