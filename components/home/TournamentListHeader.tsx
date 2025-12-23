"use client";

import Image from "next/image";
import { Logo } from "@/components/common/Logo";

interface TournamentListHeaderProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  onSignOut: () => void;
  hasTournaments: boolean;
  hasSearchQuery: boolean;
}

/**
 * トーナメント一覧ページのヘッダーコンポーネント
 */
export function TournamentListHeader({
  searchInput,
  setSearchInput,
  onSignOut,
  hasTournaments,
  hasSearchQuery,
}: TournamentListHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
      {/* ナビゲーションバー */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center h-14">
            <Logo href="https://scoreflow-eight.vercel.app/" textClassName="text-gray-700" size="sm" />

            {/* 検索バー（PC版のみ） */}
            <div className="hidden md:flex flex-1 max-w-2xl">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="検索"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

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
              {/* 検索バー（スマホ版のみ） */}
              <div className="md:hidden flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="検索"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="block w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 検索結果が0件の場合も検索欄を表示（スマホ版のみ） */}
      {!hasTournaments && hasSearchQuery && (
        <div className="max-w-7xl mx-auto px-6 md:hidden">
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4 px-4 py-2">
              <div className="text-xs font-medium text-gray-700">名称</div>
              {/* 検索バー（スマホ版のみ） */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="検索"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="block w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

