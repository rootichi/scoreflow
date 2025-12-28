"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Eruda（モバイル用デベロッパーツール）を読み込むコンポーネント
 */
export function ErudaLoader() {
  useEffect(() => {
    // Erudaが読み込まれた後に初期化
    if (typeof window !== "undefined" && (window as any).eruda) {
      (window as any).eruda.init();
    }
  }, []);

  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/eruda"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== "undefined" && (window as any).eruda) {
          (window as any).eruda.init();
        }
      }}
    />
  );
}

