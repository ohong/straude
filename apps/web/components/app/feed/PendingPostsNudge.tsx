"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Post } from "@/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function primaryModel(models: string[] | undefined): string {
  if (!models?.length) return "Claude";
  // Show first model, cleaned up
  return models[0].replace("claude-", "Claude ").replace(/-\d{8}$/, "");
}

export function PendingPostsNudge({ posts }: { posts: Post[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || posts.length === 0) return null;

  return (
    <div className="border-b border-border bg-accent/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted">
          You have {posts.length} session{posts.length !== 1 ? "s" : ""} without
          details
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/post/${post.id}?edit=1`}
            className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-subtle transition-colors"
          >
            <div className="flex items-center gap-3 text-muted">
              <span>{formatDate(post.created_at)}</span>
              <span>{primaryModel(post.daily_usage?.models)}</span>
              {post.daily_usage?.is_verified && post.daily_usage.cost_usd > 0 && (
                <span>${post.daily_usage.cost_usd.toFixed(2)}</span>
              )}
            </div>
            <span className="text-accent text-xs font-medium">
              Add details &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
