import { createReadStream } from "fs";
import fs from "fs/promises";
import { Readable } from "node:stream";
import path from "path";

import { absFromRel } from "@/lib/local-media";

function contentTypeForName(name: string): string {
  if (name.toLowerCase().endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string; file: string }> }
) {
  const { batchId, file } = await params;
  const decodedBatch = decodeURIComponent(batchId);
  const decodedFile = decodeURIComponent(file);

  if (
    !decodedFile ||
    decodedFile.includes("..") ||
    path.isAbsolute(decodedFile) ||
    decodedFile.includes("/") ||
    decodedFile.includes("\\")
  ) {
    return Response.json({ error: "Invalid file" }, { status: 400 });
  }

  const rel = path
    .join("out", decodedBatch, decodedFile)
    .replace(/\\/g, "/");

  let abs: string;
  try {
    abs = absFromRel(rel);
  } catch {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    await fs.access(abs);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const nodeStream = createReadStream(abs);
  const webStream = Readable.toWeb(nodeStream);

  return new Response(webStream as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForName(decodedFile),
      "Content-Disposition": `attachment; filename="${decodedFile.replace(/"/g, "")}"`,
    },
  });
}
