import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogoMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Setup guide — BofBot",
  description:
    "Step-by-step: get phone videos to your PC with iCloud Photos or Google Drive, edit in BofBot, and post to TikTok.",
};

export default function SetupGuidePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-jakarta text-zinc-300 antialiased">
      <header className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
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
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Setup guide
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Two ways to move footage between your phone and BofBot on your
          computer — pick the one that fits your devices.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            iCloud Photos (Mac / PC)
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-400 marker:text-zinc-600">
            <li>
              Install{" "}
              <strong className="font-medium text-zinc-200">
                iCloud for Windows
              </strong>{" "}
              from the Microsoft Store (skip if you&apos;re on Mac).
            </li>
            <li>
              Sign in with your Apple ID and enable{" "}
              <strong className="font-medium text-zinc-200">iCloud Photos</strong>
              .
            </li>
            <li>
              An <strong className="font-medium text-zinc-200">iCloud Photos</strong>{" "}
              folder appears on your PC.
            </li>
            <li>
              In BofBot <strong className="font-medium text-zinc-200">Settings</strong>
              , set your output folder to the iCloud Photos folder.
            </li>
            <li>
              Film on your phone — videos sync to your PC via iCloud.
            </li>
            <li>Drag synced videos into BofBot and process.</li>
            <li>Finished videos save to the iCloud Photos folder.</li>
            <li>
              They automatically appear in your iPhone Camera Roll.
            </li>
            <li>Open TikTok and post from Camera Roll.</li>
          </ol>
        </section>

        <section className="mt-14 border-t border-white/[0.06] pt-14">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            Google Drive
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-400 marker:text-zinc-600">
            <li>
              Install the{" "}
              <strong className="font-medium text-zinc-200">Google Drive</strong>{" "}
              app on your phone and PC (or use the browser on PC).
            </li>
            <li>
              Film on your phone — videos sync to your PC via Drive.
            </li>
            <li>Drag synced videos into BofBot and process.</li>
            <li>
              Drag and drop your output folder into Google Drive.
              <p className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-zinc-300">
                <strong className="text-[#F43F5E]">Pro tip:</strong> In BofBot
                Settings, set your output folder to a folder inside Google Drive.
              </p>
            </li>
            <li>
              Finished videos save to the Google Drive folder and sync to your
              phone.
            </li>
            <li>
              On your phone, open Google Drive, long-press to select all finished
              videos, then save to Camera Roll.
            </li>
            <li>Open TikTok and post from Camera Roll!</li>
          </ol>
        </section>

        <p className="mt-12 text-center text-sm text-zinc-600">
          <Link
            href="/"
            className="font-medium text-[#F43F5E] underline-offset-2 hover:text-[#fb7185] hover:underline"
          >
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
