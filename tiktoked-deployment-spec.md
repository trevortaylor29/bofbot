# BofBot — Production Deployment Spec

## Architecture
- **Frontend (Next.js)** → Vercel
- **Worker (Python/FastAPI)** → DigitalOcean Droplet
- **Database (Postgres)** → Neon
- **File Storage** → Cloudflare R2
- **Payments** → Stripe
- **Domain** → connect to Vercel

**Current deployment step:** **Step 2** — run the worker on a DigitalOcean droplet (below). Step 1 items are implemented incrementally in the repo.

---

## Step 1: Update the codebase for production

### 1a. Switch file storage from local disk to Cloudflare R2

Replace all local file read/write in the upload and download flow with R2 (S3-compatible) calls.

**Upload flow:**
- Frontend gets a presigned upload URL from the Next.js API
- Frontend uploads the video directly to R2 using that presigned URL (no video passes through the Next.js server)
- Next.js API records the R2 key in the database

**Processing flow:**
- Next.js API tells the worker: "process this R2 key"
- Worker downloads video from R2, processes it, uploads result back to R2
- Worker responds with the processed R2 key

**Download flow:**
- Next.js API generates a presigned download URL from R2
- Frontend redirects user to that URL (or for batch: worker creates zip, uploads zip to R2, returns presigned URL)

**R2 Configuration (S3-compatible):**
- Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- Use `@aws-sdk/client-s3` in Next.js and `boto3` in Python worker
- Bucket name: `bofbot`

### 1b. Wire up Neon Postgres

- Set `DATABASE_URL` to the Neon connection string
- Run `npx drizzle-kit push` to create tables
- Re-enable auth middleware (NextAuth with credentials + Google OAuth)
- All batch/video/hook/user records stored in Neon

### 1c. Wire up Stripe

**Products to create in Stripe Dashboard (test mode first):**
- Free plan: no Stripe product needed (default)
- Starter plan: $10/month recurring
- Basic plan: $14.99/month recurring
- Pro plan: $25/month recurring

**Implementation:**
- `POST /api/billing/create-checkout` — creates a Stripe Checkout session for the selected plan
- `POST /api/billing/webhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- On signup, create a Stripe customer and store `stripe_customer_id` in the users table
- On successful checkout, update user's `plan` field in database
- On cancellation, downgrade to free
- `GET /api/billing/portal` — returns a Stripe Customer Portal URL so users can manage their subscription

**Usage enforcement:**
- Before processing, check user's plan and `videos_processed_today` count
- Free: 5/day, Starter: 15/day, Basic: 30/day, Pro: 125/day
- Reset count daily (check `last_reset_date`, if different from today, reset to 0)

### 1d. Security hardening

- **Passwords:** Already bcrypt hashed — keep it
- **HTTPS:** Vercel provides this automatically. Worker needs HTTPS too — use Cloudflare proxy or set up Let's Encrypt on the droplet
- **Worker API key:** Generate a random 64-char string. Set as `WORKER_API_KEY` on both Vercel (env var) and the droplet. Next.js sends it in the `Authorization: Bearer <key>` header when calling the worker. Worker rejects requests without it. This prevents random people from hitting your worker directly.
- **Rate limiting:** Add rate limiting to signup (5/hour per IP) and login (10/hour per IP) endpoints using `next-rate-limit` or similar
- **Database:** Neon is only accessible via the connection string (SSL required) — no public exposure
- **CORS:** Worker should only accept requests from your Vercel domain
- **File cleanup:** Add R2 lifecycle rule to auto-delete files older than 7 days, or run a daily cron job

### 1e. Add watermark for free tier

- When processing a video for a free-tier user, add a small "bofbot.com" watermark in the bottom-right corner of the video
- Paid users get no watermark
- The worker needs to know the user's plan — pass it in the process request

---

## Step 2: Deploy the Worker to DigitalOcean

Repo helpers (commit these paths):

| File | Purpose |
|------|---------|
| `deploy/systemd/bofbot-worker.service` | systemd unit — copy to `/etc/systemd/system/` |
| `deploy/env.worker.example` | Template for `/opt/bofbot/.env` on the droplet |
| `deploy/push-worker-to-droplet.sh` | `rsync` from repo root → droplet (Git Bash / macOS / Linux) |
| `deploy/push-worker-to-droplet.ps1` | `scp` from Windows PowerShell |

**What must live on the droplet** (same layout as repo root): `tiktoked.py`, `worker/`, `config.json`, `fonts/`, `requirements.txt`, `requirements-worker.txt`, and `emoji/` if you use it.

### 2a. First-time droplet setup (SSH)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv ffmpeg rsync

sudo mkdir -p /opt/bofbot
sudo chown -R "$USER":"$USER" /opt/bofbot
cd /opt/bofbot

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-worker.txt
```

