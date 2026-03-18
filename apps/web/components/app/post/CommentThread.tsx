"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertDialog } from "@base-ui-components/react/alert-dialog";
import { ChevronDown, ChevronRight, Heart, Reply } from "lucide-react";
import remarkBreaks from "remark-breaks";
import { Avatar } from "@/components/ui/Avatar";
import { MentionInput } from "@/components/app/shared/MentionInput";
import { buildCommentTree } from "@/lib/comments";
import { cn } from "@/lib/utils/cn";
import { mentionsToMarkdownLinks } from "@/lib/utils/mentions";
import type { Comment } from "@/types";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => null,
});

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function getThreadParentId(comment: Comment) {
  return comment.parent_comment_id ?? comment.id;
}

/** Render comment text as markdown with @mention support. */
function CommentBody({ text }: { text: string }) {
  return (
    <div className="mt-0.5 text-pretty text-sm [&_p+p]:mt-2 [&_a]:text-accent [&_a]:underline [&_code]:bg-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-[family-name:var(--font-mono)] [&_code]:text-xs [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:border-l-2 [&_pre]:border-l-accent [&_pre]:bg-subtle [&_pre]:p-3 [&_pre]:font-[family-name:var(--font-mono)] [&_pre]:text-xs [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-0.5 [&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-l-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_strong]:font-semibold [&_em]:italic [&_del]:text-muted [&_del]:line-through">
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={[
          "p",
          "strong",
          "em",
          "del",
          "code",
          "pre",
          "a",
          "br",
          "ul",
          "ol",
          "li",
          "blockquote",
        ]}
        unwrapDisallowed
      >
        {mentionsToMarkdownLinks(text)}
      </ReactMarkdown>
    </div>
  );
}

