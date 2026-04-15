"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, type ReactNode } from "react";

import { BrandLogoMark } from "@/components/brand-mark";
import {
  BofBotInstallerDownloadFooter,
  BofBotInstallerDownloadHero,
  BofBotInstallerDownloadNav,
} from "@/components/bofbot-installer-download";
import {
  PricingCheckoutButton,
  PricingFreeCta,
} from "@/components/marketing/PricingCheckoutButton";
import { planDefinition } from "@/lib/plans";
import { WINDOWS_SMARTSCREEN_FAQ } from "@/lib/windows-install-security-note";

/** SVG fractal noise tile (encoded for data URL). */
const NOISE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: easeOutExpo },
};

const itemFade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, ease: easeOutExpo },
};

const TAGLINE = "Built for creators who post, not edit.";

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] opacity-[0.028]"
      style={{
        backgroundImage: `url("${NOISE_DATA_URI}")`,
        backgroundRepeat: "repeat",
        backgroundSize: "120px 120px",
      }}
    />
  );
}

function SectionDivider() {
  return (
    <div
      className="flex justify-center px-5 py-0 sm:px-6"
      aria-hidden
    >
      <div className="h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-[#F43F5E]/35 to-transparent" />
    </div>
  );
}

function Nav() {
  const { data: session, status } = useSession();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 py-2.5 sm:px-6">
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <BrandLogoMark className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-lg shadow-[#F43F5E]/30" />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold leading-tight tracking-tight text-white">
              BofBot
            </div>
            <p className="mt-0.5 hidden text-[11px] leading-snug text-zinc-500 sm:block">
              {TAGLINE}
            </p>
          </div>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#pricing" className="transition hover:text-white">
            Pricing
          </a>
          <a href="#faq" className="transition hover:text-white">
            FAQ
          </a>
        </nav>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {status === "authenticated" && session?.user ? (
            <>
              <span
                className="hidden max-w-[10rem] truncate text-xs text-zinc-500 lg:inline"
                title={session.user.email ?? undefined}
              >
                {session.user.email}
              </span>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-[#F43F5E] transition hover:text-[#fb7185]"
              >
                Dashboard
              </Link>
            </>
          ) : status === "loading" ? (
            <span className="hidden w-16 animate-pulse rounded bg-zinc-800 sm:inline-block">
              &nbsp;
            </span>
          ) : (
            <Link
              href="/login"
              className="hidden text-sm text-zinc-400 transition hover:text-white sm:inline"
            >
              Log in
            </Link>
          )}
          <BofBotInstallerDownloadNav />
        </div>
      </div>
    </header>
  );
}

/** Eleven real BofBot output clips (`demo1`–`demo11`) in phone-style frames. */
const HERO_DEMO_COUNT = 11;
/** Per-deploy query string (see `next.config.ts`) so stale CDN/browser cache is not reused for same MP4 paths. */
const DEMO_ASSET_QS = (() => {
  const rev = process.env.NEXT_PUBLIC_DEMO_ASSET_REV;
  return rev ? `?v=${encodeURIComponent(rev)}` : "";
})();
const HERO_OUTPUT_VIDEOS = Array.from(
  { length: HERO_DEMO_COUNT },
  (_, i) => {
    const n = i + 1;
    return {
      src: `/videos/demo${n}.mp4${DEMO_ASSET_QS}`,
    };
  }
);

/** Vertical phone mockup: rounded frame, video fills (muted loop for hero marquee). */
function HeroVideoTile({ src, label }: { src: string; label: string }) {
  return (
    <div className="relative aspect-[9/16] w-[10.5rem] shrink-0 overflow-hidden rounded-[1.65rem] bg-zinc-950 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/[0.08] sm:w-[11.75rem] sm:rounded-[1.85rem] md:w-[12.5rem] md:rounded-[2rem] lg:w-[13.25rem]">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full object-cover object-center"
        src={src}
        preload="metadata"
        aria-label={label}
        {...({ "webkit-playsinline": "" } as Record<string, string>)}
      />
    </div>
  );
}

function HeroCarousel() {
  const items = HERO_OUTPUT_VIDEOS.map((v, i) => ({
    ...v,
    label: `Sample BofBot output video ${i + 1} of ${HERO_OUTPUT_VIDEOS.length}`,
  }));
  const loop = [...items, ...items];
  return (
    <div className="relative mx-auto mt-14 w-full max-w-[min(100%,90rem)] px-4 sm:mt-16 sm:px-6">
      <div className="relative overflow-hidden py-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0a0a0a] to-transparent sm:w-14 md:w-20" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0a0a0a] to-transparent sm:w-14 md:w-20" />
        <div className="flex w-max animate-hero-marquee flex-nowrap items-stretch gap-[1.4rem] md:gap-7 lg:gap-10 will-change-transform">
          {loop.map((item, i) => (
            <HeroVideoTile
              key={`${item.src}-${i}`}
              src={item.src}
              label={item.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-x-hidden px-5 pb-8 pt-28 sm:px-6 sm:pt-32">
      {/* Subtle neutral atmosphere behind hero (no color accent). */}
      <div
        className="pointer-events-none absolute left-1/2 top-6 z-0 h-[min(68vh,680px)] w-[min(94vw,56rem)] -translate-x-1/2 blur-[108px]"
        style={{
          background:
            "radial-gradient(ellipse 78% 58% at 50% 36%, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02) 46%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-28 z-0 h-[380px] w-[min(88vw,34rem)] -translate-x-1/2 blur-[76px]"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.05), transparent 68%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[22rem] z-0 hidden h-[200px] w-[min(100%,48rem)] -translate-x-1/2 opacity-70 blur-[100px] sm:block"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 0%, rgba(24, 24, 27, 0.85), transparent 65%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.div {...fadeUp} className="flex flex-col items-center gap-2">
          <span className="inline-flex cursor-default items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-zinc-300 transition duration-300 hover:border-[#F43F5E]/30 hover:bg-[#F43F5E]/[0.06] hover:shadow-[0_0_28px_-8px_rgba(244,63,94,0.22)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
            Built for TikTok Shop creators
          </span>
          <p className="text-center text-xs font-medium text-zinc-500 sm:hidden">
            {TAGLINE}
          </p>
        </motion.div>
        <div className="relative mt-8">
          <div
            className="pointer-events-none absolute left-1/2 top-[42%] z-0 h-[min(22rem,55vw)] w-[min(100%,40rem)] -translate-x-1/2 -translate-y-1/2 blur-[100px] sm:blur-[130px] md:top-1/2 md:h-[26rem] md:w-[44rem]"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(244, 63, 94, 0.11), transparent 72%)",
            }}
            aria-hidden
          />
          <motion.h1
            className="relative z-10 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[3.5rem]"
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
          >
            Batch edit TikTok Shop videos in{" "}
            <span
              className="text-[#F43F5E]"
              style={{
                textShadow:
                  "0 0 32px rgba(244, 63, 94, 0.35), 0 0 72px rgba(244, 63, 94, 0.12)",
              }}
            >
              seconds
            </span>
            .
          </motion.h1>
        </div>
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 sm:text-xl"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
        >
          Add overlays, hooks, and urgency text to 50+ videos at once. No more
          manual editing.
        </motion.p>
        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
        >
          <BofBotInstallerDownloadHero />
          <a
            href="#how-it-works"
            className="text-sm font-medium text-zinc-400 underline-offset-4 transition hover:text-white hover:underline"
          >
            See how it works
          </a>
        </motion.div>
      </div>
      <motion.div
        className="relative z-10"
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.2 }}
      >
        <HeroCarousel />
      </motion.div>
    </section>
  );
}

