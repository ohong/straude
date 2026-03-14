"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";
import { timeAgo, notificationMessage, notificationHref } from "@/lib/utils/notifications";
import { NOTIFICATION_TYPES } from "@/lib/events";
import type { Notification } from "@/types";

const NOTIFICATION_TYPE_FILTERS = [
  { value: null, label: "All" },
  { value: NOTIFICATION_TYPES.FOLLOW, label: "Follows" },
  { value: NOTIFICATION_TYPES.KUDOS, label: "Kudos" },
  { value: NOTIFICATION_TYPES.COMMENT, label: "Comments" },
  { value: NOTIFICATION_TYPES.MENTION, label: "Mentions" },
  { value: NOTIFICATION_TYPES.MESSAGE, label: "Messages" },
  { value: NOTIFICATION_TYPES.REFERRAL, label: "Referrals" },
] as const;

const PAGE_SIZE = 20;

export function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const notificationsLengthRef = useRef(0);

  const fetchNotifications = useCallback(
    async (offset: number, type: string | null, replace: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (replace) setLoading(true);

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (type) params.set("type", type);

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) {
        loadingRef.current = false;
        setLoading(false);
        return;
      }

      const data = await res.json();
      const fetched: Notification[] = data.notifications ?? [];

      setNotifications((prev) => (replace ? fetched : [...prev, ...fetched]));
      setUnreadCount(data.unread_count ?? 0);
      setHasMore(fetched.length >= PAGE_SIZE);
      setLoading(false);
      loadingRef.current = false;
    },
    [],
  );

  // Initial load and filter change
  useEffect(() => {
    setNotifications([]);
    setHasMore(true);
    fetchNotifications(0, typeFilter, true);
  }, [typeFilter, fetchNotifications]);

  // Keep length ref in sync so the observer can read it without being in deps
  useEffect(() => {
    notificationsLengthRef.current = notifications.length;
  }, [notifications.length]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current && hasMore) {
          fetchNotifications(notificationsLengthRef.current, typeFilter, false);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [typeFilter, hasMore, fetchNotifications]);

  async function handleMarkAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    window.dispatchEvent(new Event("notifications-updated"));
  }

  function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    window.dispatchEvent(new Event("notifications-updated"));
  }

  return (
    <div>
      {/* Type filter tabs — matches leaderboard period tabs */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex flex-1 justify-center overflow-x-auto">
          {NOTIFICATION_TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={cn(
                "shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted sm:px-5",
                typeFilter === value && "border-b-accent text-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="shrink-0 px-4 text-xs text-muted hover:text-foreground sm:px-6"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list — matches search result items */}
      {loading && notifications.length === 0 ? (
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-4 sm:px-6">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-subtle" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm leading-snug">
                  <span className="inline-block h-3.5 w-3/4 animate-pulse rounded bg-subtle" />
                </p>
                <p className="mt-0.5 text-xs">
                  <span className="inline-block h-2.5 w-16 animate-pulse rounded bg-subtle" />
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">
          {typeFilter
            ? `No ${NOTIFICATION_TYPE_FILTERS.find((t) => t.value === typeFilter)?.label.toLowerCase()} notifications`
            : "No notifications yet"}
        </p>
      ) : (
        <div>
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={notificationHref(n)}
              onClick={() => {
                if (!n.read) handleMarkRead(n.id);
              }}
              className={cn(
                "flex items-center gap-4 border-b border-border px-4 py-4 hover:bg-subtle sm:px-6",
                !n.read && "bg-subtle/50",
              )}
            >
              <Avatar
                src={n.actor?.avatar_url ?? null}
                size="sm"
                fallback={n.actor?.username ?? "?"}
              />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm leading-snug">
                  {notificationMessage(n)}
                </p>
                <p
                  suppressHydrationWarning
                  className="mt-0.5 text-xs text-muted"
                >
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {!n.read && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-px" />
    </div>
  );
}
