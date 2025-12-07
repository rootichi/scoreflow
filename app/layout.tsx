import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScoreFlow - 大会進行状況リアルタイム発信",
  description: "トーナメント表をリアルタイムで更新・共有",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}




