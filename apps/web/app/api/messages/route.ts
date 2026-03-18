import { NextResponse, type NextRequest } from "next/server";
import { after } from "@/lib/utils/after";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { normalizeMessageAttachmentInput } from "@/lib/storage";
import { sendDirectMessageEmail } from "@/lib/email/send-direct-message-email";
import { rateLimit } from "@/lib/rate-limit";
import type { MessageAttachment, MessageAttachmentInput } from "@/types";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MAX_MESSAGE_LENGTH = 1000;

interface ConversationUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
  is_public?: boolean;
}

function buildPairFilter(a: string, b: string) {
  return `and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`;
}

async function resolveConversationUser(viewerId: string, username: string) {
  const db = getServiceClient();
  const { data: counterpart, error } = await db
    .from("users")
    .select("id, username, avatar_url, display_name, is_public")
    .eq("username", username)
    .maybeSingle();

  if (error || !counterpart) {
    return null;
  }

  if (counterpart.id === viewerId) {
    return counterpart as ConversationUser;
  }

  if (counterpart.is_public) {
    return counterpart as ConversationUser;
  }

  const { data: existingThread } = await db
    .from("direct_messages")
    .select("id")
    .or(buildPairFilter(viewerId, counterpart.id))
    .limit(1)
    .maybeSingle();

  return existingThread ? (counterpart as ConversationUser) : null;
}

async function fireDirectMessageNotificationEmail(opts: {
  recipientUserId: string;
  actorUsername: string;
  content: string;
  idempotencyKey: string;
}) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      console.error("[email] Supabase service env missing; skipping direct message email");
      return;
    }

    const db = getServiceClient();
    const [profileRes, authRes] = await Promise.all([
      db
        .from("users")
        .select("email_dm_notifications")
        .eq("id", opts.recipientUserId)
        .single(),
      db.auth.admin.getUserById(opts.recipientUserId),
    ]);

    if (profileRes.error) {
      console.error("[email] failed to load DM notification preferences:", profileRes.error.message);
      return;
    }
    if (!(profileRes.data as Record<string, unknown>)?.email_dm_notifications) {
      return;
    }

    if (authRes.error) {
      console.error("[email] failed to load DM recipient auth record:", authRes.error.message);
      return;
    }

    const email = authRes.data?.user?.email;
    if (!email) return;

    await sendDirectMessageEmail({
      recipientUserId: opts.recipientUserId,
      recipientEmail: email,
      actorUsername: opts.actorUsername,
      content: opts.content,
      idempotencyKey: opts.idempotencyKey,
    });
  } catch (err) {
    console.error("[email] direct message notification failed:", err);
  }
}

