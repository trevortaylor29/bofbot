import Link from "next/link";

import { signOut } from "@/auth";
import { BrandLogoMark } from "@/components/brand-mark";

export function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-100 antialiased">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 py-2.5 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandLogoMark className="shrink-0" />
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              BofBot
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-5 text-sm text-zinc-400 sm:gap-8">
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
            <Link href="/#pricing" className="transition hover:text-white">
              Pricing
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:border-[#F43F5E]/45 hover:text-[#F43F5E]"
            >
              Contact
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:border-[#F43F5E]/45 hover:text-[#F43F5E]"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="pt-24">{children}</div>
    </div>
  );
}
