# BofBot — Web App Build Spec

## Overview
A web app where TikTok Shop creators upload raw videos, choose overlay presets, input their own rotating hook text, and download processed videos with styled text overlays burned in. The processing backend is FFmpeg + Pillow (already built and working as a local Python script — this spec converts it to a web service).

## Tech Stack
- **Frontend:** Next.js (App Router) deployed on Vercel
- **Backend/API:** Next.js API routes for auth, billing, user management
- **Processing Worker:** Separate Python server (Flask or FastAPI) on a VPS (DigitalOcean / Railway) that runs the FFmpeg + Pillow overlay pipeline
- **Database:** Postgres (Supabase or Neon — free tier to start)
- **File Storage:** AWS S3 (or Cloudflare R2 for cheaper) — raw uploads and processed outputs
- **Job Queue:** Redis + Bull (Node) or Redis + RQ (Python) for managing video processing jobs
- **Auth:** NextAuth.js (Google + email/password)
- **Payments:** Stripe subscriptions

---

## User Flow

### 1. Sign Up / Login
- User creates account (Google OAuth or email/password)
- Lands on dashboard

### 2. Dashboard
- Shows recent batches (date, video count, status, download link)
- Shows usage stats: videos processed this billing period vs plan limit
- Big "Upload Videos" button

### 3. Upload Flow
1. User clicks "Upload Videos"
2. Selects overlay style: **Banner** or **Fulltext** (visual preview of each shown)
3. Inputs their hook text:
   - **Banner mode:** User adds pairs (line 1 text + line 2 text). Can add multiple pairs. Color scheme randomly selected from presets per video.
   - **Fulltext mode:** User adds hook strings. Can add multiple. One randomly selected per video.
4. User uploads videos (drag & drop, multi-select). Accepted: .mp4, .mov
5. User clicks "Process" — videos enter the queue
6. Progress shown: "Processing 12/30 videos..."
7. When done: "Download All" button (zip file) or individual downloads

### 4. Hook Library (saved per user)
- Users can save their hooks so they don't have to re-enter them every time
- "My Hooks" page where they manage their saved banner pairs and fulltext hooks
- When uploading, they can pick from saved hooks or enter new ones

---

## Overlay Preset System

### Banner Style — Color Presets (user does NOT control these)
The app randomly assigns one of these color combos per video:
```
Preset 1: Line 1 = pink bg (#FF69B4), white text | Line 2 = red bg (#FF0000), white text
Preset 2: Line 1 = magenta bg (#DD00FF), white text | Line 2 = red bg (#FF0000), white text
Preset 3: Line 1 = orange bg (#FF8C00), white text | Line 2 = red bg (#FF0000), white text
Preset 4: Line 1 = red bg (#FF0000), white text | Line 2 = white bg (#FFFFFF), black text
Preset 5: Line 1 = red bg (#FF0000), white text | Line 2 = white bg (#FFFFFF), black text
```

### Fulltext Style
- White text, black stroke outline (5-6px)
- Large bold font, fills top 30-40% of frame
- No user color control — it's always white on black stroke

### What users DO control:
- Which style (banner or fulltext)
- The actual hook TEXT (what the words say)
- How many hook variations to rotate through

### What users do NOT control:
- Colors, fonts, positioning, box styling — these are fixed presets

---

## Processing Pipeline (Backend Worker)

This is essentially the existing Python script adapted for server use:

1. Worker picks up job from Redis queue
2. Downloads raw video from S3 to temp directory
3. Randomly selects:
   - A hook text pair/string from the user's provided hooks
   - A color preset (for banner style)
4. Generates transparent PNG overlay using Pillow (1080x1920)
5. Composites overlay onto video using FFmpeg
6. Uploads processed video to S3
7. Cleans up temp files
8. Marks job as complete in database
9. When all videos in a batch are done, generates zip file and notifies user (or just marks batch as ready)

### Important processing notes:
- Videos should be processed sequentially per batch (not all at once) to avoid overloading the VPS
- Max concurrent processing jobs: configurable, start with 2-3 at a time across all users
- Timeout per video: 120 seconds — if FFmpeg hangs, kill and mark as failed
- If input video is not 1080x1920, scale it to 1080x1920 BEFORE overlaying
- Never pick the same hook twice in a row within a batch

---

## Database Schema

### users
- id (uuid, primary key)
- email
- name
- password_hash (nullable if Google OAuth)
- google_id (nullable)
- stripe_customer_id
- plan (enum: free, starter, basic, pro)
- videos_processed_this_period (int)
- billing_period_start (timestamp)
- created_at
- updated_at

### batches
- id (uuid, primary key)
- user_id (foreign key)
- status (enum: uploading, processing, complete, failed)
- overlay_style (enum: banner, fulltext)
- total_videos (int)
- processed_videos (int)
- zip_url (nullable, S3 URL)
- created_at
- completed_at

