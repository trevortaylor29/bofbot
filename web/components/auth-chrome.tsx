import Link from "next/link";

import { BrandLogoMark } from "@/components/brand-mark";

const NOISE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

/**
 * Shared chrome for login/signup: landing-style background, noise, header.
 */
export function AuthChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.028]"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "120px 120px",
        }}
      />
      <header className="relative z-10 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogoMark />
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              BofBot
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
