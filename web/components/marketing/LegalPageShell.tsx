import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogoMark } from "@/components/brand-mark";

type Props = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalPageShell({ title, lastUpdated, children }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-300">
      <header className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white hover:opacity-90"
          >
            <BrandLogoMark className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-lg shadow-[#F43F5E]/30" />
            <span className="font-display text-lg font-semibold">BofBot</span>
          </Link>
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: {lastUpdated}</p>
        <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-400 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:first:mt-0 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-medium [&_strong]:text-zinc-200 [&_a]:text-[#F43F5E] [&_a]:underline-offset-2 hover:[&_a]:underline">
          {children}
        </div>
      </main>
    </div>
  );
}
