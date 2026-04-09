ALTER TABLE "users" ADD COLUMN "usage_day" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "videos_processed_today" integer DEFAULT 0 NOT NULL;