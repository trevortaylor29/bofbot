ALTER TABLE "videos" RENAME COLUMN "raw_s3_key" TO "raw_media_path";--> statement-breakpoint
ALTER TABLE "videos" RENAME COLUMN "processed_s3_key" TO "processed_media_path";
