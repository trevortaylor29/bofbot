import {
  HeadObjectCommand,
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
