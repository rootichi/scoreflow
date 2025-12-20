import CreateTournamentClient from "./CreateTournamentClient";

// Next.js 16: 動的レンダリングを強制（Firebase認証が必要なため）
export const dynamic = 'force-dynamic';

export default function CreateTournamentPage() {
  return <CreateTournamentClient />;
}
