INSERT INTO "users" ("id", "email", "name", "plan", "videos_processed_this_period", "created_at", "updated_at")
VALUES ('anonymous', 'guest-internal@tiktoked.local', 'Guest', 'free', 0, now(), now())
ON CONFLICT ("id") DO NOTHING;
