import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FollowButton } from "@/components/app/profile/FollowButton";

export async function RightSidebar({ userId }: { userId: string }) {
  const supabase = await createClient();

  // Top 5 leaderboard preview
  const { data: topUsers } = await supabase
    .from("leaderboard_weekly")
    .select("user_id, username, avatar_url, total_cost")
    .order("total_cost", { ascending: false })
    .limit(5);

  // Suggested users (popular users not yet followed)
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = following?.map((f) => f.following_id) ?? [];
  const excludeIds = [userId, ...followingIds];

  const { data: suggested } = await supabase
    .from("users")
    .select("id, username, avatar_url, bio")
    .eq("is_public", true)
    .not("username", "is", null)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .limit(5);

  return (
    <div className="flex flex-col">
      {/* Suggested Friends */}
      <div className="border-b border-border p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Suggested Friends
        </p>
        {suggested && suggested.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {suggested.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                <Link href={`/u/${u.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:text-accent">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                      {u.username?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{u.username}</p>
                    {u.bio && (
                      <p className="truncate text-xs text-muted">{u.bio}</p>
                    )}
                  </div>
                </Link>
                <FollowButton username={u.username} initialFollowing={false} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No suggestions</p>
        )}
      </div>

      {/* Leaderboard Preview */}
      <div className="border-b border-border p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Top This Week
        </p>
        <ul className="flex flex-col gap-3">
          {topUsers?.map((u, i) => (
            <li key={u.user_id}>
              <Link
                href={`/u/${u.username}`}
                className="flex items-center gap-3 hover:text-accent"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold">
                  {i + 1}
                </span>
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {u.username?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
                <span className="flex-1 truncate text-sm font-medium">
                  {u.username}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-sm text-accent">
                  ${Number(u.total_cost).toFixed(0)}
                </span>
              </Link>
            </li>
          ))}
          {(!topUsers || topUsers.length === 0) && (
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
