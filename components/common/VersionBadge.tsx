"use client";

import { APP_VERSION } from "@/lib/constants";

/**
 * 画面左下にバージョン情報を表示するコンポーネント
 */
export function VersionBadge() {
  return (
    <div className="fixed bottom-0 left-0 z-50 p-2 pointer-events-none">
      <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-tr-md font-mono">
        v{APP_VERSION}
      </div>
    </div>
  );
}

