"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Check } from "lucide-react";
import { ActivityCard } from "./ActivityCard";
import { cn } from "@/lib/utils/cn";
import type { Post } from "@/types";

const SYNC_COMMAND = "npx straude@latest";

function SyncCommandHint() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(SYNC_COMMAND).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-muted whitespace-nowrap">
        Sync your Claude sessions:
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 rounded border border-border bg-background px-3 py-1 font-mono text-xs text-foreground hover:border-accent hover:text-accent transition-colors"
        aria-label="Copy sync command"
      >
        <span>{SYNC_COMMAND}</span>
        {copied ? (
          <Check size={12} className="text-accent" aria-hidden="true" />
        ) : (
          <Copy size={12} className="text-muted" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

type FeedType = "global" | "following" | "mine";

const TAB_LABELS: Record<FeedType, string> = {
  global: "Global",
  following: "Following",
  mine: "My Sessions",
};

export function FeedList({
  initialPosts,
  userId,
  feedType: initialFeedType = "global",
  showTabs = true,
}: {
  initialPosts: Post[];
  userId: string;
  feedType?: FeedType;
  showTabs?: boolean;
}) {
  const router = useRouter();
  const [feedType, setFeedType] = useState<FeedType>(initialFeedType);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(
    initialPosts.length >= 20
      ? initialPosts[initialPosts.length - 1].created_at
      : null
  );
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const cursorRef = useRef(cursor);
  const loadingRef = useRef(false);
  const feedTypeRef = useRef(feedType);
  const sentinel = useRef<HTMLDivElement>(null);

  cursorRef.current = cursor;
  feedTypeRef.current = feedType;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const res = await fetch(
      `/api/feed?type=${feedTypeRef.current}&cursor=${encodeURIComponent(cursorRef.current)}&limit=20`
    );
    const data = await res.json();

    if (data.posts?.length) {
      setPosts((prev) => [...prev, ...data.posts]);
      setCursor(data.next_cursor ?? null);
    } else {
      setCursor(null);
    }
    loadingRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const switchTab = useCallback(
    async (newType: FeedType) => {
      if (newType === feedType) return;
      setFeedType(newType);
      setSwitching(true);
      setPosts([]);
      setCursor(null);

      // Update URL without full page reload
      const url = newType === "global" ? "/feed" : `/feed?tab=${newType}`;
      router.replace(url);

      const res = await fetch(`/api/feed?type=${newType}&limit=20`);
      const data = await res.json();

      setPosts(data.posts ?? []);
      setCursor(data.next_cursor ?? null);
      setSwitching(false);
    },
    [feedType, router]
  );

  return (
    <div>
      {/* Sync command + feed type dropdown in one row */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <SyncCommandHint />

        {showTabs && (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
              aria-expanded={dropdownOpen}
            >
              {TAB_LABELS[feedType]}
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 rounded border border-border bg-background shadow-lg z-10">
                {(Object.keys(TAB_LABELS) as FeedType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      switchTab(type);
                    }}
                    className={cn(
                      "flex w-full items-center px-4 py-2.5 text-sm hover:bg-subtle",
                      feedType === type ? "font-semibold text-foreground" : "text-muted",
                    )}
                  >
                    {TAB_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {switching ? (
        <div className="flex justify-center py-12">
          <span className="text-sm text-muted">Loading&hellip;</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <p className="text-lg font-medium">
            {feedType === "following"
              ? "No posts from people you follow yet"
              : feedType === "mine"
                ? "You haven\u2019t posted any sessions yet"
                : "No posts yet"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {feedType === "following"
              ? "Follow some builders to see their posts here."
              : feedType === "mine"
                ? "Sync your Claude usage to share your first session."
                : "Check back soon."}
          </p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <ActivityCard key={post.id} post={post} />
          ))}
          {cursor && (
            <div ref={sentinel} className="flex justify-center py-8">
              {loading && (
                <span className="text-sm text-muted">Loading&hellip;</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
