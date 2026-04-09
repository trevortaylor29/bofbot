import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

/**
 * Shared local media directory for raw uploads and processed outputs.
 * Must match Python worker BOFBOT_MEDIA_ROOT / TIKTOKED_MEDIA_ROOT (default: web/.data/media).
 */
export function getMediaRoot(): string {
  const fromEnv =
    process.env.BOFBOT_MEDIA_ROOT?.trim() ||
    process.env.LOCAL_MEDIA_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), ".data", "media");
}

export function rawRelPath(
  batchId: string,
  videoId: string,
  ext: ".mp4" | ".mov"
): string {
  return path.join("raw", batchId, `${videoId}${ext}`).replace(/\\/g, "/");
}

export function outRelPath(
  batchId: string,
  videoId: string,
  ext: ".mp4" | ".mov"
): string {
  return path.join("out", batchId, `${videoId}${ext}`).replace(/\\/g, "/");
}

export function absFromRel(rel: string): string {
  const root = getMediaRoot();
  const normalized = rel.replace(/\\/g, "/");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid relative path");
  }
  const joined = path.resolve(root, ...normalized.split("/"));
  const relCheck = path.relative(root, joined);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    throw new Error("Path escapes media root");
  }
  return joined;
}

export async function ensureDirForFile(absFile: string): Promise<void> {
  await fs.mkdir(path.dirname(absFile), { recursive: true });
}

export function fileExistsRel(rel: string): boolean {
  try {
    return existsSync(absFromRel(rel));
  } catch {
    return false;
  }
}