const steps = [
  {
    n: "1",
    title: "Film your products",
    desc: "Shoot raw clips on your phone — no editing yet.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    n: "2",
    title: "Drop videos into BofBot",
    desc: "Upload your batch, pick banner or fulltext style, add hooks.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    ),
  },
  {
    n: "3",
    title: "Download with overlays applied",
    desc: "Get polished, TikTok-ready files — all at once.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
    ),
  },
];

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-[#0a0a0a] px-5 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="font-display text-center text-3xl font-bold text-white sm:text-4xl"
          {...fadeUp}
        >
          How it works
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-xl text-center text-zinc-400"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          Three steps from raw footage to scroll-stopping listings.
        </motion.p>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              className="group relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-8 transition hover:border-white/15 hover:shadow-[0_0_40px_-16px_rgba(0,0,0,0.45)]"
              {...itemFade}
              transition={{ ...itemFade.transition, delay: i * 0.12 }}
            >
              <div className="mb-6 inline-flex rounded-xl bg-zinc-800/90 p-3 text-zinc-400">
                {s.icon}
              </div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#F43F5E]">
                Step {s.n}
              </div>
              <h3 className="font-display text-xl font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {s.desc}
              </p>
              {i < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden h-px w-8 -translate-y-1/2 bg-gradient-to-r from-zinc-600/50 to-transparent md:block" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.09 3.822-1.09 1.498 0 2.866.56 3.83 1.48-.283.3-1.87 1.95-1.87 4.36 0 3.32 2.63 4.44 2.746 4.51z" />
    </svg>
  );
}

