import type { NextConfig } from "next";
const backend = process.env.FLASK_URL || "http://127.0.0.1:5000";
const nextConfig: NextConfig = {

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/legacy/:path*", destination: `${backend}/:path*` },
      { source: "/static/:path*", destination: `${backend}/static/:path*` },
    ];
  },
};
export default nextConfig;

