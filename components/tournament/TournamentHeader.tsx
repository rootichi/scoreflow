"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tournament } from "@/lib/firebase/types";
import { Logo } from "@/components/common/Logo";
import { getPublicUrl, copyToClipboard } from "@/lib/utils/url";
import { showSuccess, showError, showConfirm } from "@/lib/utils/notification";

interface TournamentHeaderProps {
  tournament: Tournament;
  tournamentId: string;
  onDeleteTournament: () => Promise<void>;
}

/**
 * トーナメント編集ページのヘッダーコンポーネント
 */
export function TournamentHeader({ tournament, tournamentId, onDeleteTournament }: TournamentHeaderProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleCopyPublicUrl = async () => {
    try {
      const url = getPublicUrl(tournament.publicUrlId);
      await copyToClipboard(url);
      showSuccess("公開URLをコピーしました");
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Failed to copy URL:", error);
      showError("URLのコピーに失敗しました");
    }
  };

  const handleHome = () => {
    router.push("/");
    setIsMenuOpen(false);
  };

  const handleDeleteTournament = async () => {
    if (showConfirm("この大会を完全に削除しますか？この操作は取り消せません。")) {
      try {
        await onDeleteTournament();
        setIsMenuOpen(false);
      } catch (error) {
        // エラーはonDeleteTournament内で処理される
      }
    }
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] bg-white shadow-sm border-b border-gray-200" style={{ touchAction: "none" }}>
        {/* 1段目: ロゴとナビゲーション */}
        <nav className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Logo href="https://scoreflow-eight.vercel.app/" />
              {/* ハンバーガーメニューボタン */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                type="button"
                title="メニュー"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        {/* 2段目: 大会名 */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-12">
              <h1 className="text-lg font-bold text-gray-900">{tournament.name}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* サイドメニューオーバーレイ */}
      {isMenuOpen && (
        <>
          {/* 背景オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/50 z-[99]"
            onClick={() => setIsMenuOpen(false)}
            style={{ zIndex: 99 }}
          />
          
          {/* サイドメニュー */}
          <div
            className="fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-[100]"
            style={{ zIndex: 100 }}
          >
            <div className="p-4">
              {/* 閉じるボタン */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setIsMenuOpen(false)}
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

