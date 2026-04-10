/**
 * GitHub Releases auto-update (electron-updater).
 * Non-blocking UI: main sends `update-available` to renderer; user chooses Update → silent download → quitAndInstall.
 */
const { app } = require("electron");
const { autoUpdater } = require("electron-updater");

const GITHUB_OWNER = "trevortaylor29";
const GITHUB_REPO = "bofbot";

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
      const msg = e instanceof Error ? e.message : String(e);
      const win = getMainWindow();
      if (win?.webContents && !win.isDestroyed()) {
        win.webContents.send("update-error", { message: msg });
      }
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
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const win = getMainWindow();
    if (win?.webContents && !win.isDestroyed()) {
      win.webContents.send("update-available", {
        version: info.version,
        currentVersion: app.getVersion(),
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    if (userRequestedInstall) {
      setImmediate(() => {
        try {
          autoUpdater.quitAndInstall(false, true);
        } catch (e) {
          console.error("[desktop] quitAndInstall failed:", e);
        }
      });
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

module.exports = { registerAutoUpdate };