function GoogleDriveGlyph({ className }: { className?: string }) {
  /* Simplified Drive wedge mark (brand colors, low-key at small size) */
  return (
    <svg
      className={className}
      viewBox="0 0 87.3 78"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <path fill="#0066DA" d="M6.6 66.85 18.75 45.78h41.85L48.45 66.85z" />
      <path fill="#00AC47" d="M43.5 24.78 31.35 45.85l21.15 36.5 12.15-21.07z" />
      <path fill="#EA4335" d="M21.45 45.85 6.45 71.78l42.9-.08 15-25.93z" />
    </svg>
  );
}

function GetVideosToPcSection() {
  return (
    <section
      aria-label="Getting videos into BofBot"
      className="scroll-mt-24 border-y border-white/[0.04] bg-[#0a0a0a]/80 px-5 py-14 sm:px-6 sm:py-16"
    >
      <div className="mx-auto max-w-4xl">
        <motion.h2
          className="font-display text-center text-lg font-semibold tracking-tight text-zinc-300 sm:text-xl"
          {...fadeUp}
        >
          How to get videos to BofBot?
        </motion.h2>
        <motion.p
          className="mx-auto mt-2 text-center text-xs font-medium tracking-wide text-zinc-600"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.04 }}
        >
          Only takes a few seconds
        </motion.p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
          <motion.div
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 sm:px-6 sm:py-6"
            {...itemFade}
            transition={{ ...itemFade.transition, delay: 0.06 }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="inline-flex rounded-lg bg-zinc-800/60 p-2 text-zinc-400">
                <AppleGlyph className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                iCloud Photos
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500">
              Automatic two-way sync. Videos go from phone to PC and back — no
              cables, no manual transfers. Finished edits appear right in your
              Camera Roll.
            </p>
          </motion.div>
          <motion.div
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 sm:px-6 sm:py-6"
            {...itemFade}
            transition={{ ...itemFade.transition, delay: 0.1 }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="inline-flex rounded-lg bg-zinc-800/60 p-2">
                <GoogleDriveGlyph className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Google Drive (Recommended)
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500">
              Free and works on any phone. Sync videos to PC, edit in BofBot,
              sync back. One extra tap to save to Camera Roll.
            </p>
          </motion.div>
        </div>
        <motion.p
          className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-zinc-600"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.12 }}
        >
          You can also skip syncing back entirely — post directly from your
          browser at{" "}
          <a
            href="https://www.tiktok.com/upload"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F43F5E]/90 underline-offset-2 transition hover:text-[#fb7185] hover:underline"
          >
            tiktok.com/upload
          </a>
          .
        </motion.p>
        <motion.div
          className="mt-5 flex justify-center"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.14 }}
        >
          <Link
            href="/setup-guide"
            className="text-sm font-medium text-[#F43F5E] underline-offset-2 transition hover:text-[#fb7185] hover:underline"
          >
            View full setup guide →
          </Link>
        </motion.div>
        <motion.p
          className="mx-auto mt-4 max-w-xl text-center text-[11px] leading-relaxed text-zinc-600 sm:text-xs"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.16 }}
        >
          We recommend Windows for best performance.
        </motion.p>
      </div>
    </section>
  );
}

const features = [
  {
    title: "Batch processing — 50 videos in minutes",
    desc: "Stop editing one clip at a time. Ship whole drops in one pass.",
  },
  {
    title: "Banner & fulltext overlays",
    desc: "Urgency bars or bold full-frame hooks — automated to your presets.",
  },
  {
    title: "Custom hook rotation",
    desc: "Multiple hook variants rotate across your batch for natural variety.",
  },
  {
    title: "Runs on your PC — your videos never leave your machine.",
    desc: "Local desktop processing — encoding and overlays run on your hardware, not in the cloud.",
  },
  {
    title: "TikTok Shop optimized",
    desc: "9:16 output tuned for product listings and shop creatives.",
  },
];

function FeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-24 bg-[#080808] px-5 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="font-display text-center text-3xl font-bold text-white sm:text-4xl"
          {...fadeUp}
        >
          Everything you need to scale
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-xl text-center text-zinc-400"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          Serious tooling for creators who ship volume.
        </motion.p>
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f] p-6 transition hover:border-white/15 hover:bg-[#121212]"
            >
              <div className="mb-4 h-1 w-10 rounded-full bg-[#F43F5E]" />
              <h3 className="font-display text-lg font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderSection() {
  return (
    <section
      aria-label="Founder perspective"
      className="scroll-mt-24 bg-[#0a0a0a] px-5 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-3xl">
        <motion.p
          className="mb-8 text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500"
          {...fadeUp}
        >
          From the founder
        </motion.p>
        <motion.div
          className="rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-white/[0.02] px-6 py-5 text-center sm:px-10 sm:py-6"
          {...fadeUp}
        >
          <p className="font-display text-xl font-semibold text-white sm:text-2xl">
            Cuts editing time by{" "}
            <span
              className="text-[#F43F5E]"
              style={{
                textShadow:
                  "0 0 32px rgba(244, 63, 94, 0.35), 0 0 72px rgba(244, 63, 94, 0.12)",
              }}
            >
              90%
            </span>
          </p>
        </motion.div>
        <motion.figure
          className="mt-10 text-center"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.08 }}
        >
          <blockquote className="font-display text-xl font-medium leading-relaxed text-zinc-200 sm:text-2xl sm:leading-relaxed">
            <span className="text-zinc-600">&ldquo;</span>
            I was spending 2 hours a day editing 40+ bottom-of-funnel videos. I
            built BofBot to get that down to 10 minutes.
            <span className="text-zinc-600">&rdquo;</span>
          </blockquote>
          <figcaption className="mt-6 text-sm text-zinc-500">
            <span className="text-zinc-400">— Trev</span>
            <span className="text-zinc-600">, Founder of BofBot</span>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

type PricingTier = "free" | "starter" | "pro";

const PRICING_INCLUDES =
  "Banner & fulltext overlays on every plan. Paid plans remove the watermark — Starter includes up to 5 custom hooks; Pro includes unlimited custom hooks.";

