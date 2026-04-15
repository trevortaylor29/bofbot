/**
 * GitHub Releases auto-update (electron-updater).
 * Renderer modal → download → quitAndInstall(true, true): NSIS /S + --force-run (no installer window, relaunch app).
 * Silent updates require a oneClick NSIS build (see package.json build.nsis).
 */
const { app } = require("electron");
const { autoUpdater } = require("electron-updater");

const GITHUB_OWNER = "trevortaylor29";
const GITHUB_REPO = "bofbot";

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
    userRequestedInstall = true;
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e) {
      userRequestedInstall = false;
      if (isIgnorableMacUpdaterError(e)) {
        return { ok: false, skipped: true };
      }
      const msg = e instanceof Error ? e.message : String(e);
      const win = getMainWindow();
      if (win?.webContents && !win.isDestroyed()) {
        win.webContents.send("update-error", { message: msg });
      }
      return { ok: false, error: msg };
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
      return {
        ok: true,
        updateAvailable: result.isUpdateAvailable === true,
        remoteVersion: result.updateInfo?.version,
      };
    } catch (e) {
      if (isIgnorableMacUpdaterError(e)) {
        return { ok: true, updateAvailable: false, skipped: true };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
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
