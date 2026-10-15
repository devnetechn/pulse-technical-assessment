import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the ngrok tunnel host to access dev resources (HMR, etc.).
  allowedDevOrigins: ["kind-intensely-herring.ngrok-free.app"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
