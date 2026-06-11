/**
 * One-time script: Send Product Hunt launch email to all Straude users.
 *
 * Usage: cd apps/web && bun --env-file=.env.local run scripts/send-ph-email.ts
 *
 * Requires RESEND_API_KEY in .env.local
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY. Run from apps/web with .env.local loaded.");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

const FROM = "Straude <team@straude.com>";
const REPLY_TO = "oscar.hong2015@gmail.com";
const SUBJECT = "Support Straude on Product Hunt 🎉";

const HTML_BODY = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">Hey there,</p>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">Straude launched on Product Hunt today — and we cracked the top 10!</p>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">If you have a minute, we'd really appreciate your upvote:</p>
  <ol style="margin: 0 0 16px; padding-left: 20px; font-size: 16px; line-height: 1.8;">
    <li>Head to <strong>producthunt.com</strong> and sign in</li>
    <li>Scroll down to <strong>"Top Products Launching Today"</strong></li>
    <li>Find us at <strong>#10</strong> (just below Google, Cursor, and ChatGPT — casual company)</li>
    <li>Hit that upvote button</li>
  </ol>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">That's it. Takes 30 seconds and means the world to us.</p>
  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.5;">Help us spread the word today with a <a href="https://x.com/oscrhong/status/2040069857534951429" style="color: #df561f; text-decoration: underline;">RT/comment on X</a>, or share Straude with a friend.</p>
  <p style="margin: 0 0 4px; font-size: 16px; line-height: 1.5;">Thanks for being part of Straude. We're building this for you.</p>
  <p style="margin: 0; font-size: 16px; line-height: 1.5;">— Oscar</p>
</div>
`.trim();

const TEXT_BODY = `Hey there,

Straude launched on Product Hunt today — and we cracked the top 10!

If you have a minute, we'd really appreciate your upvote:

1. Head to producthunt.com and sign in
2. Scroll down to "Top Products Launching Today"
3. Find us at #10 (just below Google, Cursor, and ChatGPT — casual company)
4. Hit that upvote button

That's it. Takes 30 seconds and means the world to us.

Help us spread the word today with a RT/comment on X (https://x.com/oscrhong/status/2040069857534951429), or share Straude with a friend.

Thanks for being part of Straude. We're building this for you.

— Oscar`;

const EMAILS_CSV = process.env.PRODUCT_HUNT_EMAIL_RECIPIENTS;
if (!EMAILS_CSV) {
  console.error("Missing PRODUCT_HUNT_EMAIL_RECIPIENTS (comma-separated emails).");
  process.exit(1);
}

const EMAILS = EMAILS_CSV.split(",")
  .map((email) => email.trim())
  .filter(Boolean);

if (EMAILS.length === 0) {
  console.error("No valid recipients found in PRODUCT_HUNT_EMAIL_RECIPIENTS.");
  process.exit(1);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log(`Sending to ${EMAILS.length} users...`);

  const batches = chunk(EMAILS, 100);
  let sent = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Sending batch ${i + 1}/${batches.length} (${batch.length} emails)...`);

    const { error } = await resend.batch.send(
      batch.map((to) => ({
        from: FROM,
        replyTo: REPLY_TO,
        to,
        subject: SUBJECT,
        html: HTML_BODY,
        text: TEXT_BODY,
        tags: [{ name: "type", value: "product-hunt-launch" }],
      }))
    );

    if (error) {
      console.error(`Batch ${i + 1} failed:`, error);
      continue;
    }

    sent += batch.length;
    console.log(`Batch ${i + 1} sent. (${sent}/${EMAILS.length} total)`);
  }

  console.log(`Done. Sent ${sent} emails.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