export function CommentThread({
  postId,
  initialComments,
  userId,
  currentUser,
}: {
  postId: string;
  initialComments: Comment[];
  userId: string | null;
  currentUser?: { username: string; avatar_url: string | null };
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    parentId: string;
    username: string | null;
  } | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingReactionIds, setPendingReactionIds] = useState<string[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [visibleRootCount, setVisibleRootCount] = useState(20);

  const threadedComments = buildCommentTree(comments);

  function setReactionPending(commentId: string, pending: boolean) {
    setPendingReactionIds((prev) => {
      if (pending) {
        return prev.includes(commentId) ? prev : [...prev, commentId];
      }
      return prev.filter((id) => id !== commentId);
    });
  }

  async function submitComment(opts: {
    draft: string;
    parentCommentId?: string | null;
    setDraft: (value: string) => void;
    setSubmittingState: (value: boolean) => void;
    setError: (value: string | null) => void;
    onSuccess?: () => void;
  }) {
    if (!userId) return;

    const trimmed = opts.draft.trim();
    if (!trimmed) return;

    opts.setSubmittingState(true);
    opts.setError(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId,
      post_id: postId,
      user_id: userId,
      parent_comment_id: opts.parentCommentId ?? null,
      content: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reaction_count: 0,
      has_reacted: false,
      reply_count: 0,
      user: currentUser
        ? ({
            username: currentUser.username,
            avatar_url: currentUser.avatar_url,
          } as Comment["user"])
        : undefined,
    };

    setComments((prev) => [...prev, optimisticComment]);
    opts.setDraft("");

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: trimmed,
        parent_comment_id: opts.parentCommentId ?? null,
      }),
    });

    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => prev.map((current) => (current.id === tempId ? comment : current)));
      opts.onSuccess?.();
    } else {
      setComments((prev) => prev.filter((comment) => comment.id !== tempId));
      opts.setDraft(trimmed);
      opts.setError(await readErrorMessage(res, "Couldn't post comment."));
    }

    opts.setSubmittingState(false);
  }

  async function handleRootSubmit() {
    if (submitting) return;
    await submitComment({
      draft: content,
      setDraft: setContent,
      setSubmittingState: setSubmitting,
      setError: setComposerError,
    });
  }

  async function handleReplySubmit() {
    if (!replyingTo || replySubmitting) return;
    await submitComment({
      draft: replyContent,
      parentCommentId: replyingTo.parentId,
      setDraft: setReplyContent,
      setSubmittingState: setReplySubmitting,
      setError: setReplyError,
      onSuccess: () => {
        setReplyingTo(null);
        setReplyContent("");
      },
    });
  }

  function beginReply(comment: Comment) {
    if (!userId) return;

    if (replyingTo?.commentId === comment.id) {
      setReplyingTo(null);
      setReplyContent("");
      setReplyError(null);
      return;
    }

    const username = comment.user?.username ?? null;
    const initialValue =
      username && comment.user_id !== userId ? `@${username} ` : "";

    setEditingId(null);
    setEditContent("");
    setEditError(null);
    setReplyingTo({
      commentId: comment.id,
      parentId: getThreadParentId(comment),
      username,
    });
    setReplyContent(initialValue);
    setReplyError(null);
  }

  function beginEdit(comment: Comment) {
    if (editingId === comment.id) {
      setEditingId(null);
      setEditContent("");
      setEditError(null);
      return;
    }

    setReplyingTo(null);
    setReplyContent("");
    setReplyError(null);
    setEditingId(comment.id);
    setEditContent(comment.content);
    setEditError(null);
  }

  async function handleEdit(commentId: string) {
    if (savingEdit) return;

    const trimmed = editContent.trim();
    if (!trimmed) return;

    setSavingEdit(true);
    setEditError(null);

    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? { ...comment, ...updated } : comment))
      );
      setEditingId(null);
      setEditContent("");
    } else {
      setEditError(await readErrorMessage(res, "Couldn't save comment."));
    }

    setSavingEdit(false);
  }

  async function handleDelete(comment: Comment) {
    setDeletingId(comment.id);
    setDeleteError(null);

    const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });

    if (res.ok) {
      setComments((prev) =>
        prev.filter(
          (current) =>
            current.id !== comment.id && current.parent_comment_id !== comment.id,
        )
      );
      if (replyingTo && (replyingTo.commentId === comment.id || replyingTo.parentId === comment.id)) {
        setReplyingTo(null);
        setReplyContent("");
        setReplyError(null);
      }
      if (editingId === comment.id) {
        setEditingId(null);
        setEditContent("");
        setEditError(null);
      }
      setDeleteTargetId(null);
    } else {
      setDeleteError(await readErrorMessage(res, "Couldn't delete comment."));
    }

    setDeletingId(null);
  }

  async function toggleReaction(comment: Comment) {
    if (!userId || pendingReactionIds.includes(comment.id)) return;

    const nextReacted = !comment.has_reacted;
    const previousCount = comment.reaction_count ?? 0;

    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[comment.id];
      return next;
    });
    setReactionPending(comment.id, true);
    setComments((prev) =>
      prev.map((current) =>
        current.id === comment.id
          ? {
              ...current,
              has_reacted: nextReacted,
              reaction_count: Math.max(0, previousCount + (nextReacted ? 1 : -1)),
            }
          : current
      )
    );

    const res = await fetch(`/api/comments/${comment.id}/reactions`, {
      method: nextReacted ? "POST" : "DELETE",
    });

    if (res.ok) {
      const data = await res.json();
      setComments((prev) =>
        prev.map((current) =>
          current.id === comment.id
            ? {
                ...current,
                has_reacted: data.reacted,
                reaction_count: data.count,
              }
            : current
        )
      );
    } else {
      const errorMessage = await readErrorMessage(res, "Couldn't update reaction.");
      setComments((prev) =>
        prev.map((current) =>
          current.id === comment.id
            ? {
                ...current,
                has_reacted: !nextReacted,
                reaction_count: previousCount,
              }
            : current
        )
      );
      setActionErrors((prev) => ({
        ...prev,
        [comment.id]: errorMessage,
      }));
    }

    setReactionPending(comment.id, false);
  }

  function renderComposer(opts: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onCancel?: () => void;
    placeholder: string;
    submitLabel: string;
    submitting: boolean;
    error: string | null;
    helperText: string;
  }) {
    const errorId = `${opts.id}-error`;
    const helperId = `${opts.id}-helper`;
    const describedBy = opts.error ? `${helperId} ${errorId}` : helperId;

    return (
      <div className="rounded-md border border-border bg-background p-3">
        <div className="flex items-start gap-3">
          <MentionInput
            id={`${opts.id}-input`}
            value={opts.value}
            onChange={opts.onChange}
            placeholder={opts.placeholder}
            maxLength={500}
            onSubmit={opts.onSubmit}
            ariaDescribedBy={describedBy}
            ariaInvalid={!!opts.error}
          />
          <button
            type="button"
            onClick={opts.onSubmit}
            disabled={!opts.value.trim() || opts.submitting}
            className="shrink-0 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {opts.submitting ? `${opts.submitLabel}...` : opts.submitLabel}
          </button>
        </div>
        {(opts.helperText || opts.onCancel) && (
          <div className="mt-2 flex items-center justify-between gap-3">
            {opts.helperText ? (
              <p id={helperId} className="text-xs text-muted">
                {opts.helperText}
              </p>
            ) : <span />}
            {opts.onCancel && (
              <button
                type="button"
                onClick={opts.onCancel}
                className="text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
        )}
        {opts.error && (
          <p
            id={errorId}
            role="status"
            aria-live="polite"
            className="mt-2 text-xs text-error"
          >
            {opts.error}
          </p>
        )}
      </div>
    );
  }

  function renderComment(comment: Comment, depth = 0): ReactNode {
    const resolvedUsername =
      comment.user?.username ??
      (comment.user_id === userId ? currentUser?.username ?? null : null);
    const displayUsername =
      resolvedUsername ?? (comment.user_id === userId ? "you" : "anonymous");
    const profileHref = resolvedUsername ? `/u/${resolvedUsername}` : "#";
    const replyBoxId = `reply-box-${comment.id}`;
    const isReplyBoxOpen = replyingTo?.commentId === comment.id;
    const isEditing = editingId === comment.id;
    const isReactionPending = pendingReactionIds.includes(comment.id);
    const isOwner = userId === comment.user_id;

    return (
      <li
        key={comment.id}
        className={cn(
          depth === 0 && "border-b border-dashed border-muted/30 px-4 py-4 sm:px-6",
          depth > 0 && "pt-3",
        )}
      >
        <article className="flex gap-3">
          <Link href={profileHref} className="shrink-0">
            <Avatar
              src={comment.user?.avatar_url}
              alt={resolvedUsername ?? displayUsername}
              size="xs"
              fallback={resolvedUsername ?? displayUsername}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={profileHref}
                className="truncate text-sm font-semibold hover:underline"
              >
                {displayUsername}
              </Link>
              <span
                suppressHydrationWarning
                className="text-xs tabular-nums text-muted"
              >
                {timeAgo(comment.created_at)}
              </span>
            </div>

            {isEditing ? (
              <div className="mt-3">
                {renderComposer({
                  id: `edit-${comment.id}`,
                  value: editContent,
                  onChange: setEditContent,
                  onSubmit: () => handleEdit(comment.id),
                  onCancel: () => {
                    setEditingId(null);
                    setEditContent("");
                    setEditError(null);
                  },
                  placeholder: "Edit comment",
                  submitLabel: "Save",
                  submitting: savingEdit,
                  error: editError,
                  helperText: "",
                })}
              </div>
            ) : (
              <CommentBody text={comment.content} />
            )}

            {!isEditing && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => beginReply(comment)}
                    aria-expanded={isReplyBoxOpen}
                    aria-controls={replyBoxId}
                    className="inline-flex items-center gap-1.5 text-muted hover:text-foreground"
                  >
                    <Reply size={13} aria-hidden="true" />
                    Reply
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleReaction(comment)}
                    aria-label={
                      comment.has_reacted
                        ? "Unlike comment"
                        : "Like comment"
                    }
                    aria-pressed={comment.has_reacted}
                    disabled={!userId || isReactionPending}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60",
                      comment.has_reacted && "text-accent",
                    )}
                  >
                    <Heart
                      size={13}
                      fill={comment.has_reacted ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                    <span className="tabular-nums">
                      {comment.reaction_count ? comment.reaction_count : "Like"}
                    </span>
                  </button>

                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => beginEdit(comment)}
                        className="text-muted hover:text-foreground"
                      >
                        Edit
                      </button>

                      <AlertDialog.Root
                        open={deleteTargetId === comment.id}
                        onOpenChange={(open) => {
                          setDeleteTargetId(open ? comment.id : null);
                          if (!open) setDeleteError(null);
                        }}
                      >
                        <AlertDialog.Trigger className="text-muted hover:text-error">
                          Delete
                        </AlertDialog.Trigger>
                        <AlertDialog.Portal>
                          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
                          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-background p-4 shadow-xl">
                            <AlertDialog.Title className="text-base font-semibold text-balance">
                              Delete comment?
                            </AlertDialog.Title>
                            <AlertDialog.Description className="mt-2 text-sm text-pretty text-muted">
                              {comment.reply_count
                                ? "This comment and its replies will be removed."
                                : "This action cannot be undone."}
                            </AlertDialog.Description>
                            {deleteError && deleteTargetId === comment.id && (
                              <p
                                role="status"
                                aria-live="polite"
                                className="mt-3 text-xs text-error"
                              >
                                {deleteError}
                              </p>
                            )}
                            <div className="mt-4 flex justify-end gap-2">
                              <AlertDialog.Close className="rounded-sm border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-subtle">
                                Cancel
                              </AlertDialog.Close>
                              <button
                                type="button"
                                onClick={() => handleDelete(comment)}
                                disabled={deletingId === comment.id}
                                className="rounded-sm bg-error px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingId === comment.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </AlertDialog.Popup>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                    </>
                  )}
                </div>

                {actionErrors[comment.id] && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-2 text-xs text-error"
                  >
                    {actionErrors[comment.id]}
                  </p>
                )}
              </>
            )}

            {isReplyBoxOpen && (
              <div id={replyBoxId} className="mt-3">
                {renderComposer({
                  id: `reply-${comment.id}`,
                  value: replyContent,
                  onChange: setReplyContent,
                  onSubmit: handleReplySubmit,
                  onCancel: () => {
                    setReplyingTo(null);
                    setReplyContent("");
                    setReplyError(null);
                  },
                  placeholder:
                    replyingTo?.username != null
                      ? `Reply to @${replyingTo.username}`
                      : "Reply to this thread",
                  submitLabel: "Reply",
                  submitting: replySubmitting,
                  error: replyError,
                  helperText: "",
                })}
              </div>
            )}

            {comment.replies && comment.replies.length > 0 && (() => {
              const isCollapsed = collapsedThreads.has(comment.id);
              const count = comment.replies.length;
              return (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedThreads((prev) => {
                        const next = new Set(prev);
                        if (next.has(comment.id)) next.delete(comment.id);
                        else next.add(comment.id);
                        return next;
                      })
                    }
                    aria-expanded={!isCollapsed}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={14} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={14} aria-hidden="true" />
                    )}
                    {count} {count === 1 ? "reply" : "replies"}
                  </button>
                  {!isCollapsed && (
                    <ol className="mt-1 border-l border-border pl-4">
                      {comment.replies.map((reply) => renderComment(reply, depth + 1))}
                    </ol>
                  )}
                </>
              );
            })()}
          </div>
        </article>
      </li>
    );
  }

  return (
    <section className="border-t border-border" aria-label="Comments">
      {threadedComments.length === 0 && (
        <div className="px-4 py-5 text-sm text-muted sm:px-6">
          {userId ? "No comments yet. Start the conversation." : "No comments yet."}
        </div>
      )}

      {threadedComments.length > 0 && (
        <>
          <ol className="flex flex-col">
            {threadedComments.slice(0, visibleRootCount).map((comment) => renderComment(comment))}
          </ol>
          {threadedComments.length > visibleRootCount && (
            <div className="border-b border-dashed border-muted/30 px-4 py-4 text-center sm:px-6">
              <button
                type="button"
                onClick={() => setVisibleRootCount((prev) => prev + 20)}
                className="text-sm font-medium text-accent hover:underline"
              >
                Load more comments ({threadedComments.length - visibleRootCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {userId && !replyingTo && (
        <div className="border-t border-border px-4 py-4 sm:px-6">
          {renderComposer({
            id: "new-comment",
            value: content,
            onChange: setContent,
            onSubmit: handleRootSubmit,
            placeholder: "Add a comment, @ to mention",
            submitLabel: "Post",
            submitting,
            error: composerError,
            helperText: "",
          })}
        </div>
      )}
    </section>
  );
}
