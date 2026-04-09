import type { Metadata } from "next";
import { Suspense } from "react";

import { HomeCheckoutRedirect } from "@/components/marketing/HomeCheckoutRedirect";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "BofBot — Batch edit TikTok Shop videos in seconds",
  description:
    "Add overlays, hooks, and urgency text to 50+ videos at once. Banner and fulltext styles, local processing, built for TikTok Shop creators.",
};

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <HomeCheckoutRedirect />
      </Suspense>
      <LandingPage />
    </>
  );
}
