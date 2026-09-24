import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return process.env.NEXT_PUBLIC_NEXUSCARGO_PUBLIC_DEMO === "true"
      ? [{ source: "/login", destination: "/", permanent: false }]
      : [];
  },
};

export default nextConfig;
