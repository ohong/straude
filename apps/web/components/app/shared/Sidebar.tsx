"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Flame } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  followingCount: number;
  followersCount: number;
  postsCount: number;
  streak: number;
  latestPost: { title: string; date: string } | null;
}

export function Sidebar({
  username,
  avatarUrl,
  displayName,
  followingCount,
  followersCount,
  postsCount,
  streak,
  latestPost,
}: SidebarProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const profileHref = username ? `/u/${username}` : "/settings";

  return (
    <div className="flex h-full flex-col">
      {/* Profile header */}
      <div className="border-b border-border p-6">
        <Link href={profileHref} className="block">
          <Avatar
            src={avatarUrl}
            alt={displayName ?? username ?? ""}
            size="lg"
            fallback={displayName ?? username ?? "?"}
          />
          {displayName && (
            <p className="mt-3 text-base font-semibold">{displayName}</p>
          )}
          {username && (
            <p className="text-sm text-muted">@{username}</p>
          )}
        </Link>
      </div>

      {/* Stats row */}
      <div className="flex justify-between border-b border-border px-6 py-4">
        <Link href={profileHref} className="flex flex-col items-center">
          <span className="text-base font-semibold">{followingCount}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Following
          </span>
        </Link>
        <Link href={profileHref} className="flex flex-col items-center">
          <span className="text-base font-semibold">{followersCount}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Followers
          </span>
        </Link>
        <Link href={profileHref} className="flex flex-col items-center">
          <span className="text-base font-semibold">{postsCount}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Activities
          </span>
        </Link>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-4 text-sm">
        <Flame size={16} className={streak > 0 ? "text-accent" : undefined} />
        {streak > 0 ? `${streak} day streak` : "No active streak"}
      </div>

      {/* Latest Activity */}
      {latestPost && (
        <div className="border-b border-border px-6 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
            Latest Activity
          </p>
          <p className="truncate text-sm font-medium">{latestPost.title}</p>
          <p className="text-xs text-muted">{latestPost.date}</p>
        </div>
      )}

      {/* Spacer + Log out */}
      <div className="mt-auto p-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}
