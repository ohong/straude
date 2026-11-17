import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import WelcomeEmail from "./welcome-email";

interface SendWelcomeEmailParams {
  userId: string;
  email: string;
  username: string | null;
}

/**
 * Send a transactional welcome email after onboarding completion.
 *
 * This always sends regardless of the user's email_notifications preference
 * (it's transactional, not marketing). Uses an idempotency key based on
 * userId to prevent duplicates if onboarding is re-submitted.
 */
export async function sendWelcomeEmail({
  userId,
  email,
  username,
}: SendWelcomeEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const profileUrl = username ? `${appUrl}/u/${username}` : `${appUrl}/feed`;
  const unsubscribeToken = createUnsubscribeToken(userId);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  const { error: deliveryError } = await resend.emails.send({
    from: `Straude <${fromEmail}>`,
    replyTo: "hey@straude.com",
    to: email,
    subject: "Welcome to Straude — your first sync is complete",
    react: WelcomeEmail({
      username,
      profileUrl,
      unsubscribeUrl,
    }),
    headers: {

      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [{ name: "type", value: "welcome" }],
  }, { idempotencyKey: `welcome/${userId}` });
  if (deliveryError) throw new Error(deliveryError.message);
}
