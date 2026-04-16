import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";

import { AffiliateRefCapture } from "@/components/affiliate-ref-capture";
import { Providers } from "@/components/providers";

import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BofBot",
  description: "BofBot — TikTok Shop-style text overlays on your product videos",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${jakarta.variable} min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-100 antialiased`}
      >
        <Providers>
          <Suspense fallback={null}>
            <AffiliateRefCapture />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
