"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/auth";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { getUserTournaments } from "@/lib/firebase/tournaments";
import { Tournament } from "@/lib/firebase/types";
import { getPublicUrl, copyToClipboard } from "@/lib/utils/url";
import { showSuccess, showError } from "@/lib/utils/notification";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        const userTournaments = await getUserTournaments(currentUser.uid);
        setTournaments(userTournaments);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
      showError("ログインに失敗しました");
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setTournaments([]);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, []);

  // 検索とソートを最適化
  const sortedTournaments = useMemo(() => {
    // 検索フィルタリング
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? tournaments.filter((tournament) =>
          tournament.name.toLowerCase().includes(normalizedQuery)
        )
      : tournaments;

    // 作成時間でソート（新しいものが上）
    return [...filtered].sort((a, b) => {
      const dateA = a.createdAt?.toDate()?.getTime() || 0;
      const dateB = b.createdAt?.toDate()?.getTime() || 0;
      return dateB - dateA;
    });
  }, [tournaments, searchQuery]);

  // URLをコピー
  const handleCopyUrl = useCallback(async (publicUrlId: string) => {
    try {
      const url = getPublicUrl(publicUrlId);
      await copyToClipboard(url);
      showSuccess("公開URLをコピーしました");
    } catch (error) {
      console.error("Failed to copy URL:", error);
      showError("URLのコピーに失敗しました");
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md w-full p-8">
          <h1 className="text-3xl font-normal text-center mb-2 text-gray-900">ScoreFlow</h1>
          <p className="text-gray-600 text-center mb-8">
            大会進行状況をリアルタイムで発信
          </p>
            <button
              onClick={handleSignIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded transition"
              type="button"
            >
              Googleでログイン
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 統合ヘッダー */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        {/* ナビゲーションバー */}
        <nav className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center h-14">
              {/* ロゴ */}
              <div className="mr-8">
                <span className="text-base text-gray-700 font-medium">ScoreFlow</span>
              </div>

              {/* 検索バー */}
              <div className="flex-1 max-w-2xl">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="検索"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 右側メニュー */}
              <div className="flex items-center gap-2 ml-6">
                <button
                  onClick={handleSignOut}
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
        {sortedTournaments.length > 0 && (
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-3 gap-4 px-4 py-2">
                <div className="text-xs font-medium text-gray-700">名称</div>
                <div className="text-xs font-medium text-gray-700 col-span-2">公開用URL</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-6 py-8" style={{ paddingTop: sortedTournaments.length > 0 ? 'calc(3.5rem + 2.5rem)' : '3.5rem' }}>
        {/* 大会一覧 */}
        {sortedTournaments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery.trim() ? "検索結果が見つかりませんでした" : "大会がありません"}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedTournaments.map((tournament) => (
                  <tr
                    key={tournament.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/tournament/${tournament.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 break-words">{tournament.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyUrl(tournament.publicUrlId);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                        type="button"
                      >
                        {getPublicUrl(tournament.publicUrlId)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 右下固定の新規作成ボタン */}
      <button
        onClick={() => router.push("/create")}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 z-50 hover:shadow-xl hover:scale-105"
        type="button"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>新規作成</span>
      </button>
    </div>
  );
}
