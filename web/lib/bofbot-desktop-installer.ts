/** Windows NSIS installer from GitHub Releases (stable filename on each release). */
export const BOFBOT_WINDOWS_INSTALLER_URL =
  "https://github.com/trevortaylor29/bofbot/releases/latest/download/BofBot-Setup.exe";

/** Zip of the Windows .exe — fallback when SmartScreen/browser blocks the installer download. */
export const BOFBOT_WINDOWS_INSTALLER_ZIP_URL =
  "https://github.com/trevortaylor29/bofbot/releases/latest/download/BofBot-Setup-Windows.zip";

/** macOS DMG from GitHub Releases (stable filename on each release). */
export const BOFBOT_MAC_INSTALLER_URL =
  "https://github.com/trevortaylor29/bofbot/releases/latest/download/BofBot-Setup.dmg";

/** macOS ZIP from GitHub Releases (stable filename; fallback if DMG download fails). */
export const BOFBOT_MAC_INSTALLER_ZIP_URL =
  "https://github.com/trevortaylor29/bofbot/releases/latest/download/BofBot-Setup.zip";

export type InstallerOs = "windows" | "mac" | "unknown";

/**
 * Detect desktop OS for download CTAs. Call only in the browser (e.g. inside useEffect).
 * Uses navigator.platform / userAgent; iPadOS reporting as MacIntel → unknown (show both).
 */
export function detectInstallerOs(): InstallerOs {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touch = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  if (touch > 1 && platform === "MacIntel") {
    return "unknown";
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) return "mac";
  return "unknown";
}