function PricingSection() {
  const proDisplay = planDefinition("pro");

  const tiers: {
    id: PricingTier;
    name: string;
    priceMain: string;
    priceSuffix: string | null;
    priceCompareAt?: string;
    pricePromoBadge?: string;
    popular: boolean;
    cta: string;
    bullets: ReactNode[];
    excludedBullets?: string[];
  }[] = [
    {
      id: "free",
      name: "Free",
      priceMain: "$0",
      priceSuffix: null,
      popular: false,
      cta: "Get started free",
      bullets: ["3 videos per day", "Watermark on export"],
      excludedBullets: [
        "No watermark",
        "Custom hooks",
        "Priority processing",
      ],
    },
    {
      id: "starter",
      name: "Starter",
      priceMain: "$19",
      priceSuffix: "/mo",
      popular: false,
      cta: "Start editing smarter",
      bullets: [
        "25 videos per day",
        "No watermark",
        "Batch Upload",
        "Hook Rotation",
        "Up to 5 custom hooks",
      ],
      excludedBullets: [
        "Unlimited videos",
        "Unlimited custom hooks",
        "Priority processing",
        "Early access to features",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      priceMain: "$39.99",
      priceSuffix: "/mo",
      priceCompareAt: proDisplay.priceCompareAt,
      pricePromoBadge: proDisplay.pricePromoBadge,
      popular: true,
      cta: "Go unlimited",
      bullets: [
        <>
          <span
            className="font-display text-lg font-bold tracking-tight text-[#F43F5E] sm:text-xl"
            style={{
              textShadow:
                "0 0 20px rgba(244, 63, 94, 0.45), 0 0 48px rgba(244, 63, 94, 0.2)",
            }}
          >
            UNLIMITED
          </span>{" "}
          <span className="text-zinc-400">videos per day</span>
        </>,
        "Batch Upload",
        "Hook Rotation",
        "Unlimited custom hooks",
        "Priority processing",
        "Early access to new features",
      ],
    },
  ];

  return (
    <section
      id="pricing"
      className="scroll-mt-24 bg-[#0a0a0a] px-5 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-5xl">
        <motion.h2
          className="font-display text-center text-3xl font-bold text-white sm:text-4xl"
          {...fadeUp}
        >
          <span className="text-[#F43F5E]">Simple</span> pricing
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-xl text-center text-zinc-400"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          Start free. Upgrade when your catalog grows.
        </motion.p>
        <motion.p
          className="mx-auto mt-3 max-w-lg text-center text-xs leading-relaxed text-zinc-500"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.08 }}
        >
          {PRICING_INCLUDES}
        </motion.p>
        <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {tiers.map((plan, i) => {
            const popular = plan.popular;
            const free = plan.id === "free";
            return (
              <motion.div
                key={plan.id}
                {...itemFade}
                transition={{ ...itemFade.transition, delay: i * 0.08 }}
                className={`relative flex flex-col rounded-2xl border ${
                  free
                    ? "border-zinc-800/60 bg-[#0c0c0c] p-6 text-zinc-500 opacity-[0.88] lg:opacity-90"
                    : popular
                      ? "border-[#F43F5E]/45 bg-zinc-900/80 p-7 shadow-[0_0_56px_-14px_rgba(244,63,94,0.25),0_0_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-[#F43F5E]/25 lg:z-10 lg:scale-[1.045]"
                      : "border-white/[0.1] bg-[#111] p-6"
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F43F5E] px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
                    Most popular
                  </span>
                )}
                <h3
                  className={`font-display text-lg font-semibold ${
                    free ? "text-zinc-400" : "text-white"
                  }`}
                >
                  {plan.name}
                </h3>
                {plan.id === "pro" &&
                plan.pricePromoBadge &&
                plan.priceCompareAt ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#F43F5E]">
                      {plan.pricePromoBadge}
                    </p>
                    <p className="font-display text-sm font-medium text-zinc-500 line-through">
                      {plan.priceCompareAt}
                    </p>
                    <p
                      className="font-display text-4xl font-bold leading-none text-[#F43F5E] sm:text-[2.75rem]"
                      style={{
                        textShadow:
                          "0 0 28px rgba(244, 63, 94, 0.32), 0 0 64px rgba(244, 63, 94, 0.12)",
                      }}
                    >
                      {plan.priceMain}
                      {plan.priceSuffix && (
                        <span className="text-xl font-bold text-[#F43F5E]/85 sm:text-2xl">
                          {plan.priceSuffix}
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`mt-2 font-display text-3xl font-bold ${
                      popular
                        ? "text-[#F43F5E]"
                        : free
                          ? "text-zinc-300"
                          : "text-white"
                    }`}
                    style={
                      popular
                        ? {
                            textShadow:
                              "0 0 28px rgba(244, 63, 94, 0.32), 0 0 64px rgba(244, 63, 94, 0.12)",
                          }
                        : undefined
                    }
                  >
                    {plan.priceMain}
                    {plan.priceSuffix && (
                      <span
                        className={`text-base font-normal ${
                          popular ? "text-[#F43F5E]/70" : "text-zinc-500"
                        }`}
                      >
                        {plan.priceSuffix}
                      </span>
                    )}
                  </p>
                )}
                <ul
                  className={`mt-6 flex flex-1 flex-col gap-3 text-sm ${
                    free ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  {plan.bullets.map((line, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span
                        className={
                          free ? "text-zinc-600" : "text-zinc-500"
                        }
                      >
                        ✓
                      </span>
                      <span className="leading-snug">{line}</span>
                    </li>
                  ))}
                  {plan.excludedBullets?.map((line, j) => (
                    <li
                      key={`ex-${j}`}
                      className="flex gap-2.5 text-zinc-500/90"
                    >
                      <span
                        className="shrink-0 text-[#f43f5e]/40"
                        aria-hidden
                      >
                        ✗
                      </span>
                      <span className="leading-snug text-zinc-500">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {free ? (
                    <PricingFreeCta
                      className={
                        "block w-full rounded-full border border-zinc-700/80 bg-zinc-900/40 py-3 text-center text-sm font-semibold text-zinc-300 transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out hover:scale-[1.03] hover:border-zinc-600 hover:bg-zinc-900/70 hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                      }
                    >
                      {plan.cta}
                    </PricingFreeCta>
                  ) : (
                    <PricingCheckoutButton
                      plan={plan.id === "starter" ? "starter" : "pro"}
                      showCancelNote
                      className={
                        popular
                          ? "block w-full rounded-full bg-gradient-to-r from-[#F43F5E] to-[#fb7185] py-3.5 text-center text-sm font-semibold text-white shadow-[0_0_32px_-8px_rgba(244,63,94,0.45)] ring-1 ring-white/15 transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(244,63,94,0.5)] disabled:opacity-60"
                          : "block w-full rounded-full border border-white/15 bg-white/[0.06] py-3 text-center text-sm font-semibold text-white transition-[transform,box-shadow,background-color] duration-200 ease-out hover:scale-[1.03] hover:bg-white/[0.1] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] disabled:opacity-60"
                      }
                    >
                      {plan.cta}
                    </PricingCheckoutButton>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        <motion.p
          className="mx-auto mt-12 max-w-xl text-center text-xs leading-relaxed text-zinc-500"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.12 }}
        >
          All plans include local processing — your videos never leave your
          machine.
        </motion.p>
      </div>
    </section>
  );
}

type FaqItem = { q: string; a: string | ReactNode };

const faqs: FaqItem[] = [
  {
    q: "Does it work on Mac?",
    a: "Yes. BofBot runs locally on macOS and Windows — your videos are processed on your machine.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan includes 3 videos per day so you can try the full pipeline before upgrading.",
  },
  {
    q: "Do I need an internet connection?",
    a: "Yes. The app needs internet to sign in and verify your subscription while you use it. Encoding still runs entirely on your computer — your source files are not uploaded for processing.",
  },
  { ...WINDOWS_SMARTSCREEN_FAQ },
  {
    q: "Mac says BofBot is damaged?",
    a: (
      <>
        This is normal for new apps. Follow our{" "}
        <Link
          href="/mac-help"
          className="font-medium text-[#fb7185] underline underline-offset-2 hover:text-[#fda4af]"
        >
          one-minute Mac installation guide
        </Link>{" "}
        to fix it.
      </>
    ),
  },
  {
    q: "Will TikTok ban me?",
    a: "BofBot only adds overlays to videos you own. It doesn’t automate posting or violate platform rules — always follow TikTok Shop and community guidelines.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="scroll-mt-24 bg-[#080808] px-5 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-2xl">
        <motion.h2
          className="font-display text-center text-3xl font-bold text-white sm:text-4xl"
          {...fadeUp}
        >
          FAQ
        </motion.h2>
        <motion.p
          className="mt-4 text-center text-zinc-400"
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
        >
          Quick answers before you download.
        </motion.p>
        <div className="mt-12 space-y-3">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f0f0f]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white transition hover:bg-white/[0.03]"
                >
                  {item.q}
                  <span
                    className={`text-zinc-500 transition ${isOpen ? "rotate-180" : ""}`}
                  >
                    ▼
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: easeOutExpo }}
                    >
                      <div className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-sm leading-relaxed text-zinc-400 [&_a]:text-[#fb7185] [&_a]:underline [&_a]:underline-offset-2">
                        {typeof item.a === "string" ? <p className="m-0">{item.a}</p> : item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { data: session, status } = useSession();

  return (
    <footer className="bg-[#0a0a0a] px-5 py-14 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <BrandLogoMark className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-lg shadow-[#F43F5E]/30" />
          <span className="font-display text-lg font-semibold text-white">
            BofBot
          </span>
        </div>
        <nav className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
          <a href="#pricing" className="hover:text-white">
            Pricing
          </a>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-white">
            Contact
          </Link>
          <Link href="/mac-help" className="hover:text-white">
            Mac Help
          </Link>
          {status === "authenticated" && session?.user ? (
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-white">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-white">
                Sign up
              </Link>
            </>
          )}
          <BofBotInstallerDownloadFooter />
        </nav>
        <p className="text-sm text-zinc-600">
          © {new Date().getFullYear()} BofBot. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-100 antialiased">
      <NoiseOverlay />
      <Nav />
      <main>
        <HeroSection />
        <SectionDivider />
        <HowItWorksSection />
        <SectionDivider />
        <GetVideosToPcSection />
        <SectionDivider />
        <FeaturesSection />
        <SectionDivider />
        <FounderSection />
        <SectionDivider />
        <PricingSection />
        <SectionDivider />
        <FAQSection />
      </main>
      <SectionDivider />
      <Footer />
    </div>
  );
}
