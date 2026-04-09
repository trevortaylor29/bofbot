ALTER TYPE "public"."user_plan" ADD VALUE 'basic' BEFORE 'pro';--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "raw_media_path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "processed_media_path" text;--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN "raw_s3_key";--> statement-breakpoint
ALTER TABLE "videos" DROP COLUMN "processed_s3_key";