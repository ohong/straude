"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Post } from "@/types";

const STORAGE_KEY = "straude_nudge_dismissed";

function formatDate(dateStr: string) {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight, which shifts
  // back a day in western timezones. Appending T12:00:00 forces local-time parsing.
  const d = dateStr.length === 10 ? new Date(dateStr + "T12:00:00") : new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function primaryModel(models: string[] | undefined): string {
  if (!models?.length) return "Claude";
  // Show first model, cleaned up
  return models[0].replace("claude-", "Claude ").replace(/-\d{8}$/, "");
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function PendingPostsNudge({ posts }: { posts: Post[] }) {
  const [dismissedPostIds, setDismissedPostIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loaded, setLoaded] = useState(false);

  // Load persisted dismissed IDs from localStorage on mount
  useEffect(() => {
    setDismissedPostIds(loadDismissed());
    setLoaded(true);
  }, []);

  const visiblePosts = posts.filter((post) => !dismissedPostIds.has(post.id));

  if (!loaded || visiblePosts.length === 0) return null;

  return (
    <div className="border-b border-border bg-accent/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted">
          You have {visiblePosts.length} session{visiblePosts.length !== 1 ? "s" : ""} without
          details
        </p>
        <button
          type="button"
          onClick={() => {
            setDismissedPostIds((prev) => {
              const next = new Set(prev);
              for (const post of visiblePosts) {
                next.add(post.id);
              }
              saveDismissed(next);
              return next;
            });
          }}
          className="text-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1">
        {visiblePosts.map((post) => (
          <div key={post.id} className="flex items-center rounded hover:bg-subtle transition-colors">
            <Link
              href={`/post/${post.id}?edit=1`}
              className="flex flex-1 items-center justify-between px-2 py-1.5 text-sm min-w-0"
            >
              <div className="flex items-center gap-3 text-muted">
                <span>{formatDate(post.daily_usage?.date ?? post.created_at)}</span>
                <span>{primaryModel(post.daily_usage?.models)}</span>
                {post.daily_usage?.is_verified && post.daily_usage.cost_usd > 0 && (
                  <span>${post.daily_usage.cost_usd.toFixed(2)}</span>
                )}
              </div>
              <span className="text-accent text-xs font-medium">
                Add details &rarr;
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setDismissedPostIds((prev) => {
                  const next = new Set(prev);
                  next.add(post.id);
                  saveDismissed(next);
                  return next;
                });
              }}
              className="shrink-0 p-1.5 text-muted/50 hover:text-foreground transition-colors"
              aria-label={`Dismiss nudge for ${formatDate(post.daily_usage?.date ?? post.created_at)} session`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
