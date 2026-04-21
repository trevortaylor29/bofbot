"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { MacInstallHelpLink } from "@/components/mac-install-help-link";
import {
  BOFBOT_MAC_INSTALLER_URL,
  BOFBOT_MAC_INSTALLER_ZIP_URL,
  BOFBOT_WINDOWS_INSTALLER_URL,
  BOFBOT_WINDOWS_INSTALLER_ZIP_URL,
  detectInstallerOs,
  type InstallerOs,
} from "@/lib/bofbot-desktop-installer";
import { WINDOWS_SMARTSCREEN_FAQ } from "@/lib/windows-install-security-note";

const SIGNUP_CALLBACK = encodeURIComponent("/");
const SUBSCRIBE_DOWNLOAD_PATH = "/?subscribe_download=1#pricing";

type DownloadGatePhase = "loading" | "guest" | "subscribe" | "paid";

type InstallerDownloadGateValue = {
  phase: DownloadGatePhase;
  onGatedAnchorClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const InstallerDownloadGateContext =
  createContext<InstallerDownloadGateValue | null>(null);

/** Wrap landing nav / hero / footer so installer gating shares one `/api/user/plan` fetch. */
export function BofBotInstallerDownloadGateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useInstallerDownloadGateValue();
  return (
    <InstallerDownloadGateContext.Provider value={value}>
      {children}
    </InstallerDownloadGateContext.Provider>
  );
}

function useInstallerOs(): InstallerOs {
  const [os, setOs] = useState<InstallerOs>("unknown");
  useEffect(() => {
    setOs(detectInstallerOs());
  }, []);
  return os;
}

function useInstallerDownloadGateValue(): InstallerDownloadGateValue {
  const { status } = useSession();
  const router = useRouter();
  const [paid, setPaid] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      setPaid(null);
      return;
    }
    if (status === "loading") return;

    let cancelled = false;
    setPaid(null);
    fetch("/api/user/plan", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("plan"))))
      .then((d: { plan?: string }) => {
        if (cancelled) return;
        const p = d.plan;
        setPaid(p === "starter" || p === "pro");
      })
      .catch(() => {
        if (!cancelled) setPaid(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const phase: DownloadGatePhase =
    status === "loading" || (status === "authenticated" && paid === null)
      ? "loading"
      : status === "unauthenticated"
        ? "guest"
        : paid === true
          ? "paid"
          : "subscribe";

  const onGatedAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (phase === "loading") return;
      if (phase === "guest") {
        router.push(`/signup?callbackUrl=${SIGNUP_CALLBACK}`);
        return;
      }
      if (phase === "subscribe") {
        router.push(SUBSCRIBE_DOWNLOAD_PATH);
      }
    },
    [phase, router],
  );

  return useMemo(
    () => ({ phase, onGatedAnchorClick }),
    [phase, onGatedAnchorClick],
  );
}

function useInstallerDownloadGate(): InstallerDownloadGateValue {
  const ctx = useContext(InstallerDownloadGateContext);
  if (!ctx) {
    throw new Error(
      "Installer download links require BofBotInstallerDownloadGateProvider",
    );
  }
  return ctx;
}

function GatedInstallerLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const { phase, onGatedAnchorClick } = useInstallerDownloadGate();
  const direct = phase === "paid";
  return (
    <a
      href={direct ? href : "#"}
      className={`${className}${phase === "loading" ? " cursor-wait opacity-90" : ""}`}
      onClick={direct ? undefined : onGatedAnchorClick}
    >
      {children}
    </a>
  );
}

const heroPrimaryClass =
  "inline-flex items-center justify-center rounded-full bg-[#F43F5E] px-10 py-4 text-base font-semibold text-white shadow-[0_0_48px_-6px_rgba(244,63,94,0.35)] ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]";

/** Small text link to the other installer (below the primary download). */
const otherInstallerLinkClass =
  "text-xs font-medium text-zinc-400 underline-offset-2 transition hover:text-zinc-200 hover:underline";

const zipFallbackLinkClass =
  "text-[10px] leading-snug text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline";

function InstallerZipFallback({ href }: { href: string }) {
  return (
    <GatedInstallerLink href={href} className={zipFallbackLinkClass}>
      Download not working? Try the zip version
    </GatedInstallerLink>
  );
}

