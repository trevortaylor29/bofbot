import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev API / RSC when the app is opened via http://127.0.0.1:3000 (not only "localhost").
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
