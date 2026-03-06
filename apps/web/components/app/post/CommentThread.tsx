"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { mentionsToMarkdownLinks } from "@/lib/utils/mentions";
import type { Comment } from "@/types";
import { MentionInput } from "@/components/app/shared/MentionInput";
import dynamic from "next/dynamic";
import remarkBreaks from "remark-breaks";

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

/** Render comment text as markdown with @mention support. */
function CommentBody({ text }: { text: string }) {
  return (
    <div className="mt-0.5 text-sm [&_p+p]:mt-2 [&_a]:text-accent [&_a]:underline [&_code]:bg-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-[family-name:var(--font-mono)] [&_code]:text-xs [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:border-l-2 [&_pre]:border-l-accent [&_pre]:bg-subtle [&_pre]:p-3 [&_pre]:font-[family-name:var(--font-mono)] [&_pre]:text-xs [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-0.5 [&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-l-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_strong]:font-semibold [&_em]:italic [&_del]:text-muted [&_del]:line-through">
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={[
          "p", "strong", "em", "del", "code", "pre", "a", "br",
          "ul", "ol", "li", "blockquote",
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
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const tempComment: Comment = {
      id: tempId,
      post_id: postId,
      user_id: userId!,
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: currentUser
        ? ({
            username: currentUser.username,
            avatar_url: currentUser.avatar_url,
          } as Comment["user"])
        : undefined,
    };

    const prevContent = content;
    setComments((prev) => [...prev, tempComment]);
    setContent("");

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: prevContent.trim() }),
    });

    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => prev.map((c) => (c.id === tempId ? comment : c)));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setContent(prevContent);
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  }

  async function handleEdit(commentId: string) {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
      );
      setEditingId(null);
      setEditContent("");
    }
  }

  return (
    <div className="border-t border-border">
      {/* Comment list */}
      <div className="flex flex-col">
        {comments.map((comment) => {
          const resolvedUsername =
            comment.user?.username ??
            (comment.user_id === userId ? currentUser?.username ?? null : null);
          const displayUsername =
            resolvedUsername ?? (comment.user_id === userId ? "you" : "anonymous");
          const profileHref = resolvedUsername ? `/u/${resolvedUsername}` : "#";

          return (
            <div key={comment.id} className="flex gap-3 border-b border-dashed border-muted/30 px-4 py-4 sm:px-6">
              <Link href={profileHref}>
                <Avatar
                  src={comment.user?.avatar_url}
                  alt={resolvedUsername ?? displayUsername}
                  size="xs"
                  fallback={resolvedUsername ?? displayUsername}
                />
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={profileHref}
                    className="text-sm font-semibold hover:underline"
                  >
                    {displayUsername}
                  </Link>
                  <span suppressHydrationWarning className="text-xs text-muted">{timeAgo(comment.created_at)}</span>
                </div>
                {editingId === comment.id ? (
                  <div className="mt-1 flex gap-2">
                    <MentionInput
                      value={editContent}
                      onChange={setEditContent}
                      maxLength={500}
                      onSubmit={() => handleEdit(comment.id)}
                    />
                    <button
                      type="button"
                      onClick={() => handleEdit(comment.id)}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-muted hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <CommentBody text={comment.content} />
                )}
                {userId === comment.user_id && editingId !== comment.id && (
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditContent(comment.content);
                      }}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-muted hover:text-error"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment input */}
      {userId && (
        <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
          <MentionInput
            value={content}
            onChange={setContent}
            placeholder="Add a comment, @ to mention"
            maxLength={500}
            onSubmit={handleSubmit}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="shrink-0 bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: 4 }}
          >
            {submitting ? "..." : "Post"}
          </button>
        </div>
      )}
    </div>
  );
}
