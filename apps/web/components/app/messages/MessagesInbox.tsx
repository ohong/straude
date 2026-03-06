"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/format";
import type { DirectMessage, DirectMessageThread } from "@/types";

interface ConversationUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
}

export function MessagesInbox({
  initialUsername,
}: {
  initialUsername: string | null;
}) {
  const router = useRouter();
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [activeUsername, setActiveUsername] = useState(initialUsername);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [counterpart, setCounterpart] = useState<ConversationUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);
    const res = await fetch("/api/messages/threads", { cache: "no-store" });
    if (!res.ok) {
      setThreadsLoading(false);
      return;
    }

    const data = await res.json();
    setThreads(data.threads ?? []);
    setThreadsLoading(false);
  }, []);

  const fetchConversation = useCallback(
    async (username: string) => {
      setConversationLoading(true);
      setError(null);

      const res = await fetch(
        `/api/messages?with=${encodeURIComponent(username)}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to load conversation" }));
        setCounterpart(null);
        setMessages([]);
        setConversationLoading(false);
        setError(data.error ?? "Failed to load conversation");
        return;
      }

      const data = await res.json();
      setCounterpart(data.counterpart ?? null);
      setMessages(data.messages ?? []);
      setCurrentUserId(data.current_user_id ?? null);
      setConversationLoading(false);

      const hasUnread = (data.messages ?? []).some(
        (message: DirectMessage) =>
          message.recipient_id === data.current_user_id && !message.read_at
      );

      if (hasUnread) {
        await fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ with: username }),
        });
        window.dispatchEvent(new Event("notifications-updated"));
        window.dispatchEvent(new Event("messages-updated"));
        fetchThreads();
      }
    },
    [fetchThreads]
  );

  useEffect(() => {
    fetchThreads();
    function handleRefresh() {
      fetchThreads();
    }
    window.addEventListener("messages-updated", handleRefresh);
    return () => window.removeEventListener("messages-updated", handleRefresh);
  }, [fetchThreads]);

  useEffect(() => {
    if (threadsLoading) return;
    if (!activeUsername && threads[0]?.counterpart_username) {
      const username = threads[0].counterpart_username;
      setActiveUsername(username);
      router.replace(`/messages?with=${encodeURIComponent(username)}`);
    }
  }, [activeUsername, router, threads, threadsLoading]);

  useEffect(() => {
    if (!activeUsername) {
      setCounterpart(null);
      setMessages([]);
      setError(null);
      return;
    }

    fetchConversation(activeUsername);
  }, [activeUsername, fetchConversation]);

  function selectConversation(username: string) {
    setActiveUsername(username);
    router.replace(`/messages?with=${encodeURIComponent(username)}`);
  }

  function clearConversation() {
    setActiveUsername(null);
    setCounterpart(null);
    setMessages([]);
    setError(null);
    router.replace("/messages");
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!counterpart?.username) {
      setError("Choose someone to message first.");
      return;
    }

    const content = draft.trim();
    if (!content) {
      setError("Write a message before sending.");
      return;
    }

    setSending(true);
    setError(null);

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientUsername: counterpart.username,
        content,
      }),
    });

    const data = await res.json().catch(() => ({ error: "Failed to send message" }));

    if (!res.ok) {
      setSending(false);
      setError(data.error ?? "Failed to send message");
      return;
    }

    setMessages((prev) => [...prev, data]);
    setDraft("");
    setSending(false);
    fetchThreads();
    window.dispatchEvent(new Event("messages-updated"));
  }

  const showThreadList = !activeUsername;

  return (
    <div className="flex min-h-[70vh] flex-col md:flex-row">
      <aside
        className={cn(
          "border-b border-border md:block md:w-80 md:shrink-0 md:border-b-0 md:border-r",
          showThreadList ? "block" : "hidden"
        )}
      >
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-balance">Inbox</h2>
          <p className="mt-1 text-sm text-muted text-pretty">
            Direct messages with people you follow, discover, or build with.
          </p>
        </div>

        <div aria-busy={threadsLoading}>
          {threadsLoading ? (
            <div className="p-4 sm:p-6">
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
            <div className="px-4 py-12 text-center sm:px-6">
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
                      "flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-subtle sm:px-6",
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
                          className="shrink-0 text-xs text-muted"
                        >
                          {timeAgo(thread.last_message_created_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="truncate text-sm text-muted">
                          {thread.last_message_is_from_me ? "You: " : ""}
                          {thread.last_message_content}
                        </p>
                        {thread.unread_count > 0 && (
                          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
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
        className={cn(
          "flex min-h-[70vh] flex-1 flex-col",
          activeUsername ? "flex" : "hidden md:flex"
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={clearConversation}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground md:hidden"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Inbox
          </button>

          {counterpart ? (
            <div className="flex min-w-0 items-center gap-3">
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
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-balance">Direct messages</p>
              <p className="text-xs text-muted text-pretty">
                Keep the feed public, move the specifics into DMs.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col px-4 py-4 sm:px-6">
          {conversationLoading ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    index % 2 === 0 ? "bg-subtle" : "ml-auto border border-border"
                  )}
                >
                  <div className="h-3 w-40 animate-pulse rounded bg-subtle" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-subtle" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              aria-live="polite"
            >
              {error}
            </div>
          ) : !counterpart ? (
            <div className="m-auto max-w-sm text-center">
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
              <div className="flex-1 space-y-3 overflow-y-auto pb-4">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted text-pretty">
                    No messages yet. Send the first note to @{counterpart.username}.
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]",
                            mine
                              ? "bg-accent text-white"
                              : "border border-border bg-background"
                          )}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.content}
                          </p>
                          <p
                            suppressHydrationWarning
                            className={cn(
                              "mt-2 text-xs",
                              mine ? "text-white/70" : "text-muted"
                            )}
                          >
                            {timeAgo(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="border-t border-border pt-4"
              >
                <label htmlFor="dm-composer" className="mb-2 block text-sm font-medium">
                  Message @{counterpart.username}
                </label>
                <Textarea
                  id="dm-composer"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Ask about a build, trade notes, or start a collaboration."
                  aria-describedby="dm-composer-help"
                  className="min-h-0"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p
                    id="dm-composer-help"
                    className="text-xs text-muted tabular-nums"
                  >
                    {draft.trim().length === 0
                      ? "Type a message to send."
                      : `${draft.length}/1000 characters`}
                  </p>
                  <Button
                    type="submit"
                    disabled={sending || draft.trim().length === 0}
                  >
                    {sending ? "Sending..." : "Send message"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