### 2b. Copy code from your machine

From the **repo root** on your laptop (replace `user@DROPLET_IP`):

- **Bash:** `chmod +x deploy/push-worker-to-droplet.sh && ./deploy/push-worker-to-droplet.sh user@DROPLET_IP`
- **PowerShell:** `.\deploy\push-worker-to-droplet.ps1 user@DROPLET_IP`

Or use `git clone` on the server into `/opt/bofbot` instead, then still run `pip install -r requirements-worker.txt` inside `venv`.

### 2c. Environment file on the droplet

```bash
nano /opt/bofbot/.env
```

Use `deploy/env.worker.example` as a guide: set **R2_***, **WORKER_API_KEY**, and **TIKTOKED_CONFIG=/opt/bofbot/config.json**.

### 2d. Install systemd service

On the droplet:

```bash
sudo cp /opt/bofbot/deploy/systemd/bofbot-worker.service /etc/systemd/system/bofbot-worker.service
sudo systemctl daemon-reload
sudo systemctl enable bofbot-worker
sudo systemctl start bofbot-worker
sudo systemctl status bofbot-worker
curl -s http://127.0.0.1:8000/health
```

Expect JSON like `{"status":"ok","storage":"r2"}` when R2 env is set.

### 2e. Smoke-test before systemd (optional)

```bash
cd /opt/bofbot && source venv/bin/activate
set -a && source .env && set +a
uvicorn worker.app:app --host 0.0.0.0 --port 8000
```

### 2f. Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8000/tcp  # Worker (tighten to Vercel IPs later)
sudo ufw enable
```

### 2g. Point Vercel at the worker

Set **`WORKER_URL`** to `http://<DROPLET_PUBLIC_IP>:8000` (or HTTPS URL once you terminate TLS). Set **`WORKER_API_KEY`** to the same value as on the droplet.

**Next:** [Step 3 — Deploy frontend to Vercel](#step-3-deploy-frontend-to-vercel).

---

## Step 3: Deploy Frontend to Vercel

1. **GitHub:** Create the repository as **private** (or *Settings → General → Danger zone → Change repository visibility → Make private*). Never commit `.env`, `.env.local`, or API keys — they are listed in `.gitignore` at the repo root and under `web/`. Use `git ls-files | grep -E '\.env|credentials'` before pushing to confirm no secrets are tracked.
2. Push the `web/` folder (or the whole monorepo) to GitHub
3. Connect the repo to Vercel
4. Set these environment variables in Vercel dashboard:

```
DATABASE_URL=<neon_connection_string>
AUTH_SECRET=<random_32+_char_string>
AUTH_URL=https://yourdomain.com

WORKER_URL=http://<DROPLET_IP>:8000
WORKER_API_KEY=<same_key_as_on_droplet>

R2_BUCKET=bofbot
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your_key>
R2_SECRET_ACCESS_KEY=<your_secret>

STRIPE_SECRET_KEY=<sk_test_...>
STRIPE_PUBLISHABLE_KEY=<pk_test_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_test_...>
```

5. Deploy
6. Run database migration: in Vercel build command or manually `npx drizzle-kit push`

---

## Step 4: Connect Domain

1. Buy a domain (Namecheap, Cloudflare, etc.)
2. In Vercel: Settings → Domains → Add your domain
3. Update DNS records as Vercel instructs (usually a CNAME or A record)
4. Update `AUTH_URL` env var to your real domain
5. Update Stripe webhook endpoint to `https://yourdomain.com/api/billing/webhook`

---

## Step 5: Stripe Webhook Setup

1. In Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/billing/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the webhook signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel

---

## Step 6: Test Everything End to End

1. Sign up with a new account
2. Upload a test video
3. Process it
4. Download the result
5. Test Stripe checkout (use test card 4242424242424242)
6. Verify usage limits work
7. Test the free tier watermark

---

## Environment Variables Summary

### Vercel (Next.js)
```
DATABASE_URL
AUTH_SECRET
AUTH_URL
WORKER_URL
WORKER_API_KEY
R2_BUCKET
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

### DigitalOcean Droplet (Worker)
```
R2_BUCKET
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
WORKER_API_KEY
TIKTOKED_CONFIG
```

---

## Dev sequence for Cursor
1. Update worker to use R2 instead of local files (boto3 with R2 endpoint)
2. Update Next.js upload flow to use presigned R2 URLs
3. Update Next.js download flow to use presigned R2 URLs
4. Wire up Neon — set DATABASE_URL, run migrations, re-enable auth
5. Wire up Stripe — checkout, webhooks, usage enforcement
6. Add watermark logic for free tier
7. Add worker API key auth
8. Add rate limiting on auth endpoints
9. Deploy worker to droplet
10. Deploy frontend to Vercel
11. Connect domain
12. Test everything
