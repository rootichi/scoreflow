"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicUrl, copyToClipboard } from "@/lib/utils/url";
import { showSuccess, showError, showConfirm } from "@/lib/utils/notification";
import { deleteTournament } from "@/lib/firebase/tournaments";

interface SideMenuProps {
  tournamentId: string;
  publicUrlId: string;
  onDeleteTournament: () => Promise<void>;
}

/**
 * サイドメニューコンポーネント
 * v2仕様: ズーム時も位置とサイズを一定に保つ
 */
export function SideMenu({ tournamentId, publicUrlId, onDeleteTournament }: SideMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0, scale: 1 });

  useEffect(() => {
    // visualViewport APIが利用可能か確認
    if (typeof window === 'undefined' || !window.visualViewport) {
      // フォールバック: 通常のfixed位置
      setPosition({ top: 0, right: 0, scale: 1 });
      return;
    }

    let rafId: number | null = null;

    const updatePosition = () => {
      const vp = window.visualViewport;
      if (!vp) return;

      // 画面右上の位置を計算（ズーム中に左右にピンした際も固定位置に表示）
      const top = vp.pageTop;
      const right = window.innerWidth - (vp.pageLeft + vp.width);
      // ズームスケールを取得（ユーザー視点でサイズを一定に保つため）
      const scale = vp.scale || 1;

      // requestAnimationFrameでスムーズに更新（ブレを防止）
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        setPosition({ top, right, scale });
        rafId = null;
      });
    };

    // 初回設定
    updatePosition();

    // visualViewportの変更を監視
    window.visualViewport.addEventListener('resize', updatePosition);
    window.visualViewport.addEventListener('scroll', updatePosition);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updatePosition);
        window.visualViewport.removeEventListener('scroll', updatePosition);
      }
    };
  }, []);

  const handleCopyPublicUrl = async () => {
    try {
      const url = getPublicUrl(publicUrlId);
      await copyToClipboard(url);
      showSuccess("公開URLをコピーしました");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to copy URL:", error);
      showError("URLのコピーに失敗しました");
    }
  };

  const handleHome = () => {
    router.push("/");
    setIsOpen(false);
  };

  const handleDeleteTournament = async () => {
    if (showConfirm("この大会を完全に削除しますか？この操作は取り消せません。")) {
      try {
        await onDeleteTournament();
        setIsOpen(false);
      } catch (error) {
        // エラーはonDeleteTournament内で処理される
      }
    }
  };

  return (
    <>
      {/* ハンバーガーメニューボタン */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed z-[95] p-2 rounded-lg bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition"
        style={{
          position: 'fixed',
          top: position.top + 16,
          right: position.right + 16,
          zIndex: 95,
          touchAction: "none",
          // v2仕様: ズーム時に逆スケーリングを適用して、ユーザー視点でサイズを一定に保つ
          transform: `scale(${1 / position.scale})`,
          transformOrigin: 'top right', // 右上を基準にスケーリング
        }}
        type="button"
        title="メニュー"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* サイドメニューオーバーレイ */}
      {isOpen && (
        <>
          {/* 背景オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/50 z-[94]"
            onClick={() => setIsOpen(false)}
            style={{ zIndex: 94 }}
          />
          
          {/* サイドメニュー */}
          <div
            className="fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-[95]"
            style={{ zIndex: 95 }}
          >
            <div className="p-4">
              {/* 閉じるボタン */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                  type="button"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* メニュー項目 */}
              <div className="space-y-2">
                <button
                  onClick={handleHome}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700"
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>ホーム</span>
                  </div>
                </button>

                <button
                  onClick={handleCopyPublicUrl}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700"
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>公開URL</span>
                  </div>
                </button>

                <button
                  onClick={handleDeleteTournament}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 transition text-red-600"
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>大会削除</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

