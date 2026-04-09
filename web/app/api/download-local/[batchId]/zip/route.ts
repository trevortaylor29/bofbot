import archiver from "archiver";
import fs from "fs/promises";
import { PassThrough, Readable } from "node:stream";
import path from "path";

import { absFromRel } from "@/lib/local-media";

export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId: rawBatch } = await params;
  const decodedBatch = decodeURIComponent(rawBatch);

  if (
    !decodedBatch ||
    decodedBatch.includes("..") ||
    path.isAbsolute(decodedBatch)
  ) {
    return Response.json({ error: "Invalid batch" }, { status: 400 });
  }

  const relDir = path.join("out", decodedBatch).replace(/\\/g, "/");
  let absDir: string;
  try {
    absDir = absFromRel(relDir);
  } catch {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  let names: string[];
  try {
    names = await fs.readdir(absDir);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const candidates = names.filter((n) => {
    const lower = n.toLowerCase();
    if (!lower.endsWith(".mp4") && !lower.endsWith(".mov")) return false;
    if (n.includes("..") || n.includes("/") || n.includes("\\")) return false;
    return true;
  });

  const sorted = [...candidates].sort();
  const existing: string[] = [];
  for (const name of sorted) {
    const abs = path.join(absDir, name);
    try {
      await fs.access(abs);
      existing.push(name);
    } catch {
      /* skip missing */
    }
  }

  if (existing.length === 0) {
    return Response.json(
      { error: "No processed videos in this batch" },
      { status: 404 }
    );
  }

  const pass = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 5 } });

  archive.on("error", (err: Error) => {
    pass.destroy(err);
  });

  archive.pipe(pass);

  for (const name of existing) {
    archive.file(path.join(absDir, name), { name });
  }

  void archive.finalize();

  const webStream = Readable.toWeb(pass) as ReadableStream<Uint8Array>;

  const safeSlug = decodedBatch.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 40);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bofbot-${safeSlug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
