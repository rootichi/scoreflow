import type { Metadata } from "next";
import "./globals.css";
import { VersionBadge } from "@/components/common/VersionBadge";
import { ErudaLoader } from "@/components/common/ErudaLoader";

export const metadata: Metadata = {
  title: "ScoreFlow - 大会進行状況リアルタイム発信",
  description: "トーナメント表をリアルタイムで更新・共有",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" style={{ touchAction: "manipulation" }}>
      <body style={{ touchAction: "manipulation" }}>
        <ErudaLoader />
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}




