/**
 * BofBot desktop — standalone React UI + local Python worker.
 * Auth and plan: BOFBOT_API_URL (default from `src/config.ts`). No embedded Next.js.
 */
const fs = require("fs");
const path = require("path");

function readApiBaseDefaultFromConfigTs() {
  const configTs = path.join(__dirname, "config.ts");
  const src = fs.readFileSync(configTs, "utf8");
  const m = src.match(/export const API_BASE_URL\s*=\s*["']([^"']+)["']\s*;?/m);
  if (!m) {
    throw new Error(
      `desktop/src/config.ts must define: export const API_BASE_URL = "..."; (${configTs})`
    );
  }
  return m[1].trim().replace(/\/$/, "");
}

const { app, BrowserWindow, dialog, shell, session } = require("electron");

/** Repo root in dev (`desktop/` parent). Unused paths in packaged builds. */
const DEV_REPO_ROOT = path.resolve(__dirname, "..", "..");
if (!app.isPackaged) {
  require("dotenv").config({
    path: path.join(DEV_REPO_ROOT, "web", ".env.local"),
  });
  require("dotenv").config({ path: path.join(DEV_REPO_ROOT, "web", ".env") });
}
const { spawn } = require("child_process");
const http = require("http");
const treeKill = require("tree-kill");
const { createAuthApi } = require("./main/auth-api.cjs");
const { runBatch } = require("./main/process-batch.cjs");
const { registerAutoUpdate } = require("./main/auto-updater.cjs");

const WORKER_PORT = 8000;
const WORKER_HEALTH_URL = `http://127.0.0.1:${WORKER_PORT}/health`;

const API_BASE = (
  process.env.BOFBOT_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  readApiBaseDefaultFromConfigTs()
)
  .trim()
  .replace(/\/$/, "");

const WORKER_URL = (
  process.env.WORKER_URL || `http://127.0.0.1:${WORKER_PORT}`
).replace(/\/$/, "");
const WORKER_KEY = (process.env.WORKER_API_KEY || "").trim();

let mainWindow = null;
let workerProc = null;
/** @type {ReturnType<createAuthApi> | null} */
let authApi = null;

/** Last successful `getPlan()` result for desktop UI; cleared on logout. */
let lastPlanCache = null;

const MSG_PLAN_INTERNET =
  "Internet connection required to verify your subscription.";
const MSG_PLAN_DAILY = `Daily limit reached. Upgrade your plan at ${API_BASE}/pricing`;
const MSG_PLAN_STARTER_CUSTOM =
  "Starter plan allows up to 5 custom hooks. Upgrade to Pro for unlimited.";
const MSG_PLAN_FREE_CUSTOM =
  "Free plan includes unlimited preset hooks. Custom text in the fields requires a paid plan.";

function normalizeDesktopPlanId(plan) {
  if (!plan || typeof plan !== "string") return "free";
  const p = plan.toLowerCase();
  if (p === "basic") return "starter";
  return p;
}

function storePath() {
  return path.join(app.getPath("userData"), "bofbot-desktop.json");
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), "utf8");
}

function defaultMediaRoot() {
  return path.join(app.getPath("userData"), "bofbot-media");
}

/**
 * Ensure folder exists and the app can write inside it (mkdir + probe file).
 * @param {string} rootAbs
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateMediaRootWritable(rootAbs) {
  try {
    fs.mkdirSync(rootAbs, { recursive: true });
    const probe = path.join(rootAbs, ".bofbot-write-probe");
    fs.writeFileSync(probe, "1", "utf8");
    fs.unlinkSync(probe);
    return { ok: true };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: code ? `${msg} (${code})` : msg,
    };
  }
}

/** Cleared when the user saves a new media root so the next read re-validates. */
let mediaRootCache = null;

function invalidateMediaRootCache() {
  mediaRootCache = null;
}

/**
 * Absolute media root: uses saved path if present and writable, else userData/bofbot-media.
 * If the saved path fails (missing, EPERM, read-only, etc.), clears it from the store and falls back.
 */
