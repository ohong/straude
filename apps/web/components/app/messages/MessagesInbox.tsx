"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, MessageSquare, Paperclip, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils/cn";
import { compressImage } from "@/lib/utils/compress-image";
import { useResponsiveShell } from "@/components/app/shared/useResponsiveShell";
import { timeAgo } from "@/lib/utils/format";
import { queryKeys } from "@/lib/query/keys";
import type {
  DirectMessage,
  DirectMessageThread,
  MessageAttachmentInput,
} from "@/types";

interface ConversationUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
}

interface PendingAttachment {
  file: File;
  preview?: string;
  uploading: boolean;
}

interface ThreadsResponse {
  threads: DirectMessageThread[];
  unread_count: number;
}

interface ConversationResponse {
  counterpart: ConversationUser | null;
  current_user_id: string | null;
  messages: LocalDirectMessage[];
}

type DeliveryStatus = "sending" | "sent" | "failed";

type LocalDirectMessage = DirectMessage & {
  delivery_status?: DeliveryStatus;
};

interface SendMessageVariables {
  username: string;
  content: string;
  pending: PendingAttachment[];
  optimisticId: string;
  previousConversation?: ConversationResponse;
  previousThreads?: ThreadsResponse;
}

const EMPTY_THREADS: DirectMessageThread[] = [];
const EMPTY_MESSAGES: LocalDirectMessage[] = [];

async function fetchThreads(): Promise<ThreadsResponse> {
  const res = await fetch("/api/messages/threads", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load messages");
  }
  const data = await res.json();
  return {
    threads: data.threads ?? [],
    unread_count: data.unread_count ?? 0,
  };
}

