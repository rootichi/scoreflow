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

// v1仕様: ブラウザ標準のピンチズームを有効化
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* v1仕様: ブラウザ標準のピンチズームを有効化 */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <ErudaLoader />
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}




