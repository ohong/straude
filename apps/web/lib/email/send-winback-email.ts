import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import WinbackEmail from "./winback-email";

interface SendWinbackEmailParams {
  userId: string;
  email: string;
}

export async function sendWinbackEmail({
  userId,
  email,
}: SendWinbackEmailParams): Promise<void> {
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
    subject: "Set up your Strava for Claude Code profile in 30 seconds",
    react: WinbackEmail({ unsubscribeUrl }),
    headers: {
      "Idempotency-Key": `winback/${userId}`,
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [{ name: "type", value: "winback" }],
  });
}
