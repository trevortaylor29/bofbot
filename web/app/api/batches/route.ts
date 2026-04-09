import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import {
  contentTypeForFile,
  parseHooksSnapshot,
  validateFiles,
  type CreateBatchBody,
} from "@/lib/batch-validation";
import { isDbConnectionError } from "@/lib/db-errors";
import { rawRelPath } from "@/lib/local-media";
import { registerBatch } from "@/lib/pending-batches";
import {
  isR2DirectUploadConfigured,
  presignRawVideoPut,
} from "@/lib/r2-upload";

/**
 * Dashboard list — loads DB only when this handler runs (not on POST / upload).
 */
export async function GET() {
  const { eq } = await import("drizzle-orm");
  const { batches } = await import("@/drizzle/schema");
  const { db } = await import("@/lib/db");
  const { getActorUserId } = await import("@/lib/actor-user");

  const userId = await getActorUserId();

  try {
    const rows = await db.query.batches.findMany({
      where: eq(batches.userId, userId),
      orderBy: (b, { desc }) => [desc(b.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ batches: rows });
  } catch (e) {
    if (isDbConnectionError(e)) {
      return NextResponse.json(
        {
          error:
            "Cannot reach the database. Start Postgres and set DATABASE_URL in .env.local.",
          code: "DB_CONNECTION",
        },
        { status: 503 }
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not load batches." },
      { status: 500 }
    );
  }
}

/**
 * Register an upload batch (no DB). Client POSTs files to /api/batches/upload.
 * Kept free of top-level `db` / `auth` imports so this works without Postgres.
 */
export async function POST(request: Request) {
  let body: CreateBatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const overlayStyle = body.overlayStyle;
  if (overlayStyle !== "banner" && overlayStyle !== "fulltext") {
    return NextResponse.json(
      { error: "overlayStyle must be banner or fulltext" },
      { status: 400 }
    );
  }

  const hooksParsed = parseHooksSnapshot(overlayStyle, body.hooks);
  if (!hooksParsed.ok) {
    return NextResponse.json({ error: hooksParsed.error }, { status: 400 });
  }

  const fileList = body.files ?? [];
  const filesOk = validateFiles(fileList);
  if (!filesOk.ok) {
    return NextResponse.json({ error: filesOk.error }, { status: 400 });
  }

  const files = fileList;
  const batchId = randomUUID();
  const videoIds: string[] = [];

  for (let i = 0; i < files.length; i++) {
    videoIds.push(randomUUID());
  }

  registerBatch(batchId, videoIds);

  if (isR2DirectUploadConfigured()) {
    try {
      const uploads = await Promise.all(
        videoIds.map(async (videoId, i) => {
          const f = files[i]!;
          const lower = f.name.trim().toLowerCase();
          const ext = lower.endsWith(".mov")
            ? (".mov" as const)
            : (".mp4" as const);
          const contentType = contentTypeForFile(f.name, f.contentType)!;
          const rel = rawRelPath(batchId, videoId, ext);
          const uploadUrl = await presignRawVideoPut(rel, contentType);
          return {
            videoId,
            contentType,
            rawRelPath: rel,
            uploadUrl,
            uploadHeaders: { "Content-Type": contentType },
          };
        })
      );

      return NextResponse.json({
        batchId,
        uploads,
        storage: "r2",
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        {
          error:
            "Could not prepare direct upload. Check R2_BUCKET, R2_ENDPOINT, and R2 credentials on the server.",
        },
        { status: 500 }
      );
    }
  }

  const uploads = videoIds.map((videoId, i) => {
    const f = files[i]!;
    return {
      videoId,
      contentType: contentTypeForFile(f.name, f.contentType)!,
    };
  });

  return NextResponse.json({
    batchId,
    uploads,
    local: true,
  });
}
