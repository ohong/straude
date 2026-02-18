"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { formatTokens } from "@/lib/utils/format";
import { Avatar } from "@/components/ui/Avatar";

interface SidebarProps {
  username: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  followingCount: number;
  followersCount: number;
  postsCount: number;
  streak: number;
  latestPosts: { id: string; title: string; date: string }[];
  totalOutputTokens: number;
  totalCost: number;
}

export function Sidebar({
  username,
  avatarUrl,
  displayName,
  followingCount,
  followersCount,
  postsCount,
  streak,
  latestPosts,
  totalOutputTokens,
  totalCost,
}: SidebarProps) {
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

      {/* Stats row — stacked for readability */}
      <div className="grid grid-cols-3 border-b border-border py-4">
        <Link href={username ? `/u/${username}/follows?tab=following` : profileHref} className="flex flex-col items-center gap-1 px-2">
          <span className="text-base font-semibold">{followingCount}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Following
          </span>
        </Link>
        <Link href={username ? `/u/${username}/follows?tab=followers` : profileHref} className="flex flex-col items-center gap-1 border-x border-border px-2">
          <span className="text-base font-semibold">{followersCount}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Followers
          </span>
        </Link>
        <Link href={profileHref} className="flex flex-col items-center gap-1 px-2">
          <span className="text-base font-semibold">{postsCount}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">
            Activities
          </span>
        </Link>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-4 text-sm">
        <Flame size={16} className={streak > 0 ? "text-accent" : undefined} aria-hidden="true" />
        {streak > 0 ? `${streak} day streak` : "No active streak"}
      </div>

      {/* Latest Activities — clickable */}
      {latestPosts.length > 0 && (
        <div className="border-b border-border">
          <p className="px-6 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Latest Activities
          </p>
          {latestPosts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="block px-6 py-2 hover:bg-subtle"
            >
              <p className="truncate text-sm font-medium">{post.title}</p>
              <p className="text-xs text-muted">{post.date}</p>
            </Link>
          ))}
        </div>
      )}

      {/* All-time stats — above log out */}
      <div className="mt-auto border-t border-border p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
          All Time
        </p>
        <p
          className="font-[family-name:var(--font-mono)] text-[2rem] leading-none tracking-tight tabular-nums"
          style={{ letterSpacing: "-0.03em" }}
        >
          {formatTokens(totalOutputTokens)}
        </p>
        <p className="mt-1 text-xs text-muted">Output tokens</p>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-lg font-medium text-accent">
          ${totalCost.toFixed(2)}
        </p>
        <p className="text-xs text-muted">Total spend</p>
      </div>

    </div>
  );
}
