/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Next.js 16ではTurbopackがデフォルトだが、webpack設定を使用するため空のturbopack設定を追加
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // ビルド時にデプロイ時刻を環境変数として設定
  // NEXT_PUBLIC_プレフィックスを付けることで、クライアント側でもアクセス可能
  env: {
    NEXT_PUBLIC_DEPLOY_TIME: new Date().toISOString(),
  },
}

module.exports = nextConfig

