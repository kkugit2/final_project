import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "www.foodsafetykorea.go.kr",
      },
      {
        protocol: "https",
        hostname: "www.foodsafetykorea.go.kr",
      },
    ],
  },
};

export default nextConfig;
