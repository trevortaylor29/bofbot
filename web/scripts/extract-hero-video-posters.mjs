/**
 * One frame at 1s → demoN.jpg next to demoN.mp4 (hero carousel posters for iOS / slow networks).
 * Requires ffmpeg on PATH. Run from repo root: node web/scripts/extract-hero-video-posters.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "public", "videos");
const count = 11;

for (let i = 1; i <= count; i++) {
  const mp4 = path.join(dir, `demo${i}.mp4`);
  const jpg = path.join(dir, `demo${i}.jpg`);
  if (!fs.existsSync(mp4)) {
    console.warn("Skip (missing):", mp4);
    continue;
  }
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      mp4,
      "-ss",
      "00:00:01",
      "-vf",
      "scale=720:-2",
      "-vframes",
      "1",
      "-q:v",
      "3",
      jpg,
    ],
    { stdio: "inherit" }
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log("Wrote", path.relative(process.cwd(), jpg));
}
