import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogoMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Mac Installation Guide — BofBot",
  description:
    "Install BofBot on macOS: open the DMG, drag to Applications, and run a one-time Terminal command for unsigned apps.",
};

const NOISE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function MacHelpPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-100 antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: NOISE_BG,
          backgroundSize: "120px 120px",
        }}
      />
      <header className="relative z-10 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white transition hover:opacity-90"
          >
            <BrandLogoMark className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-lg shadow-[#F43F5E]/30" />
            <span className="font-display text-lg font-semibold">BofBot</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Mac Installation Guide
        </h1>

        <p className="mt-8 text-base font-medium text-zinc-200">
          How to install BofBot on Mac:
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-400 marker:text-zinc-500 sm:text-base">
          <li>Download BofBot-Setup.dmg from our website</li>
          <li>Double-click the DMG — a window opens with BofBot and an Applications folder</li>
          <li>Drag BofBot into the Applications folder</li>
          <li>Close the DMG window</li>
          <li>
            Open Terminal (press Cmd+Space, type Terminal, press Enter)
          </li>
          <li>
            Paste this command and press Enter:{" "}
            <code className="mt-2 block rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2.5 font-mono text-[0.8rem] text-zinc-200 sm:text-sm">
              sudo xattr -cr /Applications/BofBot.app
            </code>
          </li>
          <li>
            Type your Mac password when asked (nothing appears while you type — that&apos;s
            normal) and press Enter
          </li>
          <li>Close Terminal</li>
          <li>Open BofBot from your Applications folder</li>
        </ol>

        <div className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold text-white">
            Why is this needed?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Mac blocks apps from new developers who haven&apos;t paid Apple&apos;s $99/year
            signing fee. This one-time command tells your Mac it&apos;s safe to open BofBot.
            The app runs entirely on your machine — your videos never leave your computer.
            We&apos;re working on getting officially signed so this step won&apos;t be needed
            in the future.
          </p>
        </div>

        <p className="mt-12 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-[#F43F5E] underline-offset-4 transition hover:text-[#fb7185] hover:underline"
          >
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
