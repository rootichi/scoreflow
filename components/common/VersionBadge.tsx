"use client";

import { useEffect, useState } from "react";
// ビルド時に生成されるデプロイ時刻をインポート
// フォールバック: ファイルが存在しない場合は現在時刻を使用
import { BUILD_TIME } from "@/lib/build-time";

/**
 * 画面左下にデプロイ時刻を表示するコンポーネント
 * v2仕様: ブラウザ標準のピンチズームをしても、常に画面左下に表示される
 */
export function VersionBadge() {
  // デプロイ時刻を取得（ビルド時に生成されたファイルから）
  const deployTime = BUILD_TIME;
  
  // v2仕様: visualViewport APIを使用してズーム時の位置を計算
  const [position, setPosition] = useState({ left: 0, bottom: 0, scale: 1 });
  
  useEffect(() => {
    // visualViewport APIが利用可能か確認
    if (typeof window === 'undefined' || !window.visualViewport) {
      // フォールバック: 通常のfixed位置
      setPosition({ left: 0, bottom: 0, scale: 1 });
      return;
    }

    const updatePosition = () => {
      const vp = window.visualViewport;
      if (!vp) return;

      // visualViewportの左下座標を計算
      // visualViewport.offsetLeft, visualViewport.offsetTopはビューポートの左上の位置
      // visualViewport.heightはビューポートの高さ
      const left = vp.offsetLeft;
      const bottom = window.innerHeight - (vp.offsetTop + vp.height);
      const scale = vp.scale;

      setPosition({ left, bottom, scale });
    };

    // 初回設定
    updatePosition();

    // visualViewportの変更を監視
    window.visualViewport.addEventListener('resize', updatePosition);
    window.visualViewport.addEventListener('scroll', updatePosition);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updatePosition);
        window.visualViewport.removeEventListener('scroll', updatePosition);
      }
    };
  }, []);
  
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
      className="fixed z-[9999] p-2 pointer-events-none"
      style={{ 
        position: 'fixed',
        left: position.left,
        bottom: position.bottom,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: `scale(${1 / position.scale})`, // v2仕様: ズーム時に逆スケーリングを適用
        transformOrigin: 'bottom left', // 左下を基準にスケーリング
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

