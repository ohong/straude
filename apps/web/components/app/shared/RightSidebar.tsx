import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { formatTokens } from "@/lib/utils/format";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/app/profile/FollowButton";
import { InviteButton } from "@/components/app/profile/InviteButton";

export async function RightSidebar({ userId }: { userId: string }) {
  const supabase = await createClient();
  // Service client bypasses RLS so suggestions can include private users.
  // The users RLS policy restricts SELECT to is_public=true, which means
  // power users who follow everyone public see zero suggestions.
  const service = getServiceClient();

  // Start independent queries in parallel (avoid waterfall)
  const [{ data: topUsers }, { data: following }, { data: userUsage }, { data: userProfile }] = await Promise.all([
    supabase
      .from("leaderboard_weekly")
      .select("user_id, username, avatar_url, total_cost")
      .order("total_cost", { ascending: false })
      .limit(5),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId),
    supabase
      .from("daily_usage")
      .select("output_tokens")
      .eq("user_id", userId),
    supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single(),
  ]);

  const followingIds = following?.map((f) => f.following_id) ?? [];
  const excludeIds = [userId, ...followingIds];

  // Always pin the site owner as the first suggestion (if not already followed/self)
  const PINNED_USERNAME = "ohong";

  // Service client bypasses RLS so we can query users the current user
  // hasn't followed yet. Filter to is_public=true to exclude dummy/private users.
  const [{ data: pinnedUser }, { data: recentlyActive }, { data: newSignups }] =
    await Promise.all([
      service
        .from("users")
        .select("id, username, avatar_url, bio")
        .eq("username", PINNED_USERNAME)
        .maybeSingle(),
      // Users with recent activity (have pushed usage data)
      service
        .from("daily_usage")
        .select("user_id, users!inner(id, username, avatar_url, bio, is_public)")
        .not("users.username", "is", null)
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .order("date", { ascending: false })
        .limit(20),
      // New signups who completed onboarding (have a username)
      service
        .from("users")
        .select("id, username, avatar_url, bio")
        .eq("is_public", true)
        .not("username", "is", null)
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  // Deduplicate active users (may appear on multiple days), skip private users
  const seenIds = new Set<string>();
  const activeUsers: Array<{ id: string; username: string; avatar_url: string | null; bio: string | null }> = [];
  for (const row of recentlyActive ?? []) {
    const u = row.users as unknown as { id: string; username: string; avatar_url: string | null; bio: string | null; is_public: boolean };
    if (!seenIds.has(u.id) && u.username !== PINNED_USERNAME && u.is_public) {
      seenIds.add(u.id);
      activeUsers.push({ id: u.id, username: u.username, avatar_url: u.avatar_url, bio: u.bio });
    }
  }

  // Merge: pinned first, then active users, then new signups (deduped)
  const isPinnedExcluded = !pinnedUser || excludeIds.includes(pinnedUser.id);
  const merged: typeof activeUsers = [];
  if (!isPinnedExcluded) merged.push(pinnedUser);
  for (const u of activeUsers) {
    if (!merged.some((m) => m.id === u.id)) merged.push(u);
  }
  for (const u of newSignups ?? []) {
    if (!merged.some((m) => m.id === u.id) && u.username !== PINNED_USERNAME) merged.push(u);
  }
  const suggested = merged.slice(0, 5);

  const userOutputTokens = userUsage?.reduce((s, r) => s + Number(r.output_tokens), 0) ?? 0;
  const TARGET = 1_000_000_000;
  const pct = Math.min((userOutputTokens / TARGET) * 100, 100);

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
                  <Avatar src={u.avatar_url} alt={u.username ?? ""} size="sm" fallback={u.username ?? "?"} />
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

      {/* Featured Challenge */}
      <div className="border-b border-border p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Featured Challenge
        </p>
        <p className="text-sm font-semibold">The Three Comma Club</p>
        <p className="mb-3 text-xs text-muted">First to one billion output tokens</p>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>{formatTokens(userOutputTokens)} ({pct < 0.01 ? '<0.01' : pct.toFixed(2)}%)</span>
          <span>1B</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
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
                <Avatar src={u.avatar_url} alt={u.username ?? ""} size="sm" fallback={u.username ?? "?"} />
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

      {/* Referral CTA */}
      {userProfile?.username && (
        <div className="border-b border-border p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
            Grow Your Crew
          </p>
          <p className="mb-3 text-sm text-muted">
            Invite a training partner. See who racks up more.
          </p>
          <InviteButton username={userProfile.username} />
        </div>
      )}

    </div>
  );
}
