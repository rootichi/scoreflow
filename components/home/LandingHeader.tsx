"use client";

import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/common/Logo";

interface LandingHeaderProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  onSignIn: () => void;
}

/**
 * ランディングページのヘッダーコンポーネント
 */
export function LandingHeader({ isMenuOpen, setIsMenuOpen, onSignIn }: LandingHeaderProps) {
  const handleScrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 border-b border-blue-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo href="https://scoreflow-eight.vercel.app/" textClassName="text-white" />

            <div className="flex items-center gap-2 sm:gap-4">
              <nav className="hidden md:flex items-center gap-8">
                <a
                  href="#pain-points"
                  className="text-sm text-white/90 hover:text-white transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScrollTo("pain-points");
                  }}
                >
                  課題解決
                </a>
                <a
                  href="#features"
                  className="text-sm text-white/90 hover:text-white transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScrollTo("features");
                  }}
                >
                  使い方
                </a>
                <a
                  href="#benefits"
                  className="text-sm text-white/90 hover:text-white transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScrollTo("benefits");
                  }}
                >
                  特徴
                </a>
              </nav>
              <button
                onClick={onSignIn}
                className="hidden md:flex bg-white text-blue-600 hover:bg-gray-100 font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-200 text-sm items-center gap-2 hover:shadow-lg hover:scale-105 whitespace-nowrap"
                type="button"
              >
                Googleで無料で始める
              </button>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-white p-2"
                type="button"
                aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* モバイルサイドバー */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 md:hidden transform transition-transform duration-300 overflow-y-auto">
            <div className="flex flex-col min-h-full">
              <div className="flex items-center justify-end p-4 border-b border-gray-200 flex-shrink-0">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                  type="button"
                  aria-label="メニューを閉じる"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                <a
                  href="#pain-points"
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMenuOpen(false);
                    handleScrollTo("pain-points");
                  }}
                >
                  課題解決
                </a>
                <a
                  href="#features"
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMenuOpen(false);
                    handleScrollTo("features");
                  }}
                >
                  使い方
                </a>
                <a
                  href="#benefits"
                  className="block text-gray-700 hover:text-blue-600 transition-colors py-2"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMenuOpen(false);
                    handleScrollTo("benefits");
                  }}
                >
                  特徴
                </a>
              </nav>
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onSignIn();
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 text-sm flex items-center justify-center gap-2 hover:shadow-lg"
                  type="button"
                >
                  Googleで無料で始める
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

