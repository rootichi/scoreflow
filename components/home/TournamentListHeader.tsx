"use client";

import Image from "next/image";
import { Logo } from "@/components/common/Logo";

interface TournamentListHeaderProps {
  onSignOut: () => void;
  hasTournaments: boolean;
}

/**
 * トーナメント一覧ページのヘッダーコンポーネント
 */
export function TournamentListHeader({
  onSignOut,
  hasTournaments,
}: TournamentListHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
      {/* ナビゲーションバー */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center h-14">
            <Logo href="https://scoreflow-eight.vercel.app/" textClassName="text-gray-700" size="sm" />

            {/* 右側メニュー */}
            <div className="flex items-center gap-2 ml-6">
              <button
                onClick={onSignOut}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition"
                type="button"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* テーブルヘッダー（大会一覧がある場合のみ表示） */}
      {hasTournaments && (
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4 px-4 py-2">
              <div className="text-xs font-medium text-gray-700">名称</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

