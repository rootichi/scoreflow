import { Tournament } from "@/lib/firebase/types";
import { Logo } from "@/components/common/Logo";

interface TournamentHeaderProps {
  tournament: Tournament;
}

/**
 * トーナメント編集ページのヘッダーコンポーネント
 */
export function TournamentHeader({ tournament }: TournamentHeaderProps) {

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-white shadow-sm border-b border-gray-200" style={{ touchAction: "none" }}>
      {/* 1段目: ロゴとナビゲーション */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo href="https://scoreflow-eight.vercel.app/" />
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

