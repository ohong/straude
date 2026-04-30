import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { normalizeMessageAttachmentInput } from "@/lib/storage";
import { MessagesInbox } from "@/components/app/messages/MessagesInbox";
import type {
  DirectMessageThread,
  MessageAttachment,
  MessageAttachmentInput,
} from "@/types";

export const metadata: Metadata = { title: "Messages" };

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

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

async function buildSignedAttachments(
  rawAttachments: unknown,
): Promise<MessageAttachment[]> {
  const db = getServiceClient();
  const attachments = Array.isArray(rawAttachments)
    ? rawAttachments
        .map(normalizeMessageAttachmentInput)
        .filter((attachment): attachment is MessageAttachmentInput => attachment !== null)
    : [];

  if (attachments.length === 0) return [];

  const signedAttachments = await Promise.all(
    attachments.map(async (attachment): Promise<MessageAttachment | null> => {
      const { data, error } = await db.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 60 * 60);

      if (error || !data?.signedUrl) return null;
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

async function preloadConversation(viewerId: string, username: string) {
  if (!USERNAME_RE.test(username)) return null;

  const db = getServiceClient();
  const { data: counterpart, error: counterpartError } = await db
    .from("users")
    .select("id, username, avatar_url, display_name, is_public")
    .eq("username", username)
    .maybeSingle();

  if (counterpartError || !counterpart || counterpart.id === viewerId) {
    return null;
  }

  if (!counterpart.is_public) {
    const { data: existingThread } = await db
      .from("direct_messages")
      .select("id")
      .or(buildPairFilter(viewerId, counterpart.id))
      .limit(1)
      .maybeSingle();

    if (!existingThread) return null;
  }

  const [selfRes, messagesRes] = await Promise.all([
    db
      .from("users")
      .select("id, username, avatar_url, display_name")
      .eq("id", viewerId)
      .single(),
    db
      .from("direct_messages")
      .select("id, sender_id, recipient_id, content, attachments, read_at, created_at")
      .or(buildPairFilter(viewerId, counterpart.id))
      .order("created_at", { ascending: false })
      .limit(51),
  ]);

  if (selfRes.error || messagesRes.error) return null;

  const selfProfile = selfRes.data as ConversationUser;
  const messages = await Promise.all(
    [...(messagesRes.data ?? [])].slice(0, 50).reverse().map(async (message) => ({
      ...message,
      attachments: await buildSignedAttachments(message.attachments),
      sender: message.sender_id === viewerId ? selfProfile : counterpart,
      recipient: message.sender_id === viewerId ? counterpart : selfProfile,
    })),
  );

  return {
    counterpart: counterpart as ConversationUser,
    current_user_id: viewerId,
    messages,
    has_more: (messagesRes.data?.length ?? 0) > 50,
  };
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const [{ with: withUsername }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const threadsPromise = Promise.all([
    supabase.rpc("get_direct_message_threads", { p_limit: 50 }),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  const explicitUsername = withUsername?.trim() || null;
  const explicitConversationPromise = explicitUsername
    ? preloadConversation(user.id, explicitUsername)
    : Promise.resolve(null);
  const [threadsResults, explicitConversation] = await Promise.all([
    threadsPromise,
    explicitConversationPromise,
  ]);

  const [threadsRes, unreadRes] = threadsResults;
  const initialThreads = {
    threads: (threadsRes.data ?? []) as DirectMessageThread[],
    unread_count: unreadRes.count ?? 0,
  };

  const preloadUsername =
    explicitUsername ?? initialThreads.threads[0]?.counterpart_username ?? null;
  const initialConversation = explicitUsername
    ? explicitConversation
    : preloadUsername
      ? await preloadConversation(user.id, preloadUsername)
      : null;

  return (
    <MessagesInbox
      initialUsername={explicitUsername}
      initialThreads={threadsRes.error || unreadRes.error ? undefined : initialThreads}
      initialConversation={initialConversation}
    />
  );
}
