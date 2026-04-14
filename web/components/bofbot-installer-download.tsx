"use client";

import { useEffect, useState } from "react";

import {
  BOFBOT_MAC_INSTALLER_URL,
  BOFBOT_WINDOWS_INSTALLER_URL,
  detectInstallerOs,
  type InstallerOs,
} from "@/lib/bofbot-desktop-installer";
import { WINDOWS_SMARTSCREEN_FAQ } from "@/lib/windows-install-security-note";

function useInstallerOs(): InstallerOs {
  const [os, setOs] = useState<InstallerOs>("unknown");
  useEffect(() => {
    setOs(detectInstallerOs());
  }, []);
  return os;
}

const navPrimaryClass =
  "shrink-0 rounded-full bg-[#F43F5E] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#F43F5E]/30 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]";

const navSecondaryClass =
  "shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 transition hover:border-white/25 hover:bg-white/[0.1]";

const heroPrimaryClass =
  "inline-flex items-center justify-center rounded-full bg-[#F43F5E] px-10 py-4 text-base font-semibold text-white shadow-[0_0_48px_-6px_rgba(244,63,94,0.35)] ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]";

const heroSecondaryClass =
  "inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-8 py-3.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 transition hover:border-white/25 hover:bg-white/[0.1]";

export function BofBotInstallerDownloadNav() {
  const os = useInstallerOs();
  if (os === "windows") {
    return (
      <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={navPrimaryClass}>
        Download for Windows
      </a>
    );
  }
  if (os === "mac") {
    return (
      <a href={BOFBOT_MAC_INSTALLER_URL} className={navPrimaryClass}>
        Download for Mac
      </a>
    );
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={navPrimaryClass}>
        Windows
      </a>
      <a href={BOFBOT_MAC_INSTALLER_URL} className={navSecondaryClass}>
        Mac
      </a>
    </div>
  );
}

export function BofBotInstallerDownloadHero() {
  const os = useInstallerOs();
  if (os === "windows") {
    return (
      <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={heroPrimaryClass}>
        Download for Windows
      </a>
    );
  }
  if (os === "mac") {
    return (
      <a href={BOFBOT_MAC_INSTALLER_URL} className={heroPrimaryClass}>
        Download for Mac
      </a>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
      <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={heroPrimaryClass}>
        Download for Windows
      </a>
      <a href={BOFBOT_MAC_INSTALLER_URL} className={heroSecondaryClass}>
        Download for Mac
      </a>
    </div>
  );
}

export function BofBotInstallerDownloadFooter() {
  const os = useInstallerOs();
  if (os === "windows") {
    return (
      <a href={BOFBOT_WINDOWS_INSTALLER_URL} className="hover:text-white">
        Download for Windows
      </a>
    );
  }
  if (os === "mac") {
    return (
      <a href={BOFBOT_MAC_INSTALLER_URL} className="hover:text-white">
        Download for Mac
      </a>
    );
  }
  return (
    <>
      <a href={BOFBOT_WINDOWS_INSTALLER_URL} className="hover:text-white">
        Download for Windows
      </a>
      <a href={BOFBOT_MAC_INSTALLER_URL} className="hover:text-white">
        Download for Mac
      </a>
    </>
  );
}

export function BofBotInstallerDownloadDashboard() {
  const os = useInstallerOs();
  const primaryClass =
    "inline-flex w-full items-center justify-center rounded-xl bg-[#F43F5E] px-6 py-4 text-base font-semibold text-white shadow-[0_0_40px_-8px_rgba(244,63,94,0.45)] ring-1 ring-white/10 transition hover:opacity-95 sm:w-auto";

  const secondaryClass =
    "inline-flex w-full items-center justify-center rounded-xl border border-zinc-600 bg-zinc-900 px-6 py-4 text-base font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 sm:w-auto";

  return (
    <div>
      {os === "unknown" ? (
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={primaryClass}>
            Download for Windows
          </a>
          <a href={BOFBOT_MAC_INSTALLER_URL} className={secondaryClass}>
            Download for Mac
          </a>
        </div>
      ) : os === "windows" ? (
        <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={primaryClass}>
          Download for Windows
        </a>
      ) : (
        <a href={BOFBOT_MAC_INSTALLER_URL} className={primaryClass}>
          Download for Mac
        </a>
      )}
      <p className="mt-3 text-center text-sm text-zinc-400">
        {os === "mac"
          ? "Open the DMG, drag BofBot to Applications, then sign in with this account."
          : os === "windows"
            ? "Run the Windows installer, then sign in with this account."
            : "Choose the installer for your computer, run it, then sign in with this account."}
      </p>
      {os !== "mac" && (
        <p className="mt-2 flex items-start justify-center gap-1.5 text-left text-xs leading-relaxed text-zinc-500">
          <span
            className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800/80 text-[10px] font-semibold text-zinc-400"
            aria-hidden
          >
            i
          </span>
          <span>{WINDOWS_SMARTSCREEN_FAQ.a}</span>
        </p>
      )}
    </div>
  );
}
