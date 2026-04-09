# BofBot — Web App Build Spec

## Overview
TikTok Shop creators upload raw videos, choose overlay presets, enter hook text, and download processed videos with styled overlays. **Processing runs on the user’s machine** (Python + FFmpeg + Pillow) via a local FastAPI worker; **Vercel** hosts marketing, auth, billing, and usage APIs backed by **Neon Postgres**.

## Tech Stack
- **Desktop / local:** Electron-wrapped Next.js UI (planned) + Python worker on the same machine; media under `web/.data/media`
- **Frontend (web):** Next.js App Router
- **Backend/API (Vercel):** Next.js API routes — auth, Stripe, subscription checks, daily usage
- **Processing worker:** FastAPI + `tiktoked.py` — reads/writes **local disk** only (paths relative to `BOFBOT_MEDIA_ROOT`)
- **Database:** Postgres (Neon) — users, plans, usage counters
- **Auth:** NextAuth.js (Google + email/password optional)
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
2. Selects overlay style: **Banner** or **Fulltext** (visual preview of each)
3. Inputs hook text (banner pairs or fulltext lines; multiple variations rotate per video)
4. User uploads videos (drag & drop, multi-select). Accepted: .mp4, .mov, .m4v
5. User clicks **Process videos** — Next.js saves raw files locally, calls the local worker per video, polls progress
6. Progress: "Processing X/Y videos…"
7. When done: **Download all (.zip)** or individual file links (served from local Next.js download routes)

### 4. Hook Library (saved per user)
- Saved hooks per user; "My Hooks" page to manage banner pairs and fulltext hooks

---

## Overlay Preset System

### Banner Style — Color Presets (user does NOT control these)
Random color combo per video from fixed presets (pink/magenta/orange/red/white combinations — see worker defaults).

### Fulltext Style
- White text, black stroke, large type in upper portion of 9:16 frame

### What users control
- Style (banner vs fulltext), hook copy, number of variations

### What users do not control
- Colors, fonts, layout presets (fixed in `config.json` / worker)

---

## Processing Pipeline (Local Worker)

1. Next.js writes raw file to `raw/{batchId}/{videoId}.ext` under the shared media root
2. Next.js `POST`s to worker with `video_rel_path` and `processed_rel_path` (e.g. `out/{batchId}/{videoId}.ext`)
3. Worker copies to temp dir, normalizes resolution (FFmpeg), composites Pillow overlay (watermark on overlay PNG for free tier), writes output under `out/…`
4. Next.js polls in-memory batch status until done; builds download URLs for processed files

### Notes
- Sequential processing per batch from Next.js caller
- FFmpeg timeout per step: 120s (fixed in worker code)
- Non–1080×1920 inputs are scaled/padded in normalize step

---

## Database Schema

### users
- id, email, name, password_hash (nullable if OAuth), plan, Stripe fields, usage counters, timestamps

### batches
- id, user_id, status, overlay_style, totals, timestamps  
- `zip_url` optional (legacy / future use)

### videos
- id, batch_id, user_id  
- Relative paths under the media root for raw input and processed output (`raw_media_path`, `processed_media_path`)

### hooks
- Saved hook library per user

---

## Stripe Billing Plans
(Free / Starter / Basic / Pro — daily limits, watermark on free; see `web/lib/plans.ts`.)

---

## Pages / Routes

### Public
- `/`, `/login`, `/signup`, `/pricing`

### Authenticated
- `/dashboard`, `/upload`, `/hooks`, `/batch/[batchId]`, settings / billing as implemented

---

## API Routes (Next.js)

- Auth: NextAuth catch-all + signup/login routes as in repo
- Batches: create, list, detail, upload, process, process-status, download-local paths
- Billing: Stripe checkout / webhook / portal when wired

---

## Worker API (FastAPI, local)

- `POST /process` — JSON body: `video_rel_path`, `processed_rel_path`, `overlay_style`, hooks, optional `watermark_text`
- `GET /health` — `{ "status": "ok", "storage": "local" }`

---

## File Cleanup / Storage
- Raw and processed files live on disk under the configured media root; retention policy is a product decision (not automatic in this repo).

---

## What NOT to Build (yet)
- No user-editable fonts/colors beyond presets
- No trimming beyond overlay
- No TikTok API
- No separate mobile app

---

## Dev Sequence (suggested)
1. Local worker + `tiktoked.py` + shared `BOFBOT_MEDIA_ROOT`
2. Postgres + NextAuth + upload/process flow
3. Stripe + usage enforcement on Vercel
4. Electron shell + subscription ping from desktop app