function getMediaRoot() {
  if (mediaRootCache !== null) return mediaRootCache;

  const s = readStore();
  const fallback = defaultMediaRoot();
  const raw =
    s.mediaRoot && typeof s.mediaRoot === "string" ? s.mediaRoot.trim() : "";
  const configured = raw ? path.resolve(raw) : null;

  if (configured) {
    const v = validateMediaRootWritable(configured);
    if (v.ok) {
      mediaRootCache = configured;
      return configured;
    }
    console.warn(
      "[desktop] Saved media folder is not usable; resetting to default:",
      configured,
      v.error
    );
    delete s.mediaRoot;
    writeStore(s);
  }

  const v2 = validateMediaRootWritable(fallback);
  if (!v2.ok) {
    console.error(
      "[desktop] Default media folder is not writable:",
      fallback,
      v2.error
    );
    throw new Error(
      `Cannot use or create the media folder under app data: ${v2.error}`
    );
  }
  mediaRootCache = fallback;
  return fallback;
}

function getRecentBatches() {
  const s = readStore();
  return Array.isArray(s.recentBatches) ? s.recentBatches : [];
}

/**
 * @param {{ id: string, completedAt: number, videoCount: number, outputDir: string }} entry
 */
function pushRecentBatch(entry) {
  const s = readStore();
  const list = Array.isArray(s.recentBatches) ? s.recentBatches : [];
  list.unshift(entry);
  s.recentBatches = list.slice(0, 5);
  writeStore(s);
}

/** True if `child` is the same path as `parent` or a path inside it. */
function pathIsUnder(parentAbs, childAbs) {
  const p = path.resolve(parentAbs);
  const c = path.resolve(childAbs);
  if (c === p) return true;
  const prefix = p.endsWith(path.sep) ? p : `${p}${path.sep}`;
  return c.startsWith(prefix);
}

/**
 * Delete on-disk output (and matching raw/) for every recent batch, then clear the list.
 * Only removes directories that resolve under the current media root under `out/<batchId>/`.
 */
function deleteAllRecentBatchOutputs() {
  const mediaRoot = path.resolve(getMediaRoot());
  const s = readStore();
  const list = Array.isArray(s.recentBatches) ? s.recentBatches : [];
  const seenOut = new Set();

  for (const entry of list) {
    if (!entry || typeof entry.outputDir !== "string") continue;
    const outDir = path.resolve(entry.outputDir);
    if (!pathIsUnder(mediaRoot, outDir)) continue;
    const rel = path.relative(mediaRoot, outDir);
    const segs = rel.split(path.sep).filter(Boolean);
    if (segs[0] !== "out" || segs.length < 2) continue;
    if (seenOut.has(outDir)) continue;
    seenOut.add(outDir);
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    const batchId = segs[1];
    if (batchId && batchId !== "." && batchId !== "..") {
      const rawDir = path.join(mediaRoot, "raw", batchId);
      if (pathIsUnder(mediaRoot, rawDir)) {
        try {
          fs.rmSync(rawDir, { recursive: true, force: true });
        } catch {
          /* raw may already be gone */
        }
      }
    }
  }

  s.recentBatches = [];
  writeStore(s);
  return { ok: true, removedFolders: seenOut.size };
}

function pythonExecutable() {
  if (process.env.PYTHON && process.env.PYTHON.trim()) {
    return process.env.PYTHON.trim();
  }
  return process.platform === "win32" ? "python" : "python3";
}

/** Extra resources shipped next to the app (worker exe, ffmpeg, …). */
function pipelineResourcesRoot() {
  if (!app.isPackaged) return null;
  return path.join(process.resourcesPath, "bofbot-pipeline");
}

function spawnWorker() {
  const mediaRoot = getMediaRoot();
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    BOFBOT_MEDIA_ROOT: mediaRoot,
    TIKTOKED_MEDIA_ROOT: mediaRoot,
    BOFBOT_WORKER_PORT: String(WORKER_PORT),
  };

  const pipe = pipelineResourcesRoot();
  if (pipe) {
    const ffmpegDir = path.join(pipe, "ffmpeg");
    if (fs.existsSync(ffmpegDir)) {
      env.BOFBOT_FFMPEG_DIR = ffmpegDir;
    }
    // Windows: PyInstaller emits bofbot-worker.exe. macOS/Linux: executable has no extension.
    const workerBinary =
      process.platform === "win32" ? "bofbot-worker.exe" : "bofbot-worker";
    const workerExe = path.join(pipe, "worker", workerBinary);
    if (!fs.existsSync(workerExe)) {
      throw new Error(
        `Bundled worker missing (${workerExe}). Re-run npm run build:pipeline.`
      );
    }
    return spawn(workerExe, [], {
      cwd: path.dirname(workerExe),
      env,
      stdio: "inherit",
      windowsHide: true,
    });
  }

  const bin = pythonExecutable();
  const args = [
    "-m",
    "uvicorn",
    "worker.app:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(WORKER_PORT),
  ];
  return spawn(bin, args, {
    cwd: DEV_REPO_ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
}

function killTree(proc) {
  if (!proc || proc.killed || proc.pid == null) return;
  try {
    treeKill(proc.pid, "SIGTERM", (err) => {
      if (err) treeKill(proc.pid, "SIGKILL", () => {});
    });
  } catch (e) {
    console.error("[desktop] kill failed", e);
  }
}

function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => setTimeout(attempt, 400));
      req.setTimeout(2500, () => {
        req.destroy();
        setTimeout(attempt, 400);
      });
    }
    attempt();
  });
}

