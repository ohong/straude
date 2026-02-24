"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { Comment } from "@/types";
import { MentionInput } from "@/components/app/shared/MentionInput";

const MENTION_RE = /(?:^|(?<=\s))@([a-zA-Z0-9_-]{1,39})\b/g;

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

/** Render comment text with @mentions as accent-colored links. */
function MentionText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_RE)) {
    const start = match.index;
    const username = match[1];
    const fullMatch = match[0];

    // Text before the mention (include leading whitespace that's part of the lookbehind)
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    // Leading whitespace within the match (e.g. space before @)
    const prefix = fullMatch.startsWith("@") ? "" : fullMatch[0];
    if (prefix) parts.push(prefix);

    parts.push(
      <Link
        key={`${start}-${username}`}
        href={`/u/${username.toLowerCase()}`}
        className="font-semibold text-accent hover:underline"
      >
        @{username}
      </Link>,
    );
    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <p className="mt-0.5 text-sm">{parts}</p>;
}

export function CommentThread({
  postId,
  initialComments,
  userId,
}: {
  postId: string;
  initialComments: Comment[];
  userId: string | null;
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });

    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setContent("");
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
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
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 border-b border-dashed border-muted/30 px-4 py-4 sm:px-6">
            <Link href={comment.user?.username ? `/u/${comment.user.username}` : "#"}>
              <Avatar src={comment.user?.avatar_url} alt={comment.user?.username ?? ""} size="xs" fallback={comment.user?.username ?? "?"} />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={comment.user?.username ? `/u/${comment.user.username}` : "#"}
                  className="text-sm font-semibold hover:underline"
                >
                  {comment.user?.username ?? "anonymous"}
                </Link>
                <span suppressHydrationWarning className="text-xs text-muted">{timeAgo(comment.created_at)}</span>
              </div>
              {editingId === comment.id ? (
                <div className="mt-1 flex gap-2">
                  <MentionInput
                    value={editContent}
                    onChange={setEditContent}
                    maxLength={500}
                    className="flex-1 border border-border px-2 py-1 text-sm outline-none focus:border-accent"
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
                <MentionText text={comment.content} />
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
        ))}
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
