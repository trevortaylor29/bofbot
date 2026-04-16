/**
 * Backup: welcome users from the last 24h who never got the email (e.g. Resend down at signup).
 *
 * From `web/`: npm run welcome-email
 *
 * Requires: DATABASE_URL, RESEND_API_KEY, RESEND_FROM_EMAIL (verified in Resend).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import pg from "pg";
import { Resend } from "resend";

import {
  buildWelcomePlainText,
  welcomeEmailReplyTo,
} from "../lib/welcome-email-text";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  "BofBot <onboarding@resend.dev>";

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
        replyTo: welcomeEmailReplyTo(),
        subject: "Welcome to BofBot",
        text: buildWelcomePlainText(name),
      });

      if (error) {
        console.error(`[skip] ${email}: Resend:`, error.message || error);
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
      console.error(`[skip] ${email}:`, e instanceof Error ? e.message : e);
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
