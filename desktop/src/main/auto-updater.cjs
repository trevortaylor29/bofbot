/**
 * GitHub Releases auto-update (electron-updater).
 * Renderer modal → download → quitAndInstall(true, true): NSIS /S + --force-run (no installer window, relaunch app).
 * Silent updates require a oneClick NSIS build (see package.json build.nsis).
 */
const { app, shell } = require("electron");
const { autoUpdater } = require("electron-updater");

const GITHUB_OWNER = "trevortaylor29";
const GITHUB_REPO = "bofbot";
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * macOS auto-update via Squirrel.Mac requires Apple Developer code-signing, which our
 * unsigned CI builds intentionally skip (CSC_IDENTITY_AUTO_DISCOVERY=false in build-mac.yml).
 * On Mac we still detect new versions, but instead of downloading we open the GitHub
 * releases page so the user can grab the new DMG manually.
 */
const IS_MAC_MANUAL = process.platform === "darwin";

/** Shown in UI / IPC — never expose raw updater errors or GitHub URLs to users. */
const USER_FACING_UPDATE_FAILURE =
  "Update check failed. Download the latest version from bofbot.com";

/** Missing latest-mac.yml / 404 on GitHub Releases — skip noise until Mac metadata is published. */
function isIgnorableMacUpdaterError(e) {
  if (process.platform !== "darwin") return false;
  const msg = String(e?.message ?? e ?? "");
  const code = e?.statusCode ?? e?.status;
  if (code === 404) return true;
  if (/404|not found|no published versions/i.test(msg)) return true;
  if (/latest-mac\.yml/i.test(msg)) return true;
  return false;
}

function stripHtml(raw) {
  let s = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

/** Plain text for in-app UI (never pass raw GitHub HTML to a native dialog). */
function formatReleaseNotesPlain(info) {
  const raw = info.releaseNotes;
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) {
    const parts = [];
    for (const item of raw) {
      if (!item?.note) continue;
      const note = stripHtml(String(item.note));
      if (note) parts.push(`${item.version}: ${note}`);
    }
    const joined = parts.join("\n\n");
    return joined.length ? joined : null;
  }
  const s = stripHtml(String(raw));
  return s.length ? s : null;
}

/**
 * @param {object} opts
 * @param {import("electron").IpcMain} opts.ipcMain
 * @param {() => import("electron").BrowserWindow | null} opts.getMainWindow
 */
function registerAutoUpdate({ ipcMain, getMainWindow }) {
  let userRequestedInstall = false;

  ipcMain.handle("update:download", async () => {
    if (!app.isPackaged) {
      return { ok: false, error: "Updates only apply to the installed app." };
    }
    if (IS_MAC_MANUAL) {
      // No Apple signing → Squirrel.Mac can't verify the new build. Open the releases
      // page so the user can grab the new DMG; the renderer treats this as a "success"
      // and dismisses the modal.
      try {
        await shell.openExternal(RELEASES_PAGE_URL);
      } catch (e) {
        console.error("[desktop] open releases page failed:", e);
      }
      return { ok: true, manualOnly: true };
    }
    userRequestedInstall = true;
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e) {
      userRequestedInstall = false;
      if (isIgnorableMacUpdaterError(e)) {
        return { ok: false, skipped: true };
      }
      console.error("[desktop] update:download", e);
      const win = getMainWindow();
      if (win?.webContents && !win.isDestroyed()) {
        win.webContents.send("update-error", { message: USER_FACING_UPDATE_FAILURE });
      }
      return { ok: false, error: USER_FACING_UPDATE_FAILURE };
    }
  });

  ipcMain.handle("update:check", async () => {
    if (!app.isPackaged) {
      return { ok: true, devMode: true, updateAvailable: false };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result == null) {
        return { ok: true, updateAvailable: false };
      }
      const remoteVersion = result.updateInfo?.version;
      const current = app.getVersion();
      // On Mac, electron-updater's `isUpdateAvailable` can stall on unsigned builds. Trust
      // a strict version difference instead so the user always gets a clear answer + modal.
      const updateAvailable =
        result.isUpdateAvailable === true ||
        (IS_MAC_MANUAL && !!remoteVersion && remoteVersion !== current);

      // Make sure the renderer always sees `update-available` when we say there is one;
      // electron-updater sometimes won't emit on its own when the platform path skips
      // signature verification.
      if (updateAvailable && IS_MAC_MANUAL) {
        const win = getMainWindow();
        if (win?.webContents && !win.isDestroyed()) {
          win.webContents.send("update-available", {
            version: remoteVersion ?? "",
            currentVersion: current,
            releaseNotes: formatReleaseNotesPlain(result.updateInfo ?? {}),
            manualOnly: true,
          });
        }
      }

      return {
        ok: true,
        updateAvailable,
        remoteVersion,
        manualOnly: updateAvailable && IS_MAC_MANUAL ? true : undefined,
      };
    } catch (e) {
      if (isIgnorableMacUpdaterError(e)) {
        return { ok: true, updateAvailable: false, skipped: true };
      }
      console.error("[desktop] update:check", e);
      return { ok: false, error: USER_FACING_UPDATE_FAILURE };
    }
  });

  if (!app.isPackaged) {
    return;
  }

  autoUpdater.setFeedURL({
    provider: "github",
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;

  function sendProgress(payload) {
    const win = getMainWindow();
    if (win?.webContents && !win.isDestroyed()) {
      win.webContents.send("update-download-progress", payload);
    }
  }

  autoUpdater.on("update-available", (info) => {
    const win = getMainWindow();
    if (win?.webContents && !win.isDestroyed()) {
      win.webContents.send("update-available", {
        version: info.version,
        currentVersion: app.getVersion(),
        releaseNotes: formatReleaseNotesPlain(info),
        manualOnly: IS_MAC_MANUAL,
      });
    }
  });

  autoUpdater.on("download-progress", (p) => {
    sendProgress({
      percent: typeof p.percent === "number" ? p.percent : 0,
      transferred: p.transferred,
      total: p.total,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    if (userRequestedInstall) {
      setImmediate(() => {
        try {
          // true = silent (/S), true = relaunch after install (--force-run)
          autoUpdater.quitAndInstall(true, true);
        } catch (e) {
          console.error("[desktop] quitAndInstall failed:", e);
        }
      });
    }
  });

  autoUpdater.on("error", (err) => {
    if (isIgnorableMacUpdaterError(err)) {
      return;
    }
    console.error("[desktop] auto-updater:", err?.message || err);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => {
      if (isIgnorableMacUpdaterError(e)) {
        return;
      }
      console.error("[desktop] checkForUpdates:", e?.message || e);
    });
  }, 6000);
}

module.exports = { registerAutoUpdate };