async function fetchConversation(username: string): Promise<ConversationResponse> {
  const res = await fetch(
    `/api/messages?with=${encodeURIComponent(username)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to load conversation" }));
    throw new Error(data.error ?? "Failed to load conversation");
  }

  const data = await res.json();
  return {
    counterpart: data.counterpart ?? null,
    current_user_id: data.current_user_id ?? null,
    messages: data.messages ?? [],
  };
}

function updateThreadAfterSend(
  thread: DirectMessageThread,
  content: string,
  createdAt: string,
  hasAttachment: boolean,
): DirectMessageThread {
  return {
    ...thread,
    last_message_content: content || null,
    last_message_created_at: createdAt,
    last_message_is_from_me: true,
    last_message_has_attachment: hasAttachment,
    unread_count: 0,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

function isImageMime(type: string, fileName?: string): boolean {
  if (type.startsWith("image/")) return true;
  if (!fileName) return false;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.includes(ext);
}

function threadPreview(thread: DirectMessageThread): string {
  const prefix = thread.last_message_is_from_me ? "You: " : "";
  if (thread.last_message_content) {
    return `${prefix}${thread.last_message_content}`;
  }
  if (thread.last_message_has_attachment) {
    return `${prefix}Sent an attachment`;
  }
  return "";
}

export function MessagesInbox({
  initialUsername,
  initialThreads,
  initialConversation,
}: {
  initialUsername: string | null;
  initialThreads?: ThreadsResponse;
  initialConversation?: ConversationResponse | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const shellMode = useResponsiveShell();
  const [activeUsername, setActiveUsername] = useState(initialUsername);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<
    Record<string, LocalDirectMessage[]>
  >({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPhone = shellMode === "phone";
  const showThreadList = !isPhone || !activeUsername;
  const showConversation = !isPhone || Boolean(activeUsername);

  const threadsQuery = useQuery({
    queryKey: queryKeys.messageThreads(),
    queryFn: fetchThreads,
    initialData: initialThreads,
    placeholderData: (previousData) => previousData,
    staleTime: 10_000,
  });

  const threads = threadsQuery.data?.threads ?? EMPTY_THREADS;
  const threadsLoading = threadsQuery.isPending && threads.length === 0;

  useEffect(() => {
    if (threadsLoading) return;
    if (isPhone) return;
    if (!activeUsername && threads[0]?.counterpart_username) {
      setActiveUsername(threads[0].counterpart_username);
    }
  }, [activeUsername, isPhone, threads, threadsLoading]);

  const conversationQuery = useQuery({
    queryKey: activeUsername
      ? queryKeys.messageConversation(activeUsername)
      : queryKeys.messageConversation(null),
    queryFn: () => fetchConversation(activeUsername as string),
    enabled: Boolean(activeUsername),
    initialData: () => {
      if (
        activeUsername &&
        initialConversation?.counterpart?.username === activeUsername
      ) {
        return initialConversation;
      }
      return undefined;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 10_000,
  });

  const conversation = conversationQuery.data;
  const counterpart = conversation?.counterpart ?? null;
  const currentUserId = conversation?.current_user_id ?? null;
  const cachedMessages = conversation?.messages ?? EMPTY_MESSAGES;
  const messages = useMemo(
    () =>
      activeUsername
        ? [...cachedMessages, ...(optimisticMessages[activeUsername] ?? EMPTY_MESSAGES)]
        : cachedMessages,
    [activeUsername, cachedMessages, optimisticMessages],
  );
  const conversationLoading = conversationQuery.isPending && !conversation;
  const conversationIsCurrent = counterpart?.username === activeUsername;

  useEffect(() => {
    if (conversationQuery.error) {
      setError((conversationQuery.error as Error).message);
    } else if (conversationIsCurrent) {
      setError(null);
    }
  }, [conversationIsCurrent, conversationQuery.error]);

  useEffect(() => {
    for (const thread of threads.slice(0, 3)) {
      if (!thread.counterpart_username) continue;
      queryClient.prefetchQuery({
        queryKey: queryKeys.messageConversation(thread.counterpart_username),
        queryFn: () => fetchConversation(thread.counterpart_username as string),
        staleTime: 10_000,
      });
    }
  }, [queryClient, threads]);

  const markReadMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ with: username }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to mark messages read" }));
        throw new Error(data.error ?? "Failed to mark messages read");
      }
      return username;
    },
    onMutate: async (username) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.messageThreads() });
      const previousThreads = queryClient.getQueryData<ThreadsResponse>(queryKeys.messageThreads());
      const previousConversation = queryClient.getQueryData<ConversationResponse>(
        queryKeys.messageConversation(username),
      );
      const now = new Date().toISOString();

      queryClient.setQueryData<ThreadsResponse>(queryKeys.messageThreads(), (prev) => {
        if (!prev) return prev;
        const markedThread = prev.threads.find(
          (thread) => thread.counterpart_username === username,
        );
        const clearedCount = markedThread?.unread_count ?? 0;
        return {
          ...prev,
          unread_count: Math.max(0, prev.unread_count - clearedCount),
          threads: prev.threads.map((thread) =>
            thread.counterpart_username === username
              ? { ...thread, unread_count: 0 }
              : thread,
          ),
        };
      });

      queryClient.setQueryData<ConversationResponse>(
        queryKeys.messageConversation(username),
        (prev) => {
          if (!prev?.current_user_id) return prev;
          return {
            ...prev,
            messages: prev.messages.map((message) =>
              message.recipient_id === prev.current_user_id && !message.read_at
                ? { ...message, read_at: now }
                : message,
            ),
          };
        },
      );

      return { previousThreads, previousConversation };
    },
    onError: (_err, username, context) => {
      if (context?.previousThreads) {
        queryClient.setQueryData(queryKeys.messageThreads(), context.previousThreads);
      }
      if (context?.previousConversation) {
        queryClient.setQueryData(
          queryKeys.messageConversation(username),
          context.previousConversation,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messageThreads() });
      queryClient.invalidateQueries({ queryKey: queryKeys.appCounts() });
      window.dispatchEvent(new Event("notifications-updated"));
    },
  });

  useEffect(() => {
    if (!activeUsername || !conversationIsCurrent || !currentUserId) return;
    const hasUnread = messages.some(
      (message) => message.recipient_id === currentUserId && !message.read_at
    );
    if (hasUnread && !markReadMutation.isPending) {
      markReadMutation.mutate(activeUsername);
    }
  }, [
    activeUsername,
    conversationIsCurrent,
    currentUserId,
    markReadMutation,
    messages,
  ]);

  useEffect(() => {
    if (!counterpart || conversationLoading) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversationLoading, counterpart, messages]);

  function selectConversation(username: string) {
    setActiveUsername(username);
    router.replace(`/messages?with=${encodeURIComponent(username)}`);
  }

  function clearConversation() {
    setActiveUsername(null);
    setError(null);
    setPendingAttachments([]);
    router.replace("/messages");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    addFiles(Array.from(files));
    if (fileRef.current) fileRef.current.value = "";
  }

  function addFiles(files: File[]) {
    const remaining = 10 - pendingAttachments.length;
    if (remaining <= 0) return;
    const toAdd = files.slice(0, remaining);

    const newAttachments: PendingAttachment[] = toAdd.map((file) => {
      const preview = isImageMime(file.type, file.name)
        ? URL.createObjectURL(file)
        : undefined;
      return { file, preview, uploading: false };
    });

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  }

  function removeAttachment(index: number) {
    setPendingAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (imageFiles.length === 0) return;
    e.preventDefault();
    addFiles(imageFiles);
  }

  async function uploadAttachment(pending: PendingAttachment): Promise<MessageAttachmentInput | null> {
    try {
      let fileToUpload = pending.file;
      if (isImageMime(pending.file.type, pending.file.name)) {
        fileToUpload = await compressImage(pending.file);
      }
      const form = new FormData();
      form.append("file", fileToUpload);
      const res = await fetch("/api/upload?bucket=dm-attachments", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      return {
        bucket: data.bucket,
        path: data.path,
        name: data.name ?? pending.file.name,
        type: data.type ?? pending.file.type,
        size: data.size ?? pending.file.size,
      };
    } catch (err) {
      setError((err as Error).message || "Upload failed");
      return null;
    }
  }

  const sendMessageMutation = useMutation({
    mutationFn: async (variables: SendMessageVariables) => {
      let attachments: MessageAttachmentInput[] = [];
      if (variables.pending.length > 0) {
        const results = await Promise.all(
          variables.pending.map(uploadAttachment)
        );
        attachments = results.filter(
          (r): r is MessageAttachmentInput => r !== null
        );
        if (attachments.length !== variables.pending.length) {
          throw new Error("Upload failed");
        }
      }

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUsername: variables.username,
          content: variables.content || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await res.json().catch(() => ({ error: "Failed to send message" }));

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send message");
      }

      return data as DirectMessage;
    },
    onError: (err, variables) => {
      setError((err as Error).message || "Failed to send message");
      setDraft((prev) => prev || variables.content);
      setPendingAttachments((prev) =>
        prev.length > 0
          ? prev
          : variables.pending.map((attachment) => ({
              ...attachment,
              uploading: false,
            })),
      );

      setOptimisticMessages((previous) => ({
        ...previous,
        [variables.username]: (previous[variables.username] ?? []).map((message) =>
          message.id === variables.optimisticId
            ? { ...message, delivery_status: "failed" }
            : message,
        ),
      }));

      if (variables.previousThreads) {
        queryClient.setQueryData(queryKeys.messageThreads(), variables.previousThreads);
      }
    },
    onSuccess: (message, variables) => {
      for (const attachment of variables.pending) {
        if (attachment.preview) URL.revokeObjectURL(attachment.preview);
      }

      setOptimisticMessages((previous) => ({
        ...previous,
        [variables.username]: (previous[variables.username] ?? []).filter(
          (item) => item.id !== variables.optimisticId,
        ),
      }));
      queryClient.setQueryData<ConversationResponse>(
        queryKeys.messageConversation(variables.username),
        (prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, { ...message, delivery_status: "sent" }],
              }
            : prev,
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.messageThreads() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messageConversation(variables.username),
      });
    },
  });

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUsername || !counterpart?.username || !conversationIsCurrent) {
      setError("Choose someone to message first.");
      return;
    }

    const content = draft.trim();
    if (!content && pendingAttachments.length === 0) {
      setError("Write a message or attach a file.");
      return;
    }

    setError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const conversationKey = queryKeys.messageConversation(activeUsername);
    const previousConversation =
      queryClient.getQueryData<ConversationResponse>(conversationKey);
    const previousThreads =
      queryClient.getQueryData<ThreadsResponse>(queryKeys.messageThreads());
    const optimisticMessage: LocalDirectMessage = {
      id: optimisticId,
      sender_id: currentUserId ?? "current-user",
      recipient_id: counterpart.id,
      content: content || null,
      attachments: [],
      read_at: null,
      created_at: createdAt,
      sender: currentUserId
        ? { id: currentUserId, username: null, avatar_url: null, display_name: null }
        : undefined,
      recipient: counterpart,
      delivery_status: "sending",
    };

    setDraft("");
    setPendingAttachments([]);
    setOptimisticMessages((previous) => ({
      ...previous,
      [activeUsername]: [...(previous[activeUsername] ?? []), optimisticMessage],
    }));
    window.setTimeout(() => {
      queryClient.setQueryData<ThreadsResponse>(queryKeys.messageThreads(), (prev) => {
        if (!prev) return prev;
        const hasAttachment = pendingAttachments.length > 0;
        return {
          ...prev,
          threads: prev.threads.map((thread) =>
            thread.counterpart_username === activeUsername
              ? updateThreadAfterSend(thread, content, createdAt, hasAttachment)
              : thread,
          ),
        };
      });
    }, 0);
    sendMessageMutation.mutate({
      username: activeUsername,
      content,
      pending: pendingAttachments,
      optimisticId,
      previousConversation,
      previousThreads,
    });
  }

  return (
    <div
      className={cn(
        "flex flex-1 min-h-0 overflow-hidden",
        isPhone ? "flex-col" : "flex-row",
      )}
    >
      <aside
        data-testid="messages-thread-list"
        className={cn(
          "min-h-0 border-border",
          isPhone
            ? showThreadList
              ? "flex flex-1 flex-col border-b"
              : "hidden"
            : "flex shrink-0 flex-col border-r",
        )}
        style={isPhone ? undefined : { width: "var(--app-messages-inbox-width)" }}
      >
        <div className="border-b border-border px-[var(--app-page-padding-x)] py-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
            {isPhone ? "Messages" : "Inbox"}
          </p>
          <h2 className="mt-1 text-base font-semibold text-balance">
            {isPhone ? "Direct messages" : "Inbox"}
          </h2>
          <p className="mt-1 text-sm text-muted text-pretty">
            Direct messages with people you follow, discover, or build with.
          </p>
        </div>

        <div aria-busy={threadsQuery.isFetching} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {threadsLoading ? (
            <div className="p-[var(--app-page-padding-x)]">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-3"
                  >
                    <div className="size-10 animate-pulse rounded-full bg-subtle" />
                    <div className="min-w-0 flex-1">
                      <div className="h-3 w-24 animate-pulse rounded bg-subtle" />
                      <div className="mt-2 h-3 w-full animate-pulse rounded bg-subtle" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : threads.length === 0 ? (
            <div className="px-[var(--app-page-padding-x)] py-12 text-center">
              <p className="text-sm text-muted text-pretty">
                No messages yet. Open a public profile and start the conversation.
              </p>
              <Link
                href="/search"
                className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline"
              >
                Find people to message
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {threads.map((thread) => {
                const username = thread.counterpart_username;
                if (!username) return null;

                const selected = username === activeUsername;
                return (
                  <button
                    key={thread.last_message_id}
                    type="button"
                    onClick={() => selectConversation(username)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-start gap-3 px-[var(--app-page-padding-x)] py-4 text-left hover:bg-subtle",
                      selected && "bg-subtle/60"
                    )}
                  >
                    <Avatar
                      src={thread.counterpart_avatar_url}
                      alt={thread.counterpart_username ?? ""}
                      size="sm"
                      fallback={
                        thread.counterpart_display_name ??
                        thread.counterpart_username ??
                        "?"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {thread.counterpart_display_name ?? `@${thread.counterpart_username}`}
                          </p>
                          {thread.counterpart_display_name && (
                            <p className="truncate text-xs text-muted">
                              @{thread.counterpart_username}
                            </p>
                          )}
                        </div>
                        <span
                          suppressHydrationWarning
                          className="shrink-0 text-[11px] text-muted"
                        >
                          {timeAgo(thread.last_message_created_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="truncate text-sm text-muted">
                          {threadPreview(thread)}
                        </p>
                        {thread.unread_count > 0 && (
                          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground tabular-nums">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section
        data-testid="messages-thread-panel"
        className={cn(
          "min-h-0 flex-1 flex-col",
          showConversation ? "flex" : "hidden"
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-[var(--app-page-padding-x)] py-4">
          <button
            data-testid="messages-back-button"
            type="button"
            onClick={clearConversation}
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground",
              isPhone ? "inline-flex" : "hidden",
            )}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Inbox
          </button>

          {counterpart ? (
            <Link
              href={`/u/${encodeURIComponent(counterpart.username ?? "")}`}
              className="flex min-w-0 items-center gap-3 hover:opacity-80"
            >
              <Avatar
                src={counterpart.avatar_url}
                alt={counterpart.username ?? ""}
                size="sm"
                fallback={counterpart.display_name ?? counterpart.username ?? "?"}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {counterpart.display_name ?? `@${counterpart.username}`}
                </p>
                {counterpart.display_name && (
                  <p className="truncate text-xs text-muted">
                    @{counterpart.username}
                  </p>
                )}
              </div>
            </Link>
          ) : (
            <div>
              <p className="text-sm font-semibold text-balance">Direct messages</p>
              <p className="text-xs text-muted text-pretty">
                Keep the feed public, move the specifics into DMs.
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {conversationLoading ? (
            <div className="space-y-3 px-[var(--app-page-padding-x)] py-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    index % 2 === 0 ? "bg-subtle" : "ml-auto border border-border"
                  )}
                  style={{ maxWidth: "var(--app-messages-bubble-max-width)" }}
                >
                  <div className="h-3 w-40 animate-pulse rounded bg-subtle" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-subtle" />
                </div>
              ))}
            </div>
          ) : error && !counterpart ? (
            <div
              className="mx-[var(--app-page-padding-x)] mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              aria-live="polite"
            >
              {error}
            </div>
          ) : !counterpart ? (
            <div className="m-auto max-w-sm px-[var(--app-page-padding-x)] text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-subtle">
                <MessageSquare size={20} aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-semibold text-balance">
                Pick a conversation or start one from a profile.
              </p>
              <p className="mt-2 text-sm text-muted text-pretty">
                Straude DMs are built for quick questions, collabs, and follow-up after someone posts a strong session.
              </p>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--app-page-padding-x)] py-4">
                <div className="flex min-h-full flex-col justify-end gap-3">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted text-pretty">
                    No messages yet. Send the first note to @{counterpart.username}.
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === currentUserId;
                    const attachments = message.attachments ?? [];
                    const imageAttachments = attachments.filter((a) => isImageMime(a.type, a.name));
                    const fileAttachments = attachments.filter((a) => !isImageMime(a.type, a.name));

                    return (
                      <div
                        key={message.id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3",
                            mine
                              ? "bg-accent text-accent-foreground"
                              : "border border-border bg-background"
                          )}
                          style={{ maxWidth: "var(--app-messages-bubble-max-width)" }}
                        >
                          {/* Image attachments */}
                          {imageAttachments.length > 0 && (
                            <div className={cn(
                              "flex flex-wrap gap-1.5",
                              message.content && "mb-2"
                            )}>
                              {imageAttachments.map((attachment) => (
                                <button
                                  key={attachment.url}
                                  type="button"
                                  onClick={() => setLightboxImage(attachment.url)}
                                  className="relative block overflow-hidden rounded-lg"
                                  aria-label={`View ${attachment.name}`}
                                >
                                  <Image
                                    src={attachment.url}
                                    alt={attachment.name}
                                    width={96}
                                    height={96}
                                    className="h-[var(--app-messages-attachment-size)] w-[var(--app-messages-attachment-size)] rounded-lg object-cover"
                                    sizes="(max-width: 879px) 80px, 96px"
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* File attachments */}
                          {fileAttachments.length > 0 && (
                            <div className={cn(
                              "space-y-1.5",
                              message.content && "mb-2"
                            )}>
                              {fileAttachments.map((attachment) => (
                                <a
                                  key={attachment.url}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={attachment.name}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                                    mine
                                      ? "bg-white/15 hover:bg-white/25"
                                      : "bg-subtle hover:bg-subtle/80"
                                  )}
                                >
                                  <FileText size={16} className="shrink-0" aria-hidden="true" />
                                  <span className="min-w-0 truncate">{attachment.name}</span>
                                  <span className={cn(
                                    "shrink-0 text-xs",
                                    mine ? "text-white/70" : "text-muted"
                                  )}>
                                    {formatFileSize(attachment.size)}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Text content */}
                          {message.content && (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.content}
                            </p>
                          )}

                          <div
                            className={cn(
                              "mt-2 flex items-center gap-2 text-xs",
                              mine ? "text-white/70" : "text-muted"
                            )}
                          >
                            <span suppressHydrationWarning>
                              {timeAgo(message.created_at)}
                            </span>
                            {mine && message.delivery_status && (
                              <span className="capitalize">
                                {message.delivery_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {error && (
                <div
                  className="mx-[var(--app-page-padding-x)] mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  aria-live="polite"
                >
                  {error}
                </div>
              )}

              <div
                className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-[var(--app-page-padding-x)] pt-4 backdrop-blur-sm"
                style={{ paddingBottom: "calc(var(--app-main-bottom-offset) + 1rem)" }}
              >
                <form onSubmit={handleSendMessage} onPaste={handlePaste}>
                  <label htmlFor="dm-composer" className="mb-2 block text-sm font-medium">
                    Message @{counterpart.username}
                  </label>

                  {pendingAttachments.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="group relative"
                        >
                          {attachment.preview ? (
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={attachment.preview}
                                alt={attachment.file.name}
                                className={cn(
                                  "h-[var(--app-messages-attachment-size)] w-[var(--app-messages-attachment-size)] rounded-lg border border-border object-cover",
                                  attachment.uploading && "opacity-50"
                                )}
                              />
                              {attachment.uploading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Loader2 size={16} className="animate-spin text-accent" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "flex h-[var(--app-messages-attachment-size)] items-center gap-2 rounded-lg border border-border bg-subtle px-3",
                                attachment.uploading && "opacity-50"
                              )}
                            >
                              <FileText size={16} className="shrink-0 text-muted" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="max-w-[120px] truncate text-xs font-medium">
                                  {attachment.file.name}
                                </p>
                                <p className="text-xs text-muted">
                                  {formatFileSize(attachment.file.size)}
                                </p>
                              </div>
                              {attachment.uploading && (
                                <Loader2 size={14} className="animate-spin text-accent" />
                              )}
                            </div>
                          )}
                          {!attachment.uploading && (
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-xs"
                              aria-label={`Remove ${attachment.file.name}`}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea
                    id="dm-composer"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={isPhone ? 3 : 4}
                    maxLength={1000}
                    placeholder="Ask about a build, trade notes, or start a collaboration."
                    aria-describedby="dm-composer-help"
                    className="min-h-0"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif,application/pdf,text/plain,text/markdown,text/csv,application/json,application/zip,.pdf,.txt,.md,.csv,.json,.zip"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-label="Attach files"
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={sendMessageMutation.isPending || pendingAttachments.length >= 10}
                        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-50"
                        aria-label="Attach a file or image"
                      >
                        <Paperclip size={16} />
                      </button>
                      <p
                        id="dm-composer-help"
                        className="text-xs text-muted tabular-nums"
                      >
                        {draft.trim().length > 0
                          ? `${draft.length}/1000`
                          : "\u00A0"}
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={
                        sendMessageMutation.isPending ||
                        !conversationIsCurrent ||
                        (draft.trim().length === 0 && pendingAttachments.length === 0)
                      }
                    >
                      {sendMessageMutation.isPending ? "Sending..." : "Send \u2318\u21B5"}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Image lightbox */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightboxImage(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close preview"
            autoFocus
          >
            <X size={24} />
          </button>
          <div
            className="relative max-h-[85vh] max-w-[90vw]"
            style={{ width: "90vw", height: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightboxImage}
              alt=""
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </div>
        </div>
      )}
    </div>
  );
}
