"use client";

import { useRouter } from "next/navigation";
import { Tournament } from "@/lib/firebase/types";

interface TournamentListProps {
  tournaments: Tournament[];
  searchQuery: string;
}

/**
 * トーナメント一覧コンポーネント
 */
export function TournamentList({ tournaments, searchQuery }: TournamentListProps) {
  const router = useRouter();

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          {searchQuery.trim() ? "検索結果が見つかりませんでした" : "大会がありません"}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <tbody className="bg-white divide-y divide-gray-200">
          {tournaments.map((tournament) => (
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
  );
}

