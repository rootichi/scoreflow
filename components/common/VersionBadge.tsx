"use client";

import { APP_VERSION } from "@/lib/constants";

/**
 * 画面左下にバージョン情報を表示するコンポーネント
 */
export function VersionBadge() {
  return (
    <div 
      className="fixed bottom-0 left-0 z-[9999] p-2 pointer-events-none"
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      <div 
        className="bg-black/70 text-white text-xs px-2 py-1 rounded-tr-md font-mono shadow-lg"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          borderTopRightRadius: '0.375rem',
          fontFamily: 'monospace',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        v{APP_VERSION}
      </div>
    </div>
  );
}

