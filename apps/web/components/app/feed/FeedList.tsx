"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ActivityCard } from "./ActivityCard";
import type { Post } from "@/types";

export function FeedList({
  initialPosts,
  userId,
}: {
  initialPosts: Post[];
  userId: string;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(
    initialPosts.length >= 20
      ? initialPosts[initialPosts.length - 1].created_at
      : null
  );
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);

    const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}&limit=20`);
    const data = await res.json();

    if (data.posts?.length) {
      setPosts((prev) => [...prev, ...data.posts]);
      setCursor(data.next_cursor ?? null);
    } else {
      setCursor(null);
    }
    setLoading(false);
  }, [cursor, loading]);

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

  return (
    <div>
      {posts.map((post) => (
        <ActivityCard key={post.id} post={post} />
      ))}
      {cursor && (
        <div ref={sentinel} className="flex justify-center py-8">
          {loading && <span className="text-sm text-muted">Loading...</span>}
        </div>
      )}
    </div>
  );
}
