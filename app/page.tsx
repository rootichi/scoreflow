"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/auth";
import { signInWithGoogle, signOut } from "@/lib/firebase/auth";
import { getUserTournaments } from "@/lib/firebase/tournaments";
import { Tournament } from "@/lib/firebase/types";
import { getPublicUrl, copyToClipboard } from "@/lib/utils/url";
import { showSuccess, showError } from "@/lib/utils/notification";
import {
  Upload,
  Share2,
  Zap,
  Smartphone,
  Download,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileText,
  Users,
  Clock,
  Globe,
  Menu,
  X,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [animationStep, setAnimationStep] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // サイドメニューが開いている時に背景のスクロールを無効化
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

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

  // アニメーション制御（未ログイン時のみ）
  useEffect(() => {
    if (user || loading) return;
    
    let intervalId: NodeJS.Timeout;
    let currentStep = 0;
    
    const startAnimation = () => {
      // アニメーションをリセット（ただし、ステップ1のトーナメント表は残す）
      // 赤いラインとスコアは消えるが、トーナメント表の基本構造は残る
      setAnimationStep(1); // トーナメント表は常に表示
      currentStep = 1;
      
      // アニメーション間隔を1.2秒に設定（均等）
      const interval = 1200;
      
      // ステップ1: トーナメント表を表示（0.5秒後）
      const timer1 = setTimeout(() => {
        setAnimationStep(1);
        currentStep = 1;
      }, 500);
      
      // ステップ2: 1選手Aのライン（1.7秒後）
      const timer2 = setTimeout(() => {
        setAnimationStep(2);
        currentStep = 2;
      }, 500 + interval);
      
      // ステップ3: 1選手Aのスコア（勝者）（2.9秒後）
      const timer3 = setTimeout(() => {
        setAnimationStep(3);
        currentStep = 3;
      }, 500 + interval * 2);
      
      // ステップ4: 2選手Bのスコア（敗者）（4.1秒後）
      const timer4 = setTimeout(() => {
        setAnimationStep(4);
        currentStep = 4;
      }, 500 + interval * 3);
      
      // ステップ5: 3選手Cのライン（5.3秒後）
      const timer5 = setTimeout(() => {
        setAnimationStep(5);
        currentStep = 5;
      }, 500 + interval * 4);
      
      // ステップ6: 3選手Cのスコア（勝者）（6.5秒後）
      const timer6 = setTimeout(() => {
        setAnimationStep(6);
        currentStep = 6;
      }, 500 + interval * 5);
      
      // ステップ7: 4選手Dのスコア（敗者）（7.7秒後）
      const timer7 = setTimeout(() => {
        setAnimationStep(7);
        currentStep = 7;
      }, 500 + interval * 6);
      
      // ステップ8: 決勝のライン（8.9秒後）
      const timer8 = setTimeout(() => {
        setAnimationStep(8);
        currentStep = 8;
      }, 500 + interval * 7);
      
      // ステップ9: 1選手Aのスコア（勝者）（10.1秒後）
      const timer9 = setTimeout(() => {
        setAnimationStep(9);
        currentStep = 9;
      }, 500 + interval * 8);
      
      // ステップ10: 3選手Cのスコア（敗者）（11.3秒後）
      const timer10 = setTimeout(() => {
        setAnimationStep(10);
        currentStep = 10;
      }, 500 + interval * 9);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        clearTimeout(timer5);
        clearTimeout(timer6);
        clearTimeout(timer7);
        clearTimeout(timer8);
        clearTimeout(timer9);
        clearTimeout(timer10);
      };
    };
    
    // 初回実行
    const cleanup1 = startAnimation();
    
    // 12.5秒ごとにループ（最後のステップが終わってから少し待って再開）
    intervalId = setInterval(() => {
      startAnimation();
    }, 12500);

    return () => {
      cleanup1();
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, loading]);

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
      <div className="min-h-screen bg-white">
        {/* 固定ヘッダー */}
        <header className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 border-b border-blue-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* ロゴ */}
              <a
                href="https://scoreflow-eight.vercel.app/"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="relative h-8 w-8">
                  <Image 
                    src="/logo.png" 
                    alt="ScoreFlow" 
                    fill
                    className="object-contain"
                    unoptimized
                    onError={(e) => {
                      // 画像が読み込めない場合は非表示にする
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <span className="text-xl font-bold text-white">ScoreFlow</span>
              </a>

              {/* ナビゲーションとCTAボタン（デスクトップ） / モバイルメニューボタン */}
              <div className="flex items-center gap-2 sm:gap-4">
                {/* ナビゲーション（デスクトップ） */}
                <nav className="hidden md:flex items-center gap-8">
                  <a
                    href="#pain-points"
                    className="text-sm text-white/90 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("pain-points")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    課題解決
                  </a>
                  <a
                    href="#features"
                    className="text-sm text-white/90 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    使い方
                  </a>
                  <a
                    href="#benefits"
                    className="text-sm text-white/90 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById("benefits")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    特徴
                  </a>
                </nav>
                {/* デスクトップCTAボタン */}
                <button
                  onClick={handleSignIn}
                  className="hidden md:flex bg-white text-blue-600 hover:bg-gray-100 font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-200 text-sm items-center gap-2 hover:shadow-lg hover:scale-105 whitespace-nowrap"
                  type="button"
                >
                  Googleで無料で始める
                  <ArrowRight className="w-4 h-4" />
                </button>
                {/* モバイルメニューボタン */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden text-white p-2"
                  type="button"
                  aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
                >
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* モバイルサイドバー */}
        {isMenuOpen && (
          <>
            {/* オーバーレイ */}
            <div
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />
            {/* サイドバー */}
            <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 md:hidden transform transition-transform duration-300 overflow-y-auto">
              <div className="flex flex-col min-h-full">
                {/* ヘッダー */}
                <div className="flex items-center justify-end p-4 border-b border-gray-200 flex-shrink-0">
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 text-gray-600 hover:text-gray-900"
                    type="button"
                    aria-label="メニューを閉じる"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                {/* メニュー項目 */}
                <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                  <a
                    href="#pain-points"
                    className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      document.getElementById("pain-points")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    課題解決
                  </a>
                  <a
                    href="#features"
                    className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    使い方
                  </a>
                  <a
                    href="#benefits"
                    className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMenuOpen(false);
                      document.getElementById("benefits")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    特徴
                  </a>
                </nav>
                {/* CTAボタン */}
                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleSignIn();
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 text-sm flex items-center justify-center gap-2 hover:shadow-lg"
                    type="button"
                  >
                    Googleで無料で始める
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Hero Section */}
        <section id="hero" className="relative bg-gradient-to-br from-blue-50 via-white to-gray-50 pt-24 sm:pt-32 pb-16 sm:pb-32 px-4" style={{ paddingTop: 'calc(4rem + 1rem)' }}>
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 sm:mb-6">
              ScoreFlow
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-700 mb-3 sm:mb-4 font-medium leading-relaxed">
              今、どこまで進んでる？<br className="sm:hidden" />
              が"スマホで"分かる。
            </p>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 leading-relaxed">
              トーナメント表に、<br className="sm:hidden" />
              リアルタイムを。
            </p>
            <p className="text-sm sm:text-base text-gray-500 mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-2">
              大会運営のストレスをゼロに。<br className="sm:hidden" />
              結果記入の往復の必要なし、専門知識不要。<br className="sm:hidden" />
              入力した瞬間に全員へ反映される、<br />
              大会進行状況可視化SaaSです。
            </p>
            <button
              onClick={handleSignIn}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 sm:py-4 px-6 sm:px-8 rounded-lg shadow-lg transition-all duration-200 text-base sm:text-lg flex items-center gap-2 mx-auto hover:shadow-xl hover:scale-105"
              type="button"
            >
              Googleで無料で始める
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          
          {/* UIモック風のグラフィック - リアルなトーナメント表 + アニメーション */}
          <div className="max-w-5xl mx-auto mt-8 sm:mt-16 px-2 sm:px-4">
            <div className="bg-white rounded-lg shadow-2xl p-3 sm:p-6 border border-gray-200">
              <div className="bg-gray-50 rounded-lg aspect-video relative overflow-hidden border border-gray-200">
                <svg 
                  className="w-full h-full" 
                  viewBox="0 0 800 450"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* 背景（PDF風） */}
                  <rect width="800" height="450" fill="#ffffff" />
                  
                  {/* タイトル */}
                  {animationStep >= 1 && (
                    <text
                      x="400"
                      y="30"
                      fill="#1f2937"
                      fontSize="24"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="transition-opacity duration-500"
                      style={{ opacity: animationStep >= 1 ? 1 : 0 }}
                    >
                      トーナメント表
                    </text>
                  )}
                  
                  {/* トーナメント表のツリー構造 */}
                  {animationStep >= 1 && (
                    <g className="transition-opacity duration-500" style={{ opacity: animationStep >= 1 ? 1 : 0 }}>
                      {/* 参加者（左側）- テキスト形式（均等間隔） */}
                      <g>
                        <text x="50" y="100" fill="#374151" fontSize="14" dominantBaseline="middle">1 選手A</text>
                        <text x="50" y="160" fill="#374151" fontSize="14" dominantBaseline="middle">2 選手B</text>
                        <text x="50" y="220" fill="#374151" fontSize="14" dominantBaseline="middle">3 選手C</text>
                        <text x="50" y="280" fill="#374151" fontSize="14" dominantBaseline="middle">4 選手D</text>
                      </g>
                      
                      {/* 接続線（基本構造 - 直角線、均等間隔、全ての横線の長さを統一） */}
                      {/* 横線の長さを統一: 全ての横線を80pxに統一 */}
                      {/* 選手Aの接続線 */}
                      <path d="M 180 100 L 260 100 L 260 130 L 340 130 L 340 190 L 420 190 L 420 190 L 500 190" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                      {/* 選手Bの接続線 */}
                      <path d="M 180 160 L 260 160 L 260 130 L 340 130 L 340 190 L 420 190 L 420 190 L 500 190" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                      {/* 選手Cの接続線 */}
                      <path d="M 180 220 L 260 220 L 260 250 L 340 250 L 340 190 L 420 190 L 420 190 L 500 190" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                      {/* 選手Dの接続線 */}
                      <path d="M 180 280 L 260 280 L 260 250 L 340 250 L 340 190 L 420 190 L 420 190 L 500 190" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                    </g>
                  )}
                  
                  {/* アニメーション付きの勝者ライン（赤 - 直角線） */}
                  {animationStep >= 2 && (
                    <g>
                      {/* ステップ2: 1選手Aのライン - 横線→縦線→横線まで（準決勝の合流点まで） */}
                      <path
                        d="M 180 100 L 260 100 L 260 130 L 340 130"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        pathLength="100"
                        strokeDasharray="100"
                        className="transition-all duration-700 ease-out"
                        style={{
                          strokeDashoffset: animationStep >= 2 ? "0" : "100",
                          opacity: animationStep >= 2 ? 1 : 0,
                        }}
                      />
                    </g>
                  )}
                  
                  {animationStep >= 5 && (
                    <g>
                      {/* ステップ5: 3選手Cのライン - 横線→縦線→横線まで（準決勝の合流点まで） */}
                      <path
                        d="M 180 220 L 260 220 L 260 250 L 340 250"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        pathLength="100"
                        strokeDasharray="100"
                        className="transition-all duration-700 ease-out"
                        style={{
                          strokeDashoffset: animationStep >= 5 ? "0" : "100",
                          opacity: animationStep >= 5 ? 1 : 0,
                        }}
                      />
                    </g>
                  )}
                  
                  {animationStep >= 8 && (
                    <g>
                      {/* ステップ8: 決勝のライン - 1選手Aから決勝まで（横線の長さを統一） */}
                      <path
                        d="M 340 130 L 340 190 L 420 190 L 420 190 L 500 190"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        pathLength="100"
                        strokeDasharray="100"
                        className="transition-all duration-700 ease-out"
                        style={{
                          strokeDashoffset: animationStep >= 8 ? "0" : "100",
                          opacity: animationStep >= 8 ? 1 : 0,
                        }}
                      />
                    </g>
                  )}
                  
                  {/* アニメーション付きのスコア表示 */}
                  {animationStep >= 3 && (
                    <g>
                      {/* ステップ3: 1選手Aのスコア（勝者）- 直角部分の真上に「④」 */}
                      <text
                        x="260"
                        y="85"
                        fill="#ef4444"
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="transition-opacity duration-300"
                        style={{ opacity: animationStep >= 3 ? 1 : 0 }}
                      >
                        ④
                      </text>
                    </g>
                  )}
                  
                  {animationStep >= 4 && (
                    <g>
                      {/* ステップ4: 2選手Bのスコア（敗者）- 直角部分の真下に「2」 */}
                      <text
                        x="260"
                        y="175"
                        fill="#ef4444"
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="transition-opacity duration-300"
                        style={{ opacity: animationStep >= 4 ? 1 : 0 }}
                      >
                        2
                      </text>
                    </g>
                  )}
                  
                  {animationStep >= 6 && (
                    <g>
                      {/* ステップ6: 3選手Cのスコア（勝者）- 直角部分の真上に「④」 */}
                      <text
                        x="260"
                        y="205"
                        fill="#ef4444"
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="transition-opacity duration-300"
                        style={{ opacity: animationStep >= 6 ? 1 : 0 }}
                      >
                        ④
                      </text>
                    </g>
                  )}
                  
                  {animationStep >= 7 && (
                    <g>
                      {/* ステップ7: 4選手Dのスコア（敗者）- 直角部分の真下に「1」 */}
                      <text
                        x="260"
                        y="295"
                        fill="#ef4444"
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="transition-opacity duration-300"
                        style={{ opacity: animationStep >= 7 ? 1 : 0 }}
                      >
                        1
                      </text>
                    </g>
                  )}
                  
                  {animationStep >= 9 && (
                    <g>
                      {/* ステップ9: 1選手Aのスコア（勝者）- 決勝の直角部分の真上に「④」 */}
                      <text
                        x="340"
                        y="115"
                        fill="#ef4444"
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="transition-opacity duration-300"
                        style={{ opacity: animationStep >= 9 ? 1 : 0 }}
                      >
                        ④
                      </text>
                    </g>
                  )}
                  
                  {animationStep >= 10 && (
                    <g>
                      {/* ステップ10: 3選手Cのスコア（敗者）- 決勝の直角部分の真下に「3」 */}
                      <text
                        x="340"
                        y="265"
                        fill="#ef4444"
                        fontSize="16"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="transition-opacity duration-300"
                        style={{ opacity: animationStep >= 10 ? 1 : 0 }}
                      >
                        3
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points Section */}
        <section id="pain-points" className="py-12 sm:py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 sm:mb-16 leading-tight">
              大会現場で<br className="sm:hidden" />
              よくある問題
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-12 sm:mb-16">
              {/* Before */}
              <div className="bg-white border-l-4 border-red-500 rounded-r-lg shadow-md p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-5 sm:mb-6">
                  <div className="bg-red-50 p-2 rounded-lg flex-shrink-0">
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-red-900 leading-tight mb-1">Before</h3>
                    <p className="text-xs sm:text-sm text-red-700">紙の掲示板だと…</p>
                  </div>
                </div>
                <div className="space-y-4 text-gray-700">
                  <div className="bg-red-50 rounded-lg p-3 sm:p-4">
                    <h4 className="font-semibold text-red-800 mb-2 text-sm sm:text-base leading-relaxed">広い会場では、<br className="sm:hidden" />掲示板への往復だけで一苦労</h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-gray-700">
                      更新が遅れ、情報のタイムラグが<br className="sm:hidden" />
                      進行遅延や現場の混乱を招きます。
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 sm:p-4">
                    <h4 className="font-semibold text-red-800 mb-2 text-sm sm:text-base leading-relaxed">狭い会場では、<br className="sm:hidden" />本部が「密」になる</h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-gray-700">
                      掲示板が本部付近にしかない場合、<br className="sm:hidden" />
                      進捗を知りたい選手や監督が集中し、<br className="sm:hidden" />
                      運営業務の妨げに。
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
                      <li>「今どこまで進んでいるの？」と何度も聞かれる</li>
                      <li>全ての掲示板に結果を貼り直す必要がある</li>
                      <li>SNSでは情報が断片的</li>
                      <li>Webサイト更新に専門知識が必要</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* After */}
              <div className="bg-white border-l-4 border-blue-500 rounded-r-lg shadow-md p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-5 sm:mb-6">
                  <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-blue-900 leading-tight mb-1">After</h3>
                    <p className="text-xs sm:text-sm text-blue-700">ScoreFlowなら！</p>
                  </div>
                </div>
                <div className="space-y-4 text-gray-700">
                  <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                    <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base leading-relaxed">どこにいても<br className="sm:hidden" />「今」がわかる</h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-gray-700">
                      会場に向かう保護者、<br className="sm:hidden" />
                      遠くにいる監督、待機中の選手。<br className="sm:hidden" />
                      スマホ一つで、リアルタイムの進捗が<br className="sm:hidden" />
                      全員の手元に届きます。
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                    <h4 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base leading-relaxed">「もう聞かれない」<br className="sm:hidden" />運営へ</h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-gray-700">
                      全員が自分のスマホで確認できるから、<br className="sm:hidden" />
                      本部への問い合わせが激減。<br className="sm:hidden" />
                      運営チームは大会進行に集中できます。
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
                      <li>進行状況を1画面で可視化</li>
                      <li>入力した瞬間に全員へ反映</li>
                      <li>結果記入の往復の必要なし</li>
                      <li>ITに詳しくなくても使える</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section id="solution" className="py-12 sm:py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-6 sm:mb-8 leading-tight px-2">
              結果記入の往復の必要なし。<br />
              専門知識不要。<br className="sm:hidden" />
              リアルタイム。
            </h2>
            <p className="text-base sm:text-xl text-gray-700 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2">
              ScoreFlowは、PDFで配布されがちな<br className="sm:hidden" />
              大会トーナメント表をそのまま活かし、<br className="sm:hidden" />
              観客・選手・関係者が<br className="sm:hidden" />
              "今どうなっているのか"を<br className="sm:hidden" />
              直感的に把握できる体験を提供します。
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-md">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2">PDFを作り直さない</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  既存のトーナメント表PDFを<br className="sm:hidden" />
                  そのままアップロード。<br className="sm:hidden" />
                  表示レイヤーとして重ねて表示するだけ。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-md">
                <Zap className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2">リアルタイム反映</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  入力した瞬間に全員へ反映。<br className="sm:hidden" />
                  会場にいなくても、<br className="sm:hidden" />
                  スマホ一つで最新の進行状況を<br className="sm:hidden" />
                  確認できます。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-md sm:col-span-2 md:col-span-1">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2">専門知識不要</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  ITに詳しくなくても使える<br className="sm:hidden" />
                  直感的なUI。<br className="sm:hidden" />
                  クリックで描画、<br className="sm:hidden" />
                  ドラッグで配置するだけ。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-12 sm:py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 sm:mb-16 leading-tight">
              使い方は<br className="sm:hidden" />
              3ステップ
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center">
                <div className="bg-blue-100 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">1</span>
                </div>
                <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">PDFをアップロード</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed px-2">
                  大会トーナメント表<br className="sm:hidden" />
                  （PDF、1ページのみ）をアップロード。<br className="sm:hidden" />
                  大会名を入力するだけ。
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">2</span>
                </div>
                <Share2 className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">URLを共有</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed px-2">
                  自動生成される短い公開URLを<br className="sm:hidden" />
                  参加者・観客に共有。<br className="sm:hidden" />
                  ログイン不要で誰でも閲覧可能。
                </p>
              </div>
              <div className="text-center sm:col-span-2 md:col-span-1">
                <div className="bg-blue-100 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">3</span>
                </div>
                <Zap className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">リアルタイム反映</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed px-2">
                  試合が進むたびに、<br className="sm:hidden" />
                  勝者ラインを描画し、<br className="sm:hidden" />
                  スコアを入力。<br className="sm:hidden" />
                  入力内容がリアルタイムで<br className="sm:hidden" />
                  全員に反映されます。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Key Benefits Section */}
        <section id="benefits" className="py-12 sm:py-20 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 sm:mb-16 leading-tight">
              ScoreFlowの特徴
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-gray-200">
                <Smartphone className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2 leading-tight">スマホ・PC<br className="sm:hidden" />完全対応</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  どこからでもアクセス可能。<br className="sm:hidden" />
                  レスポンシブデザインで、<br className="sm:hidden" />
                  あらゆるデバイスで快適に利用できます。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-gray-200">
                <Globe className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2 leading-tight">ログイン不要の<br className="sm:hidden" />閲覧機能</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  観客・選手は公開URLに<br className="sm:hidden" />
                  アクセスするだけで閲覧可能。<br className="sm:hidden" />
                  アカウント作成の手間がありません。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-gray-200">
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2 leading-tight">リアルタイム更新</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  運営者が入力した内容が、<br className="sm:hidden" />
                  即座に全員の画面に反映。<br className="sm:hidden" />
                  情報のタイムラグがありません。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-gray-200">
                <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2 leading-tight">PDFを作り直さない</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  既存のトーナメント表を<br className="sm:hidden" />
                  そのまま活用。<br className="sm:hidden" />
                  PDF編集の専門知識は不要です。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-gray-200">
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2 leading-tight">大会運営に特化</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  トーナメント形式の競技に最適化。<br className="sm:hidden" />
                  卓球・バドミントン・テニスなど、<br className="sm:hidden" />
                  あらゆる競技に対応。
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-gray-200">
                <Download className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 mb-3 sm:mb-4" />
                <h3 className="font-bold text-base sm:text-lg mb-2 leading-tight">成果物の<br className="sm:hidden" />ダウンロード</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  大会終了後、完成した<br className="sm:hidden" />
                  トーナメント表をPDF/画像形式で<br className="sm:hidden" />
                  ダウンロード可能（実装予定）。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA Section */}
        <section id="cta" className="py-12 sm:py-20 px-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 leading-tight">
              今すぐ始めましょう
            </h2>
            <p className="text-base sm:text-xl mb-6 sm:mb-8 text-blue-100 leading-relaxed px-2">
              「もう聞かれない」<br className="sm:hidden" />
              「もう迷わない」<br className="sm:hidden" />
              大会運営を、<br className="sm:hidden" />
              ScoreFlowで実現してください。
            </p>
            <p className="text-sm sm:text-lg mb-8 sm:mb-12 text-blue-50 leading-relaxed px-2">
              試合のスコアと大会の流れを、<br className="sm:hidden" />
              止めずに共有する。
            </p>
            <button
              onClick={handleSignIn}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 sm:py-4 px-6 sm:px-8 rounded-lg shadow-lg transition-all duration-200 text-base sm:text-lg flex items-center gap-2 mx-auto hover:shadow-xl hover:scale-105"
              type="button"
            >
              Googleで無料で始める
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <p className="text-xs sm:text-sm text-blue-200 mt-4 sm:mt-6 px-2">
              ※ Googleアカウントがあれば、<br className="sm:hidden" />
              すぐに利用開始できます
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-8 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-sm">
              © 2024 ScoreFlow. All rights reserved.
            </p>
          </div>
        </footer>
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
              <a
                href="https://scoreflow-eight.vercel.app/"
                className="mr-8 flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="relative h-6 w-6">
                  <Image 
                    src="/logo.png" 
                    alt="ScoreFlow" 
                    fill
                    className="object-contain"
                    unoptimized
                    onError={(e) => {
                      // 画像が読み込めない場合は非表示にする
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <span className="text-base text-gray-700 font-medium">ScoreFlow</span>
              </a>

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
              <div className="grid grid-cols-1 gap-4 px-4 py-2">
                <div className="text-xs font-medium text-gray-700">名称</div>
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

