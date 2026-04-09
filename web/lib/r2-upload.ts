import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
