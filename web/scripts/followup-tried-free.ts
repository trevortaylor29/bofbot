/**
 * Free users who have processed at least one video today (still on free plan).
 *
 * From `web/`: npm run followup-tried-free
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

Saw you've been processing some videos ${MD} nice! How's it working out? Anything we could do better?

If you're hitting the 3 video daily limit, Starter ($19/mo) bumps you to 25/day with no watermark. Or go Pro for unlimited.

Either way, I'd love to hear your feedback ${MD} just reply to this email.

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
       AND videos_processed_today > 0
       AND (followup_sent IS NOT TRUE)`
  );

  if (rows.length === 0) {
    console.log("No users match followup-tried-free criteria.");
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
        subject: "How's BofBot working for you?",
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
