import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import NotificationEmail, {
  buildSubject,
  type NotificationType,
} from "./notification-email";

interface SendNotificationEmailParams {
  recipientUserId: string;
  recipientEmail: string;
  actorUsername: string;
  type: NotificationType;
  content: string;
  postId: string;
  postTitle: string | null;
  /** Unique ID for idempotency (e.g. comment ID or a composite key). */
  idempotencyKey: string;
}

/**
 * Send a notification email (comment or mention).
 *
 * Uses React Email for the template (auto-generates plain text via Resend SDK),
 * idempotency keys to prevent duplicates, and tags for tracking.
 */
export async function sendNotificationEmail({
  recipientUserId,
  recipientEmail,
  actorUsername,
  type,
  content,
  postId,
  postTitle,
  idempotencyKey,
}: SendNotificationEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.error("[email] RESEND_API_KEY not configured; skipping notification email");
    return;
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const postUrl = `${appUrl}/post/${postId}`;
  const unsubscribeToken = createUnsubscribeToken(recipientUserId);
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  await resend.emails.send({
    from: `Straude <${fromEmail}>`,
    replyTo: "hey@straude.com",
    to: recipientEmail,
    subject: buildSubject(type, actorUsername),
    react: NotificationEmail({
      actorUsername,
      type,
      content,
      postTitle,
      postUrl,
      unsubscribeUrl,
    }),
    headers: {
      "Idempotency-Key": idempotencyKey,
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [
      { name: "type", value: type },
      { name: "post_id", value: postId },
    ],
  });
}

// Re-export for backwards compat with existing test imports
export { sendNotificationEmail as sendCommentNotificationEmail };
