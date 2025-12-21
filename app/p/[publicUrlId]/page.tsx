"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTournamentByPublicUrlId, subscribeMarks } from "@/lib/firebase/tournaments";
import { Tournament, Mark } from "@/lib/firebase/types";

export default function PublicTournamentPage() {
  const params = useParams();
  const publicUrlId = params.publicUrlId as string;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [marks, setMarks] = useState<Array<Mark & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTournament = async () => {
      try {
        const data = await getTournamentByPublicUrlId(publicUrlId);
        if (!data) {
          setError("大会が見つかりません");
          setLoading(false);
          return;
        }
        setTournament(data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading tournament:", err);
        setError("大会の読み込みに失敗しました");
        setLoading(false);
      }
    };

    if (publicUrlId) {
      loadTournament();
    }
  }, [publicUrlId]);

  useEffect(() => {
    if (!tournament) return;

    const unsubscribe = subscribeMarks(tournament.id, (updatedMarks) => {
      setMarks(updatedMarks);
    });

    return () => unsubscribe();
  }, [tournament]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">エラー</h1>
          <p className="text-gray-600">{error || "大会が見つかりません"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="ScoreFlow" 
                className="h-6 w-6 object-contain"
              />
              <h1 className="text-xl font-bold">{tournament.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="ScoreFlow" 
                className="h-5 w-5 object-contain opacity-60"
              />
              <span className="text-sm text-gray-500">ScoreFlow</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="relative">
            <img
              src={tournament.pdfPageImage}
              alt="Tournament bracket"
              className="w-full h-auto"
            />
            {/* マークを描画 */}
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {marks
                .filter((m) => m.type === "line")
                .map((mark) => (
                  <line
                    key={mark.id}
                    x1={mark.x1 * 100}
                    y1={mark.y1 * 100}
                    x2={mark.x2 * 100}
                    y2={mark.y2 * 100}
                    stroke={mark.color}
                    strokeWidth="0.3"
                  />
                ))}
            </svg>
            {marks
              .filter((m) => m.type === "score")
              .map((mark) => (
                <div
                  key={mark.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${mark.x * 100}%`,
                    top: `${mark.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${mark.fontSize}px`,
                    color: mark.color,
                    fontWeight: "bold",
                    zIndex: 10,
                  }}
                >
                  {mark.value}
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}

