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

// v0仕様: ブラウザ標準のピンチズームを完全に無効化
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" style={{ touchAction: "manipulation", overflow: "hidden", overscrollBehavior: "none" }}>
      <head>
        {/* v0仕様: ブラウザ標準のピンチズームを完全に無効化 */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
      </head>
      <body style={{ touchAction: "manipulation", overflow: "hidden", overscrollBehavior: "none", position: "fixed", width: "100%", height: "100%" }}>
        <ErudaLoader />
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}