export function BofBotInstallerDownloadHero() {
  const os = useInstallerOs();
  if (os === "windows") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <GatedInstallerLink href={BOFBOT_WINDOWS_INSTALLER_URL} className={heroPrimaryClass}>
          Download for Windows
        </GatedInstallerLink>
        <InstallerZipFallback href={BOFBOT_WINDOWS_INSTALLER_ZIP_URL} />
        <GatedInstallerLink href={BOFBOT_MAC_INSTALLER_URL} className={otherInstallerLinkClass}>
          Mac version →
        </GatedInstallerLink>
      </div>
    );
  }
  if (os === "mac") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <GatedInstallerLink href={BOFBOT_MAC_INSTALLER_URL} className={heroPrimaryClass}>
          Download for Mac
        </GatedInstallerLink>
        <InstallerZipFallback href={BOFBOT_MAC_INSTALLER_ZIP_URL} />
        <GatedInstallerLink
          href={BOFBOT_WINDOWS_INSTALLER_URL}
          className={otherInstallerLinkClass}
        >
          Windows version →
        </GatedInstallerLink>
        <MacInstallHelpLink />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex flex-col items-center gap-1.5">
          <GatedInstallerLink href={BOFBOT_WINDOWS_INSTALLER_URL} className={heroPrimaryClass}>
            Download for Windows
          </GatedInstallerLink>
          <InstallerZipFallback href={BOFBOT_WINDOWS_INSTALLER_ZIP_URL} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <GatedInstallerLink href={BOFBOT_MAC_INSTALLER_URL} className={heroPrimaryClass}>
            Download for Mac
          </GatedInstallerLink>
          <InstallerZipFallback href={BOFBOT_MAC_INSTALLER_ZIP_URL} />
        </div>
      </div>
      <MacInstallHelpLink />
    </div>
  );
}

const footerPrimaryClass = "font-semibold text-zinc-300 hover:text-white";
const footerOtherClass =
  "text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline";

export function BofBotInstallerDownloadFooter() {
  const os = useInstallerOs();
  if (os === "windows") {
    return (
      <span className="inline-flex flex-col items-center gap-1 sm:items-end">
        <GatedInstallerLink href={BOFBOT_WINDOWS_INSTALLER_URL} className={footerPrimaryClass}>
          Download for Windows
        </GatedInstallerLink>
        <InstallerZipFallback href={BOFBOT_WINDOWS_INSTALLER_ZIP_URL} />
        <GatedInstallerLink href={BOFBOT_MAC_INSTALLER_URL} className={footerOtherClass}>
          Mac version →
        </GatedInstallerLink>
      </span>
    );
  }
  if (os === "mac") {
    return (
      <span className="inline-flex flex-col items-center gap-1 sm:items-end">
        <GatedInstallerLink href={BOFBOT_MAC_INSTALLER_URL} className={footerPrimaryClass}>
          Download for Mac
        </GatedInstallerLink>
        <InstallerZipFallback href={BOFBOT_MAC_INSTALLER_ZIP_URL} />
        <GatedInstallerLink href={BOFBOT_WINDOWS_INSTALLER_URL} className={footerOtherClass}>
          Windows version →
        </GatedInstallerLink>
        <MacInstallHelpLink align="center" className="text-zinc-500 hover:text-zinc-300" />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center gap-2 sm:items-end">
      <span className="flex flex-col items-center gap-3 sm:flex-row sm:gap-8">
        <span className="inline-flex flex-col items-center gap-1">
          <GatedInstallerLink href={BOFBOT_WINDOWS_INSTALLER_URL} className={footerPrimaryClass}>
            Download for Windows
          </GatedInstallerLink>
          <InstallerZipFallback href={BOFBOT_WINDOWS_INSTALLER_ZIP_URL} />
        </span>
        <span className="inline-flex flex-col items-center gap-1">
          <GatedInstallerLink href={BOFBOT_MAC_INSTALLER_URL} className={footerPrimaryClass}>
            Download for Mac
          </GatedInstallerLink>
          <InstallerZipFallback href={BOFBOT_MAC_INSTALLER_ZIP_URL} />
        </span>
      </span>
      <MacInstallHelpLink align="center" className="text-zinc-500 hover:text-zinc-300" />
    </span>
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
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row sm:justify-center sm:items-start">
          <div className="flex w-full max-w-xs flex-col items-center gap-1.5 sm:w-auto">
            <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={primaryClass}>
              Download for Windows
            </a>
            <a href={BOFBOT_WINDOWS_INSTALLER_ZIP_URL} className={zipFallbackLinkClass}>
              Download not working? Try the zip version
            </a>
          </div>
          <div className="flex w-full max-w-xs flex-col items-center gap-1.5 sm:w-auto">
            <a href={BOFBOT_MAC_INSTALLER_URL} className={secondaryClass}>
              Download for Mac
            </a>
            <a href={BOFBOT_MAC_INSTALLER_ZIP_URL} className={zipFallbackLinkClass}>
              Download not working? Try the zip version
            </a>
            <MacInstallHelpLink />
          </div>
        </div>
      ) : os === "windows" ? (
        <div className="flex flex-col items-center gap-1.5">
          <a href={BOFBOT_WINDOWS_INSTALLER_URL} className={primaryClass}>
            Download for Windows
          </a>
          <a href={BOFBOT_WINDOWS_INSTALLER_ZIP_URL} className={zipFallbackLinkClass}>
            Download not working? Try the zip version
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <a href={BOFBOT_MAC_INSTALLER_URL} className={primaryClass}>
            Download for Mac
          </a>
          <a href={BOFBOT_MAC_INSTALLER_ZIP_URL} className={zipFallbackLinkClass}>
            Download not working? Try the zip version
          </a>
          <MacInstallHelpLink />
        </div>
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
