import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogoMark } from "@/components/brand-mark";

import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact — BofBot",
  description: "Get in touch with the BofBot team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-100 antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "120px 120px",
        }}
      />
      <header className="relative z-10 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
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

      <main className="relative z-10 mx-auto max-w-lg px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Contact
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Questions, feedback, or partnership ideas — send a note and we&apos;ll
          reply as soon as we can.
        </p>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <ContactForm />
        </div>
      </main>
    </div>
  );
}
