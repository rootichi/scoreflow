import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { VersionBadge } from "@/components/common/VersionBadge";

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
      <head>
        {/* Eruda: モバイル用デベロッパーツール */}
        <Script
          src="https://cdn.jsdelivr.net/npm/eruda"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== "undefined" && (window as any).eruda) {
              (window as any).eruda.init();
            }
          }}
        />
      </head>
      <body style={{ touchAction: "manipulation" }}>
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}




