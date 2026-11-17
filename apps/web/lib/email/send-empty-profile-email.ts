import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import EmptyProfileEmail from "./empty-profile-email";

interface SendEmptyProfileEmailParams {
  userId: string;
  email: string;
  username: string;
}

export async function sendEmptyProfileEmail({
  userId,
  email,
  username,
}: SendEmptyProfileEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const profileUrl = `${appUrl}/u/${username}`;
  const unsubscribeToken = createUnsubscribeToken(userId);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  const { error: deliveryError } = await resend.emails.send({
    from: `Straude <${fromEmail}>`,
    replyTo: "hey@straude.com",
    to: email,
    subject: `@${username}, your profile is live but empty`,
    react: EmptyProfileEmail({ username, profileUrl, unsubscribeUrl }),
    headers: {

      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [{ name: "type", value: "empty-profile" }],
  }, { idempotencyKey: `empty-profile/${userId}` });
  if (deliveryError) throw new Error(deliveryError.message);
}
