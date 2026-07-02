"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { FollowButton } from "@/components/app/profile/FollowButton";
import { fetchRightSidebar, type RightSidebarResponse } from "@/lib/query/right-sidebar";
import { queryKeys } from "@/lib/query/keys";
import { formatTokens } from "@/lib/utils/format";

export function RightSidebarFallback() {
  return (
    <div className="flex flex-col" aria-label="Loading discovery panel">
      {[0, 1, 2].map((section) => (
        <div key={section} className="border-b border-border p-6">
          <Skeleton className="mb-4 h-3 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LazyRightSidebar() {
  const rightSidebarQuery = useQuery({
    queryKey: queryKeys.rightSidebar(),
    queryFn: fetchRightSidebar,
    staleTime: 60_000,
  });

  if (rightSidebarQuery.isLoading) {
    return <RightSidebarFallback />;
  }

  if (rightSidebarQuery.isError) {
    return (
      <div className="border-b border-border p-6">
        <p className="text-sm text-muted">Discovery is unavailable right now.</p>
      </div>
    );
  }

  if (!rightSidebarQuery.data) {
    return <RightSidebarFallback />;
  }

  return <RightSidebar data={rightSidebarQuery.data} />;
}

export function RightSidebar({ data }: { data: RightSidebarResponse }) {
  const TARGET = 1_000_000_000;
  const pct = Math.min((data.totalOutputTokens / TARGET) * 100, 100);

  return (
    <div className="flex flex-col">
      <div className="border-b border-border p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Suggested Friends
        </p>
        {data.suggested.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.suggested.map((user) => (
              <li key={user.id} className="flex items-center gap-3">
                <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent">
                  <Avatar src={user.avatar_url} alt={user.username} size="sm" fallback={user.username} />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{user.username}</p>
                    {user.bio && (
                      <p className="truncate text-xs text-muted">{user.bio}</p>
                    )}
                  </div>
                </Link>
                <FollowButton username={user.username} initialFollowing={false} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No suggestions</p>
        )}
      </div>

      <div className="border-b border-border p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Featured Challenge
        </p>
        <p className="text-sm font-semibold">The Three Comma Club</p>
        <p className="mb-3 text-xs text-muted">First to one billion output tokens</p>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>{formatTokens(data.totalOutputTokens)} ({pct < 0.01 ? "<0.01" : pct.toFixed(2)}%)</span>
          <span>1B</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="border-b border-border p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Top This Week
        </p>
        <ul className="flex flex-col gap-3">
          {data.topUsers.map((user, index) => (
            <li key={user.user_id}>
              <Link
                href={`/u/${user.username ?? ""}`}
                className="flex items-center gap-3 hover:text-accent"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold">
                  {index + 1}
                </span>
                <Avatar src={user.avatar_url} alt={user.username ?? ""} size="sm" fallback={user.username ?? "?"} />
                <span className="flex-1 truncate text-sm font-medium">
                  {user.username}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-sm text-accent">
                  ${Math.round(Number(user.total_cost ?? 0)).toLocaleString("en-US")}
                </span>
              </Link>
            </li>
          ))}
          {data.topUsers.length === 0 && (
            <li className="text-sm text-muted">No activity yet</li>
          )}
        </ul>
        <Link
          href="/leaderboard"
          className="mt-4 flex items-center justify-between border-t border-dashed border-muted/30 pt-4 text-xs font-bold uppercase tracking-widest hover:text-accent"
        >
          View Full Leaderboard
          <span className="text-base font-light">&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
