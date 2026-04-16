/**
 * Sends a one-time welcome email to users who signed up in the last 24 hours.
 *
 * Requires: DATABASE_URL, RESEND_API_KEY, RESEND_FROM_EMAIL (verified domain in Resend).
 *
 * Usage (from `web/`):
 *   node scripts/welcome-email.mjs
 *
 * Run after DB migration that adds `welcome_email_sent` (see `drizzle/migrations/0008_*`).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import pg from "pg";
import { Resend } from "resend";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  "BofBot <onboarding@resend.dev>";
const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.AUTH_URL ||
  "https://bofbot.com"
)
  .trim()
  .replace(/\/$/, "");

function buildEmailHtml(name) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #18181b;">
  <p>${greeting}</p>
  <p>Welcome to <strong>BofBot</strong> — we’re glad you’re here. You can add TikTok Shop-style overlays to your product videos right from your PC.</p>
  <p><a href="${APP_ORIGIN}/dashboard" style="color: #e11d48;">Open your dashboard</a> to get started, or reply to this email if you have questions.</p>
  <p>— The BofBot team</p>
</body>
</html>`;
}

function buildEmailText(name) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return `${greeting}

Welcome to BofBot — we're glad you're here. You can add TikTok Shop-style overlays to your product videos right from your PC.

Open your dashboard: ${APP_ORIGIN}/dashboard

Reply to this email if you have questions.

— The BofBot team`;
}

async function main() {
  if (!DATABASE_URL) {
    console.error("Missing DATABASE_URL (set in .env.local).");
    process.exit(1);
  }
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY (set in .env.local).");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const resend = new Resend(RESEND_API_KEY);

  const { rows } = await pool.query(
    `SELECT id, email, name
     FROM users
     WHERE created_at > NOW() - INTERVAL '24 hours'
       AND (welcome_email_sent IS NOT TRUE)`
  );

  if (rows.length === 0) {
    console.log("No users need a welcome email right now.");
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} user(s) to welcome.`);

  let sent = 0;
  let failed = 0;

  for (const user of rows) {
    const email = user.email;
    const name = user.name?.trim() || null;
    try {
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM,
        to: [email],
        subject: "Welcome to BofBot",
        html: buildEmailHtml(name),
        text: buildEmailText(name),
      });

      if (error) {
        console.error(`[skip] ${email}: Resend —`, error.message || error);
        failed += 1;
        continue;
      }
      if (!data?.id) {
        console.error(`[skip] ${email}: Resend returned no id`);
        failed += 1;
        continue;
      }

      await pool.query(
        `UPDATE users SET welcome_email_sent = true, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
      console.log(`[ok] ${email}`);
      sent += 1;
    } catch (e) {
      console.error(`[skip] ${email}:`, e?.message || e);
      failed += 1;
    }
  }

  await pool.end();
  console.log(`Done. Sent: ${sent}, failed: ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
