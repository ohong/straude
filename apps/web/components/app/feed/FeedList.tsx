"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Check } from "lucide-react";
import { ActivityCard } from "./ActivityCard";
import { PendingPostsNudge } from "./PendingPostsNudge";
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
    <div className="hidden items-center gap-2.5 sm:flex">
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

type FeedType = "global" | "following" | "mine" | "user";

const TAB_LABELS: Partial<Record<FeedType, string>> = {
  global: "Global",
  following: "Following",
  mine: "My Sessions",
};

export function FeedList({
  initialPosts,
  userId,
  feedType: initialFeedType = "global",
  showTabs = true,
  pendingPosts = [],
  profileUserId,
}: {
  initialPosts: Post[];
  userId: string | null;
  feedType?: FeedType;
  showTabs?: boolean;
  pendingPosts?: Post[];
  /** When viewing another user's profile, pass their ID so pagination fetches their posts. */
  profileUserId?: string;
}) {
  const router = useRouter();
  const [feedType, setFeedType] = useState<FeedType>(initialFeedType);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [pending, setPending] = useState<Post[]>(pendingPosts);
  const [cursor, setCursor] = useState<string | null>(() => {
    if (initialPosts.length < 20) return null;
    const last = initialPosts[initialPosts.length - 1];
    const date = last.daily_usage?.date;
    return date ? `${date}|${last.created_at}` : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const cursorRef = useRef(cursor);
  const loadingRef = useRef(false);
  const feedTypeRef = useRef(feedType);
  const sentinel = useRef<HTMLDivElement>(null);

  cursorRef.current = cursor;
  feedTypeRef.current = feedType;

  // Restore scroll position on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("straude_feed_scroll");
    if (saved) {
      const main = document.querySelector("main");
      if (main) main.scrollTop = Number(saved);
    }
  }, []);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let timer: ReturnType<typeof setTimeout>;
    function handleScroll() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.setItem("straude_feed_scroll", String(main!.scrollTop));
      }, 200);
    }
    main.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timer);
      main.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const feedUrl = new URL("/api/feed", window.location.origin);
      feedUrl.searchParams.set("type", feedTypeRef.current);
      feedUrl.searchParams.set("cursor", cursorRef.current);
      feedUrl.searchParams.set("limit", "20");
      if (profileUserId) feedUrl.searchParams.set("user_id", profileUserId);
      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error("Failed to load posts");
      const data = await res.json();

      if (data.posts?.length) {
        setPosts((prev) => [...prev, ...data.posts]);
        setCursor(data.next_cursor ?? null);
      } else {
        setCursor(null);
      }
    } catch {
      setError("Couldn\u2019t load more posts.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [profileUserId]);

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
      setError(null);

      // Update URL without full page reload
      const url = newType === "global" ? "/feed" : `/feed?tab=${newType}`;
      router.replace(url);

      try {
        const res = await fetch(`/api/feed?type=${newType}&limit=20`);
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();

        setPosts(data.posts ?? []);
        setCursor(data.next_cursor ?? null);
        setPending(data.pending_posts ?? []);
      } catch {
        setError("Couldn\u2019t load feed. Please try again.");
      } finally {
        setSwitching(false);
      }
    },
    [feedType, router]
  );

  return (
    <div>
      {/* Sync command + feed type dropdown in one row (logged-in only) */}
      {userId && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-[var(--app-page-padding-x)] py-3">
          <SyncCommandHint />

          {showTabs && (
            <div ref={dropdownRef} className="relative ml-auto">
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
      )}

      {pending.length > 0 && <PendingPostsNudge posts={pending} />}

      {switching ? (
        <div className="flex justify-center py-12" role="status">
          <span className="text-sm text-muted">Loading&hellip;</span>
        </div>
      ) : error && posts.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-2 px-6 py-20 text-center">
          <p className="text-sm text-error">{error}</p>
          <button
            type="button"
            onClick={() => { setError(null); switchTab(feedType); }}
            className="text-sm font-medium text-accent hover:underline"
          >
            Retry
          </button>
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
            <ActivityCard key={post.id} post={post} userId={userId} />
          ))}
          {error && (
            <div role="alert" className="flex flex-col items-center gap-2 py-8">
              <p className="text-sm text-error">{error}</p>
              <button
                type="button"
                onClick={() => { setError(null); loadMore(); }}
                className="text-sm font-medium text-accent hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          {cursor && !error && (
            <div ref={sentinel} className="flex justify-center py-8" role="status" aria-live="polite">
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
