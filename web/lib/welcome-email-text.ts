/**
 * Plain-text welcome email (signup + backup script). Em dash via \u2014 avoids mojibake in source files.
 */
const MD = "\u2014";

export function buildWelcomePlainText(
  name: string | null | undefined
): string {
  const who = name?.trim() ? name.trim() : "there";
  return `Hey ${who},

Thanks for signing up for BofBot! If you need any help getting set up or have questions about the app, just reply to this email ${MD} I read every one.

If you haven't downloaded the app yet: bofbot.com

${MD} Trev, BofBot`;
}

/** Replies to welcome mail; prefers explicit env, then contact inbox. */
export function welcomeEmailReplyTo(): string {
  return (
    process.env.WELCOME_EMAIL_REPLY_TO?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    "aightwhatev@gmail.com"
  );
}
