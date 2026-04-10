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

const ffmpegStatic = require("ffmpeg-static");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");

copyBin(ffmpegStatic, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
copyBin(ffprobeInstaller.path, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");

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

fs.cpSync(builtWorker, targetWorker, { recursive: true });
console.log("[prepare-pipeline] worker →", targetWorker);
console.log("[prepare-pipeline] done →", outDir);
