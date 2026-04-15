/**
 * Stage worker (PyInstaller) + FFmpeg/ffprobe for electron-builder extraResources.
 * Run from repo: npm run build:pipeline (cwd: desktop/)
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const desktopDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopDir, "..");
const outDir = path.join(desktopDir, "build", "pipeline-staging");
const ffmpegOut = path.join(outDir, "ffmpeg");

function copyBin(src, destName) {
  if (!src || !fs.existsSync(src)) {
    throw new Error(`Binary not found: ${src}`);
  }
  const dest = path.join(ffmpegOut, destName);
  fs.mkdirSync(ffmpegOut, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("[prepare-pipeline] ffmpeg:", dest);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(ffmpegOut, { recursive: true });

// Platform-matched static binaries (Windows .exe, macOS/Linux no extension).
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");

const ffmpegDest = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const ffprobeDest = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
copyBin(ffmpegInstaller.path, ffmpegDest);
copyBin(ffprobeInstaller.path, ffprobeDest);

const pyDist = path.join(desktopDir, "build", "pyinstaller-dist");
const pyWork = path.join(desktopDir, "build", "pyinstaller-work");
const spec = path.join(desktopDir, "pyinstaller", "bofbot-worker.spec");
const pyCmd = process.env.PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
try {
  execFileSync(
    pyCmd,
    [
      "-m",
      "PyInstaller",
      "--noconfirm",
      "--clean",
      "--distpath",
      pyDist,
      "--workpath",
      pyWork,
      spec,
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
    }
  );
} catch (e) {
  console.error(
    "\n[prepare-pipeline] PyInstaller failed. Install deps, then retry:\n" +
      "  pip install pyinstaller -r requirements-worker.txt\n"
  );
  process.exit(1);
}

const builtWorker = path.join(pyDist, "bofbot-worker");
const targetWorker = path.join(outDir, "worker");
if (!fs.existsSync(builtWorker)) {
  console.error("[prepare-pipeline] Missing:", builtWorker);
  process.exit(1);
}

fs.rmSync(targetWorker, { recursive: true, force: true });
const st = fs.statSync(builtWorker);
if (st.isDirectory()) {
  fs.cpSync(builtWorker, targetWorker, { recursive: true });
} else {
  // macOS onefile: single executable at dist/bofbot-worker
  const innerName = process.platform === "win32" ? "bofbot-worker.exe" : "bofbot-worker";
  fs.mkdirSync(targetWorker, { recursive: true });
  const destBin = path.join(targetWorker, innerName);
  fs.copyFileSync(builtWorker, destBin);
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(destBin, 0o755);
    } catch {
      /* ignore */
    }
  }
}
console.log("[prepare-pipeline] worker →", targetWorker);
console.log("[prepare-pipeline] done →", outDir);
