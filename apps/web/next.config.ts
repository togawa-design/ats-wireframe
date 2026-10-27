import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 社内向け管理画面のため常に最新データを表示したい。Cache Components(PPR)の
  // 静的キャッシュ前提モデルは有効化せず、素のSSR(動的レンダリング)で統一する。
  experimental: {
    // ビルド/起動のたびにセキュリティアップグレード通知でCI・E2Eが止まるため一時的に無効化。
    // 本体のアップグレード対応はissue #47で別途追跡する。
    agentUpgrade: false,
  },
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
