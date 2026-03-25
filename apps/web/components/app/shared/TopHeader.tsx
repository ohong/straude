"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  Plus,
  User,
  Settings,
  LogOut,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";
import { BoltIcon } from "@/components/landing/icons";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, notificationMessage, notificationHref } from "@/lib/utils/notifications";
import type { Notification } from "@/types";

interface TopHeaderProps {
  username: string | null;
  avatarUrl: string | null;
}

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/search", label: "Search" },
] as const;

export function TopHeader({ username, avatarUrl }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        profileOpen &&
        profileRef.current &&
        !profileRef.current.contains(target)
      )
        setProfileOpen(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(target))
        setNotifOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen, notifOpen]);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unread_count ?? 0);
  }, []);

  const fetchMessageUnreadCount = useCallback(async () => {
    const res = await fetch("/api/messages/threads?limit=1");
    if (!res.ok) return;
    const data = await res.json();
    setMessageUnreadCount(data.unread_count ?? 0);
  }, []);

  // Initial unread count fetch + mark as returning user + listen for external changes
  useEffect(() => {
    function refreshCounts() {
      void fetchNotifications();
      void fetchMessageUnreadCount();
    }

    const initialRefresh = window.setTimeout(refreshCounts, 0);
    try { localStorage.setItem("straude_returning", "1"); } catch {}
    function handleSync() {
      refreshCounts();
    }
    window.addEventListener("notifications-updated", handleSync);
    window.addEventListener("messages-updated", handleSync);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("notifications-updated", handleSync);
      window.removeEventListener("messages-updated", handleSync);
    };
  }, [fetchMessageUnreadCount, fetchNotifications]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <header className="z-20 shrink-0 border-b border-border bg-background safe-top">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 lg:px-6">
        {/* Left — Brand */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <BoltIcon className="h-5 w-5 text-accent" />
          STRAUDE
        </Link>

        {/* Center — Nav */}
        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "pb-0.5 text-sm font-medium transition-colors",
                  active
                    ? "border-b-2 border-accent text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right — Actions */}
        <div className="flex items-center gap-3">
          <kbd className="hidden items-center gap-1 rounded border border-border bg-subtle px-2 py-1 font-mono text-[10px] text-muted lg:inline-flex">
            <span className="text-xs">⌘</span>K
          </kbd>
          <Link
            href="/messages"
            className="relative rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Messages"
          >
            <MessageSquare size={20} aria-hidden="true" />
            {messageUnreadCount > 0 && (
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-accent" />
            )}
          </Link>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => {
                  if (!v) fetchNotifications();
                  return !v;
                });
              }}
              className="relative rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={notifOpen}
            >
              <Bell size={20} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>

            {notifOpen && (
              <div className="fixed inset-x-0 top-[57px] z-50 mx-2 rounded border border-border bg-background shadow-lg sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-1 sm:w-80">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[60vh] overflow-y-auto sm:max-h-80" style={{ WebkitOverflowScrolling: "touch" }}>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted">
                      No notifications yet
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={notificationHref(n)}
                        onClick={() => {
                          setNotifOpen(false);
                          if (!n.read) {
                            setNotifications((prev) =>
                              prev.map((x) => x.id === n.id ? { ...x, read: true } : x),
                            );
                            setUnreadCount((c) => Math.max(0, c - 1));
                            fetch("/api/notifications", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ids: [n.id] }),
                            });
                          }
                        }}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 hover:bg-subtle",
                          !n.read && "bg-subtle/50",
                        )}
                      >
                        <Avatar
                          src={n.actor?.avatar_url ?? null}
                          size="xs"
                          fallback={n.actor?.username ?? "?"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug">
                            {notificationMessage(n)}
                          </p>
                          <p suppressHydrationWarning className="mt-0.5 text-xs text-muted">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </Link>
                    ))
                  )}
                </div>
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-muted hover:text-foreground"
                >
                  See all notifications
                </Link>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="Profile menu"
              aria-haspopup="true"
              aria-expanded={profileOpen}
              className="rounded p-1.5 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Avatar
                src={avatarUrl}
                size="xs"
                fallback={username || "?"}
              />
            </button>

            {profileOpen && (
              <div className="fixed right-2 top-[57px] z-50 w-48 rounded border border-border bg-background shadow-lg sm:absolute sm:right-0 sm:top-full sm:mt-1">
                <Link
                  href={`/u/${username ?? ""}`}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle"
                  onClick={() => setProfileOpen(false)}
                >
                  <User size={16} aria-hidden="true" />
                  View Profile
                </Link>
                <Link
                  href="/recap"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle"
                  onClick={() => setProfileOpen(false)}
                >
                  <BarChart3 size={16} aria-hidden="true" />
                  Recap
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings size={16} aria-hidden="true" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted hover:bg-subtle hover:text-foreground"
                >
                  <LogOut size={16} aria-hidden="true" />
                  Log out
                </button>
              </div>
            )}
          </div>

          {/* Create post */}
          <Link
            href="/post/new"
            className="rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Create post"
          >
            <Plus size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