### videos
- id (uuid, primary key)
- batch_id (foreign key)
- user_id (foreign key)
- raw_s3_key
- processed_s3_key (nullable)
- status (enum: pending, processing, complete, failed)
- hook_text_used (text — for record keeping)
- color_preset_used (text — for record keeping)
- created_at
- processed_at

### hooks
- id (uuid, primary key)
- user_id (foreign key)
- style (enum: banner, fulltext)
- line1_text (text — for banner)
- line2_text (text, nullable — for banner)
- fulltext (text, nullable — for fulltext)
- created_at

---

## Stripe Billing Plans

### Free
- 5 videos per day
- Watermark on output (small "bofbot.com" in bottom corner — drives signups)

### Starter — $10/month
- 15 videos per day
- No watermark

### Basic — $14.99/month
- 30 videos per day
- No watermark

### Pro — $25/month
- 125 videos per day
- No watermark
- Priority processing (jobs go to front of queue)

### Billing logic:
- Usage resets daily at midnight UTC
- If user exceeds daily limit, they see "Upgrade to process more videos today"
- Stripe webhook handles subscription creation, cancellation, renewal
- On failed payment, downgrade to free after 3-day grace period

---

## Pages / Routes

### Public
- `/` — Landing page (hero, features, pricing, CTA to sign up)
- `/login` — Login page
- `/signup` — Signup page
- `/pricing` — Pricing breakdown

### Authenticated
- `/dashboard` — Main dashboard, recent batches, usage stats
- `/upload` — Upload flow (select style → enter hooks → upload videos → process)
- `/hooks` — Manage saved hooks
- `/batch/[id]` — Batch detail (progress, individual video status, download links)
- `/settings` — Account settings, plan management, billing portal (Stripe Customer Portal link)

---

## API Routes (Next.js)

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/session`

### Batches
- `POST /api/batches` — Create new batch
- `GET /api/batches` — List user's batches
- `GET /api/batches/[id]` — Get batch status + videos

### Videos
- `POST /api/upload` — Get presigned S3 upload URLs (client uploads directly to S3)
- `POST /api/process` — Start processing a batch (sends jobs to Redis queue)
- `GET /api/download/[batchId]` — Get download URL (zip or individual)

### Hooks
- `GET /api/hooks` — List user's saved hooks
- `POST /api/hooks` — Save new hook
- `DELETE /api/hooks/[id]` — Delete hook

### Billing
- `POST /api/billing/create-checkout` — Create Stripe Checkout session
- `POST /api/billing/webhook` — Stripe webhook handler
- `GET /api/billing/portal` — Get Stripe Customer Portal URL

---

## Processing Worker API (Python FastAPI on VPS)

The Vercel backend does NOT run FFmpeg — it sends jobs to the Python worker.

### Endpoints on the worker:
- `POST /process` — Accepts: `{video_s3_key, overlay_style, hooks, color_presets}`. Downloads from S3, processes, uploads result to S3, returns `{processed_s3_key}`.
- `GET /health` — Health check

### Communication flow:
1. Next.js API creates batch + video records in DB
2. For each video, pushes a job to Redis queue (or directly calls worker API)
3. Worker processes video, uploads to S3
4. Worker calls back to Next.js API: `POST /api/webhooks/processing-complete` with `{video_id, processed_s3_key, status}`
5. Next.js updates DB, checks if batch is complete
6. When batch complete, generates zip (or marks as ready for download)

---

## Frontend Design Notes
- Clean, dark-mode UI (dark grays/blacks — this audience is young TikTok creators)
- Minimal pages, minimal clicks to upload and process
- The upload page should feel fast and simple — not overwhelming
- Show a live preview mockup of what the overlay will look like on a sample frame before processing
- Mobile responsive but desktop-first (most batch uploading happens on desktop)

---

## File Cleanup / Storage Management
- Raw uploads: delete from S3 after processing is complete
- Processed videos: keep for 7 days, then auto-delete (tell user this)
- Zip files: keep for 7 days, then auto-delete
- Use S3 lifecycle rules for auto-deletion

---

## What NOT to Build (yet)
- No custom colors/fonts for users — presets only
- No video trimming or editing beyond overlay
- No TikTok API integration — ever
- No mobile app — web only
- No team/collaboration features
- No analytics dashboard beyond basic usage stats

---

## Dev Sequence (suggested order to build)
1. **Processing worker** — port existing Python script to FastAPI, accept S3 keys, process, upload back. Test standalone.
2. **Database + Auth** — Postgres schema, NextAuth setup, basic signup/login
3. **Upload flow** — S3 presigned uploads, batch creation, hook input UI
4. **Queue + processing trigger** — Wire upload to worker, show progress
5. **Download flow** — Zip generation, download links
6. **Hook library** — Save/manage hooks
7. **Stripe billing** — Plans, checkout, webhooks, usage enforcement
8. **Landing page** — Marketing page with pricing
9. **Polish** — Loading states, error handling, mobile responsive, watermark for free tier
