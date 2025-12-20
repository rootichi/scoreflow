"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase/auth";
import { createTournament } from "@/lib/firebase/tournaments";
import { convertPdfToBase64 } from "@/lib/pdf/converter";

export default function CreateTournamentClient() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth!);
  const [name, setName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setError(null);
    } else {
      setError("PDFファイルを選択してください");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("大会名を入力してください");
      return;
    }

    if (!pdfFile) {
      setError("PDFファイルを選択してください");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // PDFをBase64に変換
      console.log("PDF変換を開始します...");
      const base64Image = await convertPdfToBase64(pdfFile, 2.5);
      console.log("PDF変換が完了しました。画像サイズ:", base64Image.length, "文字");
      
      // 画像サイズチェック（Firestoreの1MB制限を考慮）
      if (base64Image.length > 900000) {
        throw new Error("画像が大きすぎます。PDFファイルを小さくするか、別のPDFファイルを試してください。");
      }
      
      // 大会を作成
      console.log("大会を作成します...");
      const tournamentId = await createTournament(name, base64Image, user.uid);
      console.log("大会の作成が完了しました。ID:", tournamentId);
      
      // 編集ページに遷移
      router.push(`/tournament/${tournamentId}`);
    } catch (err) {
      console.error("Error creating tournament:", err);
      let errorMessage = "大会の作成に失敗しました";
      
      if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
        // Firebaseエラーの場合、より詳細なメッセージを表示
        if (errorMessage.includes("permission")) {
          errorMessage = "権限がありません。Firestoreのセキュリティルールを確認してください。";
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          errorMessage = "ネットワークエラーが発生しました。接続を確認してください。";
        } else if (errorMessage.includes("Canvas")) {
          errorMessage = "PDFの変換に失敗しました。PDFファイルが正しいか確認してください。";
        }
      }
      
      setError(errorMessage);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold">ScoreFlow</h1>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              戻る
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold mb-6">新規大会作成</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                大会名
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: 2024年春季大会"
                required
              />
            </div>

            <div>
              <label htmlFor="pdf" className="block text-sm font-medium text-gray-700 mb-2">
                PDFファイル（1ページのみ）
              </label>
              <input
                id="pdf"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {pdfFile && (
                <p className="mt-2 text-sm text-gray-500">
                  選択中: {pdfFile.name}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={uploading}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
                disabled={uploading}
              >
                {uploading ? "作成中..." : "作成"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}


