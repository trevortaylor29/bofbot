ALTER TABLE "batches" ADD COLUMN "hooks_snapshot" jsonb DEFAULT '{"style":"fulltext","variants":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "hooks_snapshot" DROP DEFAULT;
