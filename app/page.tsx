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
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [animationStep, setAnimationStep] = useState(0);

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
    
    const startAnimation = () => {
      // アニメーションをリセット
      setAnimationStep(0);
      
      // ステップ1: トーナメント表を表示（0.3秒後）
      const timer1 = setTimeout(() => setAnimationStep(1), 300);
      
      // ステップ2: 選手Aのラインを描画（1.2秒後）
      const timer2 = setTimeout(() => setAnimationStep(2), 1200);
      
      // ステップ3: 選手Bのラインを描画（2.1秒後）
      const timer3 = setTimeout(() => setAnimationStep(3), 2100);
      
      // ステップ4: 選手Cのラインを描画（3.0秒後）
      const timer4 = setTimeout(() => setAnimationStep(4), 3000);
      
      // ステップ5: 選手Dのラインを描画（3.9秒後）
      const timer5 = setTimeout(() => setAnimationStep(5), 3900);
      
      // ステップ6: スコアを表示（4.8秒後）
      const timer6 = setTimeout(() => setAnimationStep(6), 4800);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        clearTimeout(timer5);
        clearTimeout(timer6);
      };
    };
    
    // 初回実行
    const cleanup1 = startAnimation();
    
    // 6.5秒ごとにループ
    intervalId = setInterval(() => {
      startAnimation();
    }, 6500);

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
        {/* Hero Section */}
        <section id="hero" className="relative bg-gradient-to-br from-blue-50 via-white to-gray-50 pt-20 pb-32 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              ScoreFlow
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-4 font-medium">
              今、どこまで進んでる？が一瞬で分かる。
            </p>
            <p className="text-lg md:text-xl text-gray-600 mb-8">
              トーナメント表に、リアルタイムを。
            </p>
            <p className="text-base text-gray-500 mb-12 max-w-2xl mx-auto">
              大会運営のストレスをゼロに。PDFを作り直す必要なし、専門知識不要。
              入力した瞬間に全員へ反映される、大会進行状況可視化SaaSです。
            </p>
            <button
              onClick={handleSignIn}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transition-all duration-200 text-lg flex items-center gap-2 mx-auto hover:shadow-xl hover:scale-105"
              type="button"
            >
              Googleで無料で始める
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* UIモック風のグラフィック - リアルなトーナメント表 + アニメーション */}
          <div className="max-w-5xl mx-auto mt-16 px-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 border border-gray-200">
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
                      {/* 参加者（左側）- テキスト形式 */}
                      <g>
                        <text x="50" y="100" fill="#374151" fontSize="14" dominantBaseline="middle">1 選手A</text>
                        <text x="50" y="150" fill="#374151" fontSize="14" dominantBaseline="middle">2 選手B</text>
                        <text x="50" y="220" fill="#374151" fontSize="14" dominantBaseline="middle">3 選手C</text>
                        <text x="50" y="270" fill="#374151" fontSize="14" dominantBaseline="middle">4 選手D</text>
                      </g>
                      
                      {/* 優勝者（右端） */}
                      <g>
                        <rect x="650" y="165" width="120" height="30" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" rx="4" />
                        <text x="710" y="185" fill="#92400e" fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">優勝者</text>
                      </g>
                      
                      {/* 接続線（基本構造 - 直角線） */}
                      {/* 選手Aの接続線 */}
                      <path d="M 180 95 L 200 95 L 200 120 L 300 120 L 300 180 L 450 180 L 450 180 L 650 180" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                      {/* 選手Bの接続線 */}
                      <path d="M 180 145 L 200 145 L 200 120 L 300 120 L 300 180 L 450 180 L 450 180 L 650 180" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                      {/* 選手Cの接続線 */}
                      <path d="M 180 215 L 200 215 L 200 240 L 300 240 L 300 180 L 450 180 L 450 180 L 650 180" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                      {/* 選手Dの接続線 */}
                      <path d="M 180 265 L 200 265 L 200 240 L 300 240 L 300 180 L 450 180 L 450 180 L 650 180" 
                            stroke="#9ca3af" strokeWidth="1" fill="none" />
                    </g>
                  )}
                  
                  {/* アニメーション付きの勝者ライン（赤 - 直角線） */}
                  {animationStep >= 2 && (
                    <g>
                      {/* 1本目のライン（選手A → 優勝者への直角線） */}
                      <path
                        d="M 180 95 L 200 95 L 200 120 L 300 120 L 300 180 L 450 180 L 450 180 L 650 180"
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
                  
                  {animationStep >= 3 && (
                    <g>
                      {/* 2本目のライン（選手B → 優勝者への直角線） */}
                      <path
                        d="M 180 145 L 200 145 L 200 120 L 300 120 L 300 180 L 450 180 L 450 180 L 650 180"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        pathLength="100"
                        strokeDasharray="100"
                        className="transition-all duration-700 ease-out"
                        style={{
                          strokeDashoffset: animationStep >= 3 ? "0" : "100",
                          opacity: animationStep >= 3 ? 1 : 0,
                        }}
                      />
                    </g>
                  )}
                  
                  {animationStep >= 4 && (
                    <g>
                      {/* 3本目のライン（選手C → 優勝者への直角線） */}
                      <path
                        d="M 180 215 L 200 215 L 200 240 L 300 240 L 300 180 L 450 180 L 450 180 L 650 180"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        pathLength="100"
                        strokeDasharray="100"
                        className="transition-all duration-700 ease-out"
                        style={{
                          strokeDashoffset: animationStep >= 4 ? "0" : "100",
                          opacity: animationStep >= 4 ? 1 : 0,
                        }}
                      />
                    </g>
                  )}
                  
                  {animationStep >= 5 && (
                    <g>
                      {/* 4本目のライン（選手D → 優勝者への直角線） */}
                      <path
                        d="M 180 265 L 200 265 L 200 240 L 300 240 L 300 180 L 450 180 L 450 180 L 650 180"
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
                  
                  {/* アニメーション付きのスコア表示 */}
                  {animationStep >= 6 && (
                    <g
                      className="transition-opacity duration-500"
                      style={{ opacity: animationStep >= 6 ? 1 : 0 }}
                    >
                      {/* スコア1（1回戦：選手A vs 選手B） */}
                      <rect x="195" y="110" width="50" height="20" fill="#ffffff" stroke="#ef4444" strokeWidth="2" rx="4" />
                      <text
                        x="220"
                        y="123"
                        fill="#ef4444"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        21-19
                      </text>
                      
                      {/* スコア2（準決勝） */}
                      <rect x="295" y="170" width="50" height="20" fill="#ffffff" stroke="#ef4444" strokeWidth="2" rx="4" />
                      <text
                        x="320"
                        y="183"
                        fill="#ef4444"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        18-21
                      </text>
                      
                      {/* スコア3（決勝） */}
                      <rect x="445" y="170" width="50" height="20" fill="#ffffff" stroke="#ef4444" strokeWidth="2" rx="4" />
                      <text
                        x="470"
                        y="183"
                        fill="#ef4444"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        21-15
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points Section */}
        <section id="pain-points" className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
              大会現場でよくある問題
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {/* Before */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <h3 className="text-2xl font-bold text-red-900">Before：紙の掲示板だと…</h3>
                </div>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">広い会場では、掲示板への往復だけで一苦労</h4>
                    <p className="text-sm">
                      更新が遅れ、情報のタイムラグが進行遅延や現場の混乱を招きます。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">狭い会場では、本部が「密」になる</h4>
                    <p className="text-sm">
                      掲示板が本部付近にしかない場合、進捗を知りたい選手や監督が集中し、運営業務の妨げに。
                    </p>
                  </div>
                  <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 mt-4">
                    <li>「今どこまで進んでいるの？」と何度も聞かれる</li>
                    <li>全ての掲示板に結果を貼り直す必要がある</li>
                    <li>SNSでは情報が断片的</li>
                    <li>Webサイト更新に専門知識が必要</li>
                  </ul>
                </div>
              </div>

              {/* After */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  <h3 className="text-2xl font-bold text-blue-900">After：ScoreFlowなら！</h3>
                </div>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-2">どこにいても「今」がわかる</h4>
                    <p className="text-sm">
                      会場に向かう保護者、遠くにいる監督、待機中の選手。スマホ一つで、リアルタイムの進捗が全員の手元に届きます。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-2">「もう聞かれない」運営へ</h4>
                    <p className="text-sm">
                      全員が自分のスマホで確認できるから、本部への問い合わせが激減。運営チームは大会進行に集中できます。
                    </p>
                  </div>
                  <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 mt-4">
                    <li>進行状況を1画面で可視化</li>
                    <li>入力した瞬間に全員へ反映</li>
                    <li>PDFを作り直す必要なし</li>
                    <li>ITに詳しくなくても使える</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section id="solution" className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
              PDFを作り直す必要なし。<br />
              専門知識不要。リアルタイム。
            </h2>
            <p className="text-xl text-gray-700 mb-12 max-w-3xl mx-auto">
              ScoreFlowは、PDFで配布されがちな大会トーナメント表をそのまま活かし、
              観客・選手・関係者が"今どうなっているのか"を直感的に把握できる体験を提供します。
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-md">
                <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">PDFを作り直さない</h3>
                <p className="text-gray-600 text-sm">
                  既存のトーナメント表PDFをそのままアップロード。表示レイヤーとして重ねて表示するだけ。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-md">
                <Zap className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">リアルタイム反映</h3>
                <p className="text-gray-600 text-sm">
                  入力した瞬間に全員へ反映。会場にいなくても、スマホ一つで最新の進行状況を確認できます。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-md">
                <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">専門知識不要</h3>
                <p className="text-gray-600 text-sm">
                  ITに詳しくなくても使える直感的なUI。クリックで描画、ドラッグで配置するだけ。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
              使い方は3ステップ
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <Upload className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-3">PDFをアップロード</h3>
                <p className="text-gray-600">
                  大会トーナメント表（PDF、1ページのみ）をアップロード。大会名を入力するだけ。
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-blue-600">2</span>
                </div>
                <Share2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-3">URLを共有</h3>
                <p className="text-gray-600">
                  自動生成される短い公開URLを参加者・観客に共有。ログイン不要で誰でも閲覧可能。
                </p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-blue-600">3</span>
                </div>
                <Zap className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-3">リアルタイム反映</h3>
                <p className="text-gray-600">
                  試合が進むたびに、勝者ラインを描画し、スコアを入力。入力内容がリアルタイムで全員に反映されます。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Key Benefits Section */}
        <section id="benefits" className="py-20 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
              ScoreFlowの特徴
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <Smartphone className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-2">スマホ・PC完全対応</h3>
                <p className="text-gray-600 text-sm">
                  どこからでもアクセス可能。レスポンシブデザインで、あらゆるデバイスで快適に利用できます。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <Globe className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-2">ログイン不要の閲覧機能</h3>
                <p className="text-gray-600 text-sm">
                  観客・選手は公開URLにアクセスするだけで閲覧可能。アカウント作成の手間がありません。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <Clock className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-2">リアルタイム更新</h3>
                <p className="text-gray-600 text-sm">
                  運営者が入力した内容が、即座に全員の画面に反映。情報のタイムラグがありません。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <FileText className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-2">PDFを作り直さない</h3>
                <p className="text-gray-600 text-sm">
                  既存のトーナメント表をそのまま活用。PDF編集の専門知識は不要です。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <Users className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-2">大会運営に特化</h3>
                <p className="text-gray-600 text-sm">
                  トーナメント形式の競技に最適化。卓球・バドミントン・テニスなど、あらゆる競技に対応。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <Download className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-2">成果物のダウンロード</h3>
                <p className="text-gray-600 text-sm">
                  大会終了後、完成したトーナメント表をPDF/画像形式でダウンロード可能（実装予定）。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA Section */}
        <section id="cta" className="py-20 px-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              今すぐ始めましょう
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              「もう聞かれない」「もう迷わない」大会運営を、ScoreFlowで実現してください。
            </p>
            <p className="text-lg mb-12 text-blue-50">
              試合のスコアと大会の流れを、止めずに共有する。
            </p>
            <button
              onClick={handleSignIn}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-4 px-8 rounded-lg shadow-lg transition-all duration-200 text-lg flex items-center gap-2 mx-auto hover:shadow-xl hover:scale-105"
              type="button"
            >
              Googleで無料で始める
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-sm text-blue-200 mt-6">
              ※ Googleアカウントがあれば、すぐに利用開始できます
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
