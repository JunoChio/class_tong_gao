/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出模式：完美适配 Cloudflare Pages 免费版（不限流量），
  // 配合根目录 functions/api/board.js 提供云端 KV 实时读写接口！
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
