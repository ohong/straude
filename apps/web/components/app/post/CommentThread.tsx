"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Comment } from "@/types";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          <div key={comment.id} className="flex gap-3 border-b border-dashed border-muted/30 px-6 py-4">
            <Link href={comment.user?.username ? `/u/${comment.user.username}` : "#"}>
              {comment.user?.avatar_url ? (
                <Image src={comment.user.avatar_url} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                  {comment.user?.username?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
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
                  <input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    maxLength={500}
                    className="flex-1 border border-border px-2 py-1 text-sm outline-none focus:border-accent"
                    style={{ borderRadius: 4 }}
                  />
                  <button
                    onClick={() => handleEdit(comment.id)}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="mt-0.5 text-sm">{comment.content}</p>
              )}
              {userId === comment.user_id && editingId !== comment.id && (
                <div className="mt-1 flex gap-3">
                  <button
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditContent(comment.content);
                    }}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
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
        <form onSubmit={handleSubmit} className="flex gap-3 px-6 py-4">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            maxLength={500}
            className="flex-1 border border-border px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            style={{ borderRadius: 4 }}
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ borderRadius: 4 }}
          >
            {submitting ? "..." : "Post"}
          </button>
        </form>
      )}
    </div>
  );
}
