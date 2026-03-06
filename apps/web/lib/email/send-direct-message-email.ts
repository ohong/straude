import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import DirectMessageEmail, {
  buildDirectMessageSubject,
} from "./direct-message-email";

interface SendDirectMessageEmailParams {
  recipientUserId: string;
  recipientEmail: string;
  actorUsername: string;
  content: string;
  idempotencyKey: string;
}

export async function sendDirectMessageEmail({
  recipientUserId,
  recipientEmail,
  actorUsername,
  content,
  idempotencyKey,
}: SendDirectMessageEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.error("[email] RESEND_API_KEY not configured; skipping direct message email");
    return;
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const unsubscribeToken = createUnsubscribeToken(recipientUserId);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}&kind=dm`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  await resend.emails.send({
    from: `Straude <${fromEmail}>`,
    replyTo: "hey@straude.com",
    to: recipientEmail,
    subject: buildDirectMessageSubject(actorUsername),
    react: DirectMessageEmail({
      actorUsername,
      content,
      conversationUrl: `${appUrl}/messages?with=${encodeURIComponent(actorUsername)}`,
      settingsUrl: `${appUrl}/settings`,
      unsubscribeUrl,
    }),
    headers: {
      "Idempotency-Key": idempotencyKey,
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "type", value: "direct_message" },
      { name: "actor", value: actorUsername },
    ],
  });
}
