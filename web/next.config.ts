import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bust browser/CDN cache for /public/videos/demo*.mp4 when filenames stay the same.
  env: {
    NEXT_PUBLIC_DEMO_ASSET_REV:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "",
  },
  // Allow dev API / RSC when the app is opened via http://127.0.0.1:3000 (not only "localhost").
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      {
        source: "/pricing",
        destination: "/#pricing",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