async function buildSignedAttachments(
  rawAttachments: unknown,
): Promise<MessageAttachment[]> {
  const db = getServiceClient();
  const attachments = Array.isArray(rawAttachments)
    ? rawAttachments
        .map(normalizeMessageAttachmentInput)
        .filter((attachment): attachment is MessageAttachmentInput => attachment !== null)
    : [];

  if (attachments.length === 0) {
    return [];
  }

  const signedAttachments: Array<MessageAttachment | null> = await Promise.all(
    attachments.map(async (attachment): Promise<MessageAttachment | null> => {
      const { data, error } = await db.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 60 * 60);

      if (error || !data?.signedUrl) {
        console.error(
          "[messages] failed to sign DM attachment:",
          error?.message ?? "missing signed URL",
        );
        return null;
      }

      return {
        ...attachment,
        url: data.signedUrl,
      };
    }),
  );

  return signedAttachments.filter(
    (attachment): attachment is MessageAttachment => attachment !== null,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get("with")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1),
    200
  );
  const before = request.nextUrl.searchParams.get("before")?.trim() ?? "";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }

  const counterpart = await resolveConversationUser(user.id, username);
  if (!counterpart) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (counterpart.id === user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const db = getServiceClient();
  const [selfRes, messagesRes] = await Promise.all([
    db
      .from("users")
      .select("id, username, avatar_url, display_name")
      .eq("id", user.id)
      .single(),
    (() => {
      let q = db
        .from("direct_messages")
        .select("id, sender_id, recipient_id, content, attachments, read_at, created_at")
        .or(buildPairFilter(user.id, counterpart.id));
      if (before) q = q.lt("created_at", before);
      return q.order("created_at", { ascending: false }).limit(limit);
    })(),
  ]);

  if (selfRes.error || messagesRes.error) {
    return NextResponse.json(
      { error: selfRes.error?.message ?? messagesRes.error?.message },
      { status: 500 }
    );
  }

  const selfProfile = selfRes.data as ConversationUser;
  const messages = await Promise.all(
    [...(messagesRes.data ?? [])].reverse().map(async (message) => ({
      ...message,
      attachments: await buildSignedAttachments(message.attachments),
      sender: message.sender_id === user.id ? selfProfile : counterpart,
      recipient: message.sender_id === user.id ? counterpart : selfProfile,
    })),
  );

  const hasMore = (messagesRes.data?.length ?? 0) >= limit;

  return NextResponse.json({
    counterpart,
    current_user_id: user.id,
    messages,
    has_more: hasMore,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit("social", user.id, { limit: 30 });
  if (limited) return limited;

  const { recipientUsername, content, attachments: rawAttachments } = await request.json();
  const normalizedUsername =
    typeof recipientUsername === "string" ? recipientUsername.trim() : "";
  const normalizedContent =
    typeof content === "string" ? content.trim() : "";
  if (
    rawAttachments !== undefined
    && (!Array.isArray(rawAttachments) || rawAttachments.length > 10)
  ) {
    return NextResponse.json(
      { error: "Attachments must be an array of at most 10 files" },
      { status: 400 },
    );
  }

  const attachments = Array.isArray(rawAttachments)
    ? rawAttachments
        .map(normalizeMessageAttachmentInput)
        .filter((attachment): attachment is MessageAttachmentInput => attachment !== null)
    : [];

  if (Array.isArray(rawAttachments) && attachments.length !== rawAttachments.length) {
    return NextResponse.json(
      { error: "Attachments must use Straude-managed DM storage uploads" },
      { status: 400 },
    );
  }

  if (!USERNAME_RE.test(normalizedUsername)) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }
  if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (!normalizedContent && attachments.length === 0) {
    return NextResponse.json(
      { error: "Message must have text or an attachment" },
      { status: 400 }
    );
  }

  const counterpart = await resolveConversationUser(user.id, normalizedUsername);
  if (!counterpart) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (counterpart.id === user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const [senderRes, messageRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, avatar_url, display_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        recipient_id: counterpart.id,
        content: normalizedContent || null,
        attachments,
      })
      .select("id, sender_id, recipient_id, content, attachments, read_at, created_at")
      .single(),
  ]);

  if (senderRes.error || messageRes.error) {
    return NextResponse.json(
      { error: senderRes.error?.message ?? messageRes.error?.message },
      { status: 500 }
    );
  }

  const sender = senderRes.data as ConversationUser;
  const signedAttachments = await buildSignedAttachments(messageRes.data.attachments);
  const message = {
    ...messageRes.data,
    attachments: signedAttachments,
    sender,
    recipient: counterpart,
  };

  after(async () => {
    const emailContent = normalizedContent
      || (attachments.some((a: { type: string }) => a.type.startsWith("image/"))
        ? "[Sent an image]"
        : `[Sent a file: ${attachments[0]?.name ?? "attachment"}]`);
    await fireDirectMessageNotificationEmail({
      recipientUserId: counterpart.id,
      actorUsername: sender.username ?? "Someone",
      content: emailContent,
      idempotencyKey: `dm-notif/${message.id}`,
    });
  });

  return NextResponse.json(message, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { with: username } = await request.json();
  const normalizedUsername = typeof username === "string" ? username.trim() : "";

  if (!USERNAME_RE.test(normalizedUsername)) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }

  const counterpart = await resolveConversationUser(user.id, normalizedUsername);
  if (!counterpart) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (counterpart.id === user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const [messagesRes, notificationsRes] = await Promise.all([
    supabase
      .from("direct_messages")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .eq("sender_id", counterpart.id)
      .is("read_at", null),
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("actor_id", counterpart.id)
      .eq("type", "message")
      .eq("read", false),
  ]);

  if (messagesRes.error || notificationsRes.error) {
    return NextResponse.json(
      { error: messagesRes.error?.message ?? notificationsRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
