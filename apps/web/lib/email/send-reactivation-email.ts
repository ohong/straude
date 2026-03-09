import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import ReactivationEmail from "./reactivation-email";

interface SendReactivationEmailParams {
  userId: string;
  email: string;
}

export async function sendReactivationEmail({
  userId,
  email,
}: SendReactivationEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const unsubscribeToken = createUnsubscribeToken(userId);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  await resend.emails.send({
    from: `Straude <${fromEmail}>`,
    replyTo: "hey@straude.com",
    to: email,
    subject: "Your Straude account is ready — sorry for the delay",
    react: ReactivationEmail({ unsubscribeUrl }),
    headers: {
      "Idempotency-Key": `reactivation/${userId}`,
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [{ name: "type", value: "reactivation" }],
  });
}
