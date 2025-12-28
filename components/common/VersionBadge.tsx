"use client";

/**
 * 画面左下にデプロイ時刻を表示するコンポーネント
 */
export function VersionBadge() {
  // デプロイ時刻を取得（ビルド時に生成されたファイルから）
  // フォールバック: ファイルが存在しない場合は現在時刻を使用
  let deployTime: string;
  try {
    const buildTimeModule = require("@/lib/build-time");
    deployTime = buildTimeModule.BUILD_TIME || new Date().toISOString();
  } catch (e) {
    // ビルド時にファイルが生成されていない場合のフォールバック
    deployTime = new Date().toISOString();
  }
  
  // 時刻をフォーマット（YYYY-MM-DD HH:MM:SS形式）
  const formatDeployTime = (isoString: string | undefined) => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return "N/A";
    }
  };

  const displayTime = formatDeployTime(deployTime);

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
        {displayTime}
      </div>
    </div>
  );
}

