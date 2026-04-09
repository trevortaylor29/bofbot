import fs from "fs/promises";
import { NextResponse } from "next/server";

import { contentTypeForFile } from "@/lib/batch-validation";
import { absFromRel, ensureDirForFile, rawRelPath } from "@/lib/local-media";
import { canUploadToSlot } from "@/lib/pending-batches";

export const maxDuration = 300;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const batchId = String(form.get("batchId") ?? "").trim();
  const videoId = String(form.get("videoId") ?? "").trim();
  const file = form.get("file");

  if (!batchId || !videoId) {
    return NextResponse.json(
      { error: "batchId and videoId are required" },
      { status: 400 }
    );
  }

  if (!canUploadToSlot(batchId, videoId)) {
    return NextResponse.json(
      { error: "Unknown batch or video slot. Create a batch first." },
      { status: 403 }
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const name = file.name.trim();
  const lower = name.toLowerCase();
  const ext = lower.endsWith(".mov") ? (".mov" as const) : (".mp4" as const);
  if (!lower.endsWith(".mp4") && !lower.endsWith(".mov")) {
    return NextResponse.json(
      { error: "Only .mp4 and .mov are allowed" },
      { status: 400 }
    );
  }

  const ct = contentTypeForFile(name, file.type || undefined);
  if (!ct) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  const rel = rawRelPath(batchId, videoId, ext);
  const abs = absFromRel(rel);

  try {
    await ensureDirForFile(abs);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(abs, buf);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    rawRelPath: rel,
    videoId,
    contentType: ct,
  });
}
