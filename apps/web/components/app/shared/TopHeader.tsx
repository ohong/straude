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
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function notificationMessage(n: Notification): string {
  const actor = n.actor?.username ?? "Someone";
  switch (n.type) {
    case "follow":
      return `${actor} started following you`;
    case "kudos":
      return `${actor} gave kudos to your post`;
    case "comment":
      return `${actor} commented on your post`;
    case "mention":
      return `${actor} mentioned you in a ${n.comment_id ? "comment" : "post"}`;
    default:
      return `${actor} interacted with you`;
  }
}

function notificationHref(n: Notification): string {
  switch (n.type) {
    case "follow":
      return `/u/${n.actor?.username ?? ""}`;
    case "kudos":
    case "comment":
    case "mention":
      return `/post/${n.post_id ?? ""}`;
    default:
      return "/notifications";
  }
}

export function TopHeader({ username, avatarUrl }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Close dropdowns on outside click
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
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [profileOpen, notifOpen]);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unread_count ?? 0);
  }, []);

  // Initial unread count fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
    <header className="z-20 shrink-0 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 lg:px-6">
        {/* Left — Brand */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span
            className="inline-block h-5 w-5 bg-accent"
            style={{
              clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            }}
          />
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
              className="relative text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell size={20} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 rounded border border-border bg-background shadow-lg">
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
                <div className="max-h-80 overflow-y-auto">
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
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="Profile menu"
              aria-expanded={profileOpen}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <Avatar
                src={avatarUrl}
                size="xs"
                fallback={username || "?"}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded border border-border bg-background shadow-lg">
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
            className="rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            aria-label="Create post"
          >
            <Plus size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
