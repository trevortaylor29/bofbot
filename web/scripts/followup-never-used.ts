/**
 * Free users who got the welcome email but have not processed any videos today.
 *
 * From `web/`: npm run followup-never-used
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import pg from "pg";
import { Resend } from "resend";

import { welcomeEmailReplyTo } from "../lib/welcome-email-text";

const MD = "\u2014";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  "BofBot <onboarding@resend.dev>";

function buildBody(name: string | null) {
  const who = name?.trim() ? name.trim() : "there";
  return `Hey ${who},

I noticed you signed up for BofBot but haven't tried processing any videos yet ${MD} totally fine, just wanted to check in.

If you're stuck on setup, these might help:
- Mac users: bofbot.com/mac-help
- Getting videos from phone to PC: bofbot.com/setup-guide

Or just reply to this email and I'll walk you through it personally.

${MD} Trev, BofBot`;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT id, email, name FROM users
     WHERE plan = 'free'
       AND videos_processed_today = 0
       AND welcome_email_sent IS TRUE
       AND (followup_sent IS NOT TRUE)`
  );

  if (rows.length === 0) {
    console.log("No users match followup-never-used criteria.");
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} user(s).`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const user = rows[i];
    const email = user.email;
    const name = user.name?.trim() || null;
    try {
      const { data, error } = await resend.emails.send({
        from: RESEND_FROM,
        to: [email],
        replyTo: welcomeEmailReplyTo(),
        subject: "Need help getting started?",
        text: buildBody(name),
      });

      if (error) {
        console.error(`[skip] ${email}: Resend:`, error.message || error);
        failed += 1;
      } else if (!data?.id) {
        console.error(`[skip] ${email}: Resend returned no id`);
        failed += 1;
      } else {
        await pool.query(
          `UPDATE users SET followup_sent = true, updated_at = NOW() WHERE id = $1`,
          [user.id]
        );
        console.log(`[ok] ${email}`);
        sent += 1;
      }
    } catch (e) {
      console.error(`[skip] ${email}:`, e instanceof Error ? e.message : e);
      failed += 1;
    }

    if (i < rows.length - 1) await delay(300);
  }

  await pool.end();
  console.log(`Done. Sent: ${sent}, failed: ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
