"use client";

import { useEffect } from "react";

/**
 * Eruda（モバイル用デベロッパーツール）を読み込むコンポーネント
 */
export function ErudaLoader() {
  useEffect(() => {
    // クライアント側でのみ実行
    if (typeof window === "undefined") {
      return;
    }

    // Erudaが既に読み込まれている場合は初期化のみ
    if ((window as any).eruda) {
      (window as any).eruda.init();
      return;
    }

    // Erudaを動的に読み込む
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.async = true;
    script.onload = () => {
      if ((window as any).eruda) {
        (window as any).eruda.init();
      }
    };
    document.head.appendChild(script);

    return () => {
      // クリーンアップ（必要に応じて）
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
}

