import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import ReferralJoinedEmail from "./referral-joined-email";

interface SendReferralJoinedEmailParams {
  referrerId: string;
  referrerEmailNotifications: boolean;
  referrerEmail: string;
  newUserId: string;
  newUsername: string | null;
  crewCount: number;
}

export async function sendReferralJoinedEmail({
  referrerId,
  referrerEmailNotifications,
  referrerEmail,
  newUserId,
  newUsername,
  crewCount,
}: SendReferralJoinedEmailParams): Promise<void> {
  if (!referrerEmailNotifications) return;

  const resend = getResend();
  if (!resend) return;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");

  const profileUrl = newUsername ? `${appUrl}/u/${newUsername}` : appUrl;
  const unsubscribeToken = createUnsubscribeToken(referrerId);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  const who = newUsername ? `@${newUsername}` : "Someone";

  await resend.emails.send({
    from: `Straude <${fromEmail}>`,
    replyTo: "hey@straude.com",
    to: referrerEmail,
    subject: `${who} joined your crew on Straude`,
    react: ReferralJoinedEmail({
      newUsername,
      crewCount,
      profileUrl,
      unsubscribeUrl,
    }),
    headers: {
      "Idempotency-Key": `referral-joined/${referrerId}/${newUserId}`,
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [{ name: "type", value: "referral-joined" }],
  });
}
