import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tournament } from "@/lib/firebase/types";
import { getPublicUrl, copyToClipboard } from "@/lib/utils/url";
import { showSuccess, showError } from "@/lib/utils/notification";
import { Logo } from "@/components/common/Logo";

interface TournamentHeaderProps {
  tournament: Tournament;
}

/**
 * トーナメント編集ページのヘッダーコンポーネント
 */
export function TournamentHeader({ tournament }: TournamentHeaderProps) {
  const router = useRouter();

  const handleCopyPublicUrl = async () => {
    try {
      const url = getPublicUrl(tournament.publicUrlId);
      await copyToClipboard(url);
      showSuccess("公開URLをコピーしました");
    } catch (error) {
      console.error("Failed to copy URL:", error);
      showError("URLのコピーに失敗しました");
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-gray-200" style={{ touchAction: "pan-x pan-y" }}>
      {/* 1段目: ロゴとナビゲーション */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo href="https://scoreflow-eight.vercel.app/" />
            <div className="flex gap-4 items-center">
              <button
                onClick={handleCopyPublicUrl}
                className="text-sm text-blue-600 hover:text-blue-700"
                type="button"
              >
                公開URL
              </button>
              <button
                onClick={() => router.push("/")}
                className="text-sm text-gray-600 hover:text-gray-900"
                type="button"
              >
                戻る
              </button>
            </div>
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
  );
}

