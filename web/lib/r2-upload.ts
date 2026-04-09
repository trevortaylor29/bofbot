import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_EXPIRES_SEC = 3600;

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/**
 * True when R2 env is set so the app can mint presigned PUT URLs (Vercel-safe uploads).
 */
export function isR2DirectUploadConfigured(): boolean {
  return Boolean(
    process.env.R2_BUCKET?.trim() &&
      process.env.R2_ENDPOINT?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim()
  );
}

/**
 * Normalize to the exact S3 object key used for PutObject / HeadObject (no leading slash, forward slashes).
 */
export function normalizeR2ObjectKey(rawRelPath: string): string | null {
  const k = rawRelPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!k || k.includes("..")) return null;
  return k;
}

/**
 * Returns whether an object exists in R2. Logs bucket + key on failure for dashboard comparison.
 */
export async function rawObjectExistsInR2(objectKey: string): Promise<boolean> {
  const normalized = normalizeR2ObjectKey(objectKey);
  if (!normalized) {
    console.error(
      "[bofbot/r2] HeadObject skipped — invalid key after normalize:",
      JSON.stringify(objectKey)
    );
    return false;
  }
  const bucket = requiredEnv("R2_BUCKET");
  const client = r2Client();
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: normalized })
    );
    return true;
  } catch (e) {
    const err = e as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
      message?: string;
    };
    console.error(
      `[bofbot/r2] HeadObject NOT FOUND bucket=${JSON.stringify(bucket)} key=${JSON.stringify(normalized)} awsName=${err.name ?? "?"} http=${err.$metadata?.httpStatusCode ?? "?"} msg=${JSON.stringify(err.message ?? "")}`
    );
    return false;
  }
}

function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("R2_ENDPOINT").replace(/\/$/, ""),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

/**
 * Presigned PUT URL for a single object. Caller must send the same Content-Type header on PUT.
 */
export async function presignRawVideoPut(
  objectKey: string,
  contentType: string
): Promise<string> {
  const bucket = requiredEnv("R2_BUCKET");
  const client = r2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });
}

function contentTypeForVideoName(name: string): string {
  if (name.toLowerCase().endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

/**
 * Presigned GET URL so the browser can download an object directly from R2.
 */
export async function presignGetDownload(
  objectKey: string,
  downloadFileName: string
): Promise<string> {
  const key = normalizeR2ObjectKey(objectKey);
  if (!key) {
    throw new Error("invalid object key for presigned download");
  }
  const bucket = requiredEnv("R2_BUCKET");
  const client = r2Client();
  const safeName = downloadFileName.replace(/[\r\n"]/g, "_").slice(0, 200) || "video.mp4";
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: contentTypeForVideoName(safeName),
    ResponseContentDisposition: `attachment; filename="${safeName.replace(/"/g, "_")}"`,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });
}

/**
 * Keys under out/{batchId}/ that look like processed videos (.mp4 / .mov), sorted.
 */
export async function listOutBatchVideoKeys(batchId: string): Promise<string[]> {
  if (!isR2DirectUploadConfigured()) return [];
  const bid = batchId.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!bid || bid.includes("..")) return [];
  const prefix = `out/${bid}/`;
  const bucket = requiredEnv("R2_BUCKET");
  const client = r2Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of out.Contents ?? []) {
      const k = obj.Key;
      if (!k) continue;
      const base = k.split("/").pop() ?? "";
      if (!/\.(mp4|mov)$/i.test(base)) continue;
      if (base.includes("..") || base.includes("/") || base.includes("\\")) continue;
      keys.push(k);
    }
    continuationToken = out.IsTruncated
      ? out.NextContinuationToken
      : undefined;
  } while (continuationToken);
  keys.sort();
  return keys;
}

/**
 * Open a readable stream for an R2 object (Node.js). Caller must consume or destroy the stream.
 */
export async function getR2ObjectBodyStream(
  objectKey: string
): Promise<import("node:stream").Readable | null> {
  const key = normalizeR2ObjectKey(objectKey);
  if (!key) return null;
  const bucket = requiredEnv("R2_BUCKET");
  const client = r2Client();
  const obj = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!obj.Body) return null;
  return obj.Body as import("node:stream").Readable;
}
