"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/auth";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { getUserTournaments } from "@/lib/firebase/tournaments";
import { Tournament } from "@/lib/firebase/types";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
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
      alert("ログインに失敗しました");
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
    const filtered = searchQuery.trim()
      ? tournaments.filter((tournament) =>
          tournament.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : tournaments;

    // 作成時間でソート（新しいものが上）
    return [...filtered].sort((a, b) => {
      const dateA = a.createdAt?.toDate()?.getTime() || 0;
      const dateB = b.createdAt?.toDate()?.getTime() || 0;
      return dateB - dateA;
    });
  }, [tournaments, searchQuery]);

  // 公開URLを生成
  const getPublicUrl = useCallback((publicUrlId: string) => {
    if (typeof window === "undefined") return `/p/${publicUrlId}`;
    return `${window.location.origin}/p/${publicUrlId}`;
  }, []);

  // URLをコピー
  const handleCopyUrl = useCallback((publicUrlId: string) => {
    const url = getPublicUrl(publicUrlId);
    navigator.clipboard.writeText(url);
    alert("公開URLをコピーしました");
  }, [getPublicUrl]);

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

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 新規作成（検索中は非表示） */}
        {!searchQuery.trim() && (
          <div className="mb-8">
            <h2 className="text-sm text-gray-600 mb-4">新規作成</h2>
            <button
              onClick={() => router.push("/create")}
              className="w-48 h-32 border-2 border-dashed border-gray-300 rounded-lg bg-white hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center justify-center group"
              type="button"
            >
              <div className="w-12 h-12 mb-2 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </button>
          </div>
        )}

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
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 w-1/3">名称</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">公開用URL</th>
                </tr>
              </thead>
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
                          handleCopyUrl(tournament.publicUrlId);
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
    </div>
  );
}