async function startWorkerOnly() {
  workerProc = spawnWorker();
  workerProc.on("error", (err) => console.error("[desktop] worker spawn error:", err));
  workerProc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error("[desktop] worker exited", code);
    }
  });
  await waitForHttpOk(WORKER_HEALTH_URL, 90_000);
}

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");
  const iconPath = path.join(__dirname, "..", "icon.png");
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
    // Never auto-open DevTools (extra window confuses users). Set BOFBOT_OPEN_DEVTOOLS=1 to enable.
    if (process.env.BOFBOT_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    const html = path.join(__dirname, "..", "dist", "renderer", "index.html");
    mainWindow.loadFile(html);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc({ ipcMain }) {
  authApi = createAuthApi({ apiBase: API_BASE, storePath: storePath(), fs });

  ipcMain.handle("auth:login", async (_e, email, password) => {
    return authApi.login(email, password);
  });
  ipcMain.handle("auth:logout", async () => {
    lastPlanCache = null;
    return authApi.logout();
  });
  ipcMain.handle("auth:getSession", async () => authApi.getSession());

  ipcMain.handle("plan:get", async () => {
    const r = await authApi.getPlan();
    if (r.ok) lastPlanCache = r;
    return r;
  });

  ipcMain.handle("settings:pickFolder", async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const r = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });

  ipcMain.handle("settings:getMediaRoot", async () => getMediaRoot());

  ipcMain.handle("settings:setMediaRoot", async (_e, p) => {
    if (!p || typeof p !== "string") {
      return { ok: false, error: "Invalid folder path." };
    }
    const trimmed = p.trim();
    if (!trimmed) {
      return { ok: false, error: "Invalid folder path." };
    }
    const resolved = path.resolve(trimmed);
    const v = validateMediaRootWritable(resolved);
    if (!v.ok) {
      return {
        ok: false,
        error:
          v.error ||
          "That folder is not writable. Choose another location or fix permissions.",
      };
    }
    const s = readStore();
    s.mediaRoot = resolved;
    writeStore(s);
    invalidateMediaRootCache();
    return { ok: true };
  });

  ipcMain.handle("shell:openDashboard", async () => {
    await shell.openExternal(`${API_BASE}/dashboard`);
    return { ok: true };
  });

  ipcMain.handle("shell:openSignup", async () => {
    await shell.openExternal(`${API_BASE}/signup`);
    return { ok: true };
  });

  ipcMain.handle("shell:openPricing", async () => {
    await shell.openExternal(`${API_BASE}/pricing`);
    return { ok: true };
  });

  ipcMain.handle("app:getRuntimeInfo", () => ({
    isPackaged: app.isPackaged,
    platform: process.platform,
  }));

  /**
   * Windows packaged only: remove userData (Roaming), then run NSIS uninstaller /S and quit.
   */
  ipcMain.handle("app:uninstall", async () => {
    if (process.platform !== "win32") {
      return {
        ok: false,
        error: "Uninstall from Settings is only available on Windows.",
      };
    }
    if (!app.isPackaged) {
      return {
        ok: false,
        error: "Uninstall from Settings is only available in the installed app.",
      };
    }
    killTree(workerProc);
    workerProc = null;

    const userData = app.getPath("userData");
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch (e) {
      console.warn("[desktop] userData remove:", e?.message || e);
    }

    const instDir = path.dirname(process.execPath);
    let uninst = null;
    try {
      const names = fs.readdirSync(instDir);
      const hit = names.find((n) => /^Uninstall.*\.exe$/i.test(n));
      if (hit) uninst = path.join(instDir, hit);
    } catch (e) {
      console.warn("[desktop] list install dir:", e?.message || e);
    }
    if (!uninst) {
      const fallback = path.join(instDir, "Uninstall BofBot.exe");
      if (fs.existsSync(fallback)) uninst = fallback;
    }
    if (!uninst || !fs.existsSync(uninst)) {
      return {
        ok: false,
        error:
          "Could not find the uninstaller. Remove BofBot from Settings → Apps → Installed apps.",
      };
    }

    try {
      spawn(uninst, ["/S"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    setImmediate(() => {
      try {
        mainWindow?.destroy();
      } catch (_) {
        /* ignore */
      }
      app.quit();
    });

    return { ok: true };
  });

  ipcMain.handle("batch:recent", async () => getRecentBatches());

  ipcMain.handle("batch:deleteAllRecentOutput", async () =>
    deleteAllRecentBatchOutputs()
  );

  ipcMain.handle("shell:openPath", async (_e, p) => {
    if (!p) return { ok: false };
    const err = await shell.openPath(p);
    return err ? { ok: false, error: err } : { ok: true };
  });

  ipcMain.handle("batch:pickVideos", async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Video", extensions: ["mp4", "mov", "webm", "mkv", "m4v"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (r.canceled || !r.filePaths?.length) return [];
    return r.filePaths;
  });

  /**
   * Long-running batch uses send + reply channel (not invoke) so the renderer is not blocked
   * waiting on ipcRenderer.invoke — on macOS that blocked state prevented batch:progress from
   * being handled until the batch finished. Progress and plan:snapshot go to event.sender.
   */
  ipcMain.on("batch:process-run", (event, envelope) => {
    void (async () => {
      if (
        !envelope ||
        typeof envelope.requestId !== "string" ||
        !envelope.requestId ||
        !envelope.payload ||
        typeof envelope.payload !== "object"
      ) {
        return;
      }
      const { requestId, payload } = envelope;
      const wc = event.sender;

      const reply = (result) => {
        try {
          if (wc && !wc.isDestroyed()) {
            wc.send(`batch:process-done-${requestId}`, result);
          }
        } catch (_) {
          /* ignore */
        }
      };

      try {
        const {
          filePaths,
          overlayStyle,
          bannerLine1Options,
          bannerLine2Options,
          bannerFixedHooks,
          line1EmojiPool,
          line2EmojiPool,
          bannerHooks,
          bannerPriceStrikeHooks,
          fulltextHooks,
          colorPresets,
          customBannerPairCount,
          customFulltextLineCount,
        } = payload;

        if (!Array.isArray(filePaths) || filePaths.length === 0) {
          reply({ ok: false, error: "No videos selected." });
          return;
        }

        const planRes = await authApi.getPlan();
        if (!planRes.ok) {
          if (planRes.error === "not_signed_in") {
            reply({
              ok: false,
              error: "Not signed in.",
              code: "not_signed_in",
            });
            return;
          }
          reply({
            ok: false,
            error: MSG_PLAN_INTERNET,
            code: "plan_unreachable",
          });
          return;
        }

        lastPlanCache = planRes;

        const { plan, videosProcessedToday, limits } = planRes.plan;
        const maxDayPre = limits.maxVideosPerDay;
        if (maxDayPre !== -1 && videosProcessedToday >= maxDayPre) {
          reply({
            ok: false,
            error: MSG_PLAN_DAILY,
            code: "daily_limit",
          });
          return;
        }

        const customBannerN = Number(customBannerPairCount) || 0;
        const customFtN = Number(customFulltextLineCount) || 0;
        const customTotal = customBannerN + customFtN;
        const maxH = limits.maxCustomHooks;
        const maxCustomAllowed =
          maxH === -1 ? Number.POSITIVE_INFINITY : Math.max(0, maxH);
        if (customTotal > maxCustomAllowed) {
          const pid = normalizeDesktopPlanId(plan);
          if (pid === "starter") {
            reply({
              ok: false,
              error: MSG_PLAN_STARTER_CUSTOM,
              code: "starter_custom",
            });
            return;
          }
          if (pid === "free") {
            reply({
              ok: false,
              error: MSG_PLAN_FREE_CUSTOM,
              code: "free_custom_hooks",
            });
            return;
          }
          reply({
            ok: false,
            error: "Your plan limits custom hooks. Use presets or upgrade.",
            code: "custom_hooks_limit",
          });
          return;
        }

        let bannerHookCount = 0;
        let fulltextHookCount = 0;

        if (overlayStyle === "banner" || overlayStyle === "mix") {
          const l1 =
            Array.isArray(bannerLine1Options) && bannerLine1Options.length > 0
              ? bannerLine1Options
              : null;
          const l2 =
            Array.isArray(bannerLine2Options) && bannerLine2Options.length > 0
              ? bannerLine2Options
              : null;
          const fixedN = Array.isArray(bannerFixedHooks) ? bannerFixedHooks.length : 0;
          const legacyN = Array.isArray(bannerHooks) ? bannerHooks.length : 0;
          const strikeN = Array.isArray(bannerPriceStrikeHooks)
            ? bannerPriceStrikeHooks.length
            : 0;
          if (l1 && l2) {
            bannerHookCount = l1.length * l2.length + fixedN + strikeN;
          } else if (legacyN > 0) {
            bannerHookCount = legacyN + strikeN;
          } else if (strikeN > 0) {
            bannerHookCount = strikeN;
          }
        }
        if (overlayStyle === "fulltext" || overlayStyle === "mix") {
          fulltextHookCount = Array.isArray(fulltextHooks) ? fulltextHooks.length : 0;
        }

        let hookCount = 0;
        if (overlayStyle === "banner") {
          hookCount = bannerHookCount;
        } else if (overlayStyle === "fulltext") {
          hookCount = fulltextHookCount;
        } else if (overlayStyle === "mix") {
          if (bannerHookCount < 1) {
            reply({
              ok: false,
              error:
                "Mix mode needs banner hooks: pick top and bottom chips, add custom pairs, or enable a strike layout preset.",
            });
            return;
          }
          if (fulltextHookCount < 1) {
            reply({
              ok: false,
              error: "Mix mode needs at least one full text hook.",
            });
            return;
          }
          hookCount = Math.max(bannerHookCount, fulltextHookCount);
        }

        if (hookCount < 1) {
          reply({ ok: false, error: "Add at least one hook variant." });
          return;
        }

        const sendProgress = (data) => {
          if (wc && !wc.isDestroyed()) {
            wc.send("batch:progress", data);
          }
        };

        const result = await runBatch({
          authApi,
          apiBase: API_BASE,
          workerBase: WORKER_URL,
          workerKey: WORKER_KEY || undefined,
          mediaRoot: getMediaRoot(),
          fileAbsolutePaths: filePaths,
          overlayStyle,
          bannerLine1Options,
          bannerLine2Options,
          bannerFixedHooks,
          line1EmojiPool,
          line2EmojiPool,
          bannerHooks,
          bannerPriceStrikeHooks,
          fulltextHooks,
          colorPresets,
          onProgress: sendProgress,
          onUsageUpdated: (inc) => {
            if (
              wc &&
              !wc.isDestroyed() &&
              inc &&
              typeof inc.videosProcessedToday === "number"
            ) {
              wc.send("plan:snapshot", {
                videosProcessedToday: inc.videosProcessedToday,
              });
            }
            if (inc && typeof inc.videosProcessedToday === "number" && lastPlanCache?.ok) {
              lastPlanCache = {
                ...lastPlanCache,
                plan: {
                  ...lastPlanCache.plan,
                  videosProcessedToday: inc.videosProcessedToday,
                },
              };
            }
          },
        });

        if (result.ok && result.outputDir && result.batchId) {
          pushRecentBatch({
            id: result.batchId,
            completedAt: Date.now(),
            videoCount: result.processed ?? filePaths.length,
            outputDir: result.outputDir,
          });
        }

        reply(result);
      } catch (err) {
        console.error("[desktop] batch:process-run", err);
        reply({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  });

  registerAutoUpdate({ ipcMain, getMainWindow: () => mainWindow });
}

function registerRendererCspMerge() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const rh = { ...details.responseHeaders };
    const key = Object.keys(rh).find((k) => k.toLowerCase() === "content-security-policy");
    if (key) {
      const raw = rh[key];
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (typeof v === "string" && v && !/\bimg-src\s+[^;]*\bdata:/.test(v)) {
        rh[key] = [`${v}; img-src 'self' data:`];
      }
    }
    callback({ responseHeaders: rh });
  });
}

async function bootstrap() {
  registerRendererCspMerge();
  const { ipcMain } = require("electron");
  registerIpc({ ipcMain });

  try {
    await startWorkerOnly();
    createWindow();
  } catch (err) {
    console.error(err);
    await dialog.showErrorBox(
      "BofBot — could not start worker",
      err.message || String(err)
    );
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  killTree(workerProc);
  workerProc = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  killTree(workerProc);
  workerProc = null;
});
