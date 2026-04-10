/**
 * GitHub Releases via electron-updater (feed from electron-builder `publish` → app-update.yml).
 * Set `build.publish` owner/repo in package.json to match your releases repo before shipping.
 */
const { BrowserWindow, dialog, app } = require("electron");
const { autoUpdater } = require("electron-updater");

function formatReleaseNotes(rn) {
  if (!rn) return "";
  if (typeof rn === "string") return rn;
  if (Array.isArray(rn)) {
    return rn
      .map((n) => (typeof n === "object" && n && "note" in n ? n.note : String(n)))
      .filter(Boolean)
      .join("\n\n");
  }
  return String(rn);
}

/**
 * @param {() => import("electron").BrowserWindow | null} getMainWindow
 */
function setupAutoUpdater(getMainWindow) {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", async (info) => {
    const win = getMainWindow() || BrowserWindow.getFocusedWindow();
    const notes = formatReleaseNotes(info.releaseNotes);
    const detail =
      notes.trim().slice(0, 4000) ||
      "A newer version is available on GitHub Releases.";

    const { response } = await dialog.showMessageBox(win || undefined, {
      type: "info",
      buttons: ["Download update", "Not now"],
      defaultId: 0,
      cancelId: 1,
      title: "Update available",
      message: `BofBot ${info.version} is available (you have ${app.getVersion()}).`,
      detail,
    });

    if (response === 0) {
      try {
        await autoUpdater.downloadUpdate();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await dialog.showErrorBox("Update download failed", msg);
      }
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const win = getMainWindow() || BrowserWindow.getFocusedWindow();
    const { response } = await dialog.showMessageBox(win || undefined, {
      type: "info",
      buttons: ["Restart and install", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: `BofBot ${info.version} is downloaded.`,
      detail: "Restart now to finish installing. You can also install on the next quit.",
    });
    if (response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[desktop] auto-updater:", err?.message || err);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => {
      console.error("[desktop] checkForUpdates:", e?.message || e);
    });
  }, 6000);
}

module.exports = { setupAutoUpdater };
