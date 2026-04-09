import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/app/shared/Sidebar";
import { RightSidebar } from "@/components/app/shared/RightSidebar";
import { ResponsiveShellFrame } from "@/components/app/shared/ResponsiveShellFrame";
import { GuestHeader, GuestMobileNav } from "@/components/app/shared/GuestHeader";
import { CommandPalette } from "@/components/app/shared/CommandPalette";
import { firstRelation } from "@/lib/utils/first-relation";
import type { DailyUsage } from "@/types";

type LatestPostRow = {
  id: string;
  title: string | null;
  created_at: string;
  daily_usage: Array<Pick<DailyUsage, "date">> | null;
};

type UsageFallbackRow = Pick<DailyUsage, "cost_usd" | "total_tokens">;
type UsageTotalsRpcRow = {
  total_cost: number | string | null;
  total_tokens: number | string | null;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const supabase = await createClient();

  // If not logged in: allow public pages, redirect others to login
  if (!user) {
    // This check runs server-side as a safety net alongside proxy.ts
    // Public pages render with a guest layout below
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        <GuestHeader />
          <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 border-x border-border">
            <main id="main-content" className="min-w-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", overscrollBehavior: "contain" }}>
              <div className="pb-[var(--mobile-nav-height)] sm:pb-0">
                {children}
              </div>
            </main>
          </div>
          <GuestMobileNav />
      </div>
    );
  }

  // Fetch profile + sidebar data in a single parallel batch
  const [
    { data: profile },
    followingRes,
    followersRes,
    postsRes,
    latestPostRes,
    usageTotalsRes,
    photoAchievementRes,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", user.id),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("posts")
      .select("id, title, created_at, daily_usage:daily_usage!posts_daily_usage_id_fkey(date)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.rpc("get_user_usage_totals", { p_user_id: user.id }).single(),
    supabase
      .from("user_achievements")
      .select("id")
      .eq("user_id", user.id)
      .eq("achievement_slug", "first-photo")
      .maybeSingle(),
  ]);

  const onboardingIncomplete = !profile?.onboarding_completed;

  // Streak needs profile.streak_freezes, so it runs after the parallel batch
  const streakRes = await supabase.rpc("calculate_user_streak", {
    p_user_id: user.id,
    p_freeze_days: profile?.streak_freezes ?? 0,
  });

  const followingCount = followingRes.count ?? 0;
  const followersCount = followersRes.count ?? 0;
  const postsCount = postsRes.count ?? 0;
  const streak = Number(streakRes.data) || 0;
  const hasPhotoAchievement = !!photoAchievementRes.data;
  const showPhotoNudge = postsCount > 0 && !hasPhotoAchievement && !onboardingIncomplete;

  let totalTokens = 0;
  let totalCost = 0;

  const loadFallbackUsageTotals = async (): Promise<{ totalTokens: number; totalCost: number }> => {
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("daily_usage")
      .select("cost_usd, total_tokens")
      .eq("user_id", user.id);

    if (fallbackError) {
      throw new Error(`Unable to load usage totals from daily_usage fallback (${fallbackError.message})`);
    }

    const rows = (fallbackRows ?? []) as UsageFallbackRow[];
    return {
      totalTokens: rows.reduce((sum, row) => sum + Number(row.total_tokens), 0),
      totalCost: rows.reduce((sum, row) => sum + Number(row.cost_usd), 0),
    };
  };

  if (usageTotalsRes.error) {
    console.error("get_user_usage_totals RPC failed; using direct daily_usage fallback", {
      userId: user.id,
      code: usageTotalsRes.error.code,
      message: usageTotalsRes.error.message,
    });

    const fallback = await loadFallbackUsageTotals();
    totalTokens = fallback.totalTokens;
    totalCost = fallback.totalCost;
  } else {
    const usageTotals = usageTotalsRes.data as UsageTotalsRpcRow | null;
    const rpcTokens = usageTotals?.total_tokens;

    if (rpcTokens === null || rpcTokens === undefined) {
      console.error("get_user_usage_totals returned no total_tokens; using direct daily_usage fallback", {
        userId: user.id,
        rpcKeys: usageTotals ? Object.keys(usageTotals) : [],
      });

      const fallback = await loadFallbackUsageTotals();
      totalTokens = fallback.totalTokens;
      totalCost = fallback.totalCost;
    } else {
      totalTokens = Number(rpcTokens);
      totalCost = Number(usageTotals?.total_cost ?? 0);
    }
  }

  const latestPosts = ((latestPostRes.data ?? []) as LatestPostRow[])
    .map((row) => {
      // Prefer the usage date (user's local date) over created_at (UTC timestamp)
      const usageDate = firstRelation(row.daily_usage)?.date;
      const sortKey = usageDate ?? row.created_at;
      const displayDate = usageDate
        ? new Date(usageDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return { id: row.id, title: row.title ?? "Untitled", date: displayDate, sortKey };
    })
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const leftPanel = (
    <Sidebar
      username={profile?.username ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      displayName={profile?.display_name ?? null}
      followingCount={followingCount}
      followersCount={followersCount}
      postsCount={postsCount}
      streak={streak}
      streakFreezes={profile?.streak_freezes ?? 0}
      latestPosts={latestPosts}
      totalOutputTokens={totalTokens}
      totalCost={totalCost}
    />
  );

  const rightPanel = (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted">
          Loading discovery panel&hellip;
        </div>
      }
    >
      <RightSidebar
        userId={user.id}
        username={profile?.username ?? null}
        totalOutputTokens={totalTokens}
      />
    </Suspense>
  );

  return (
    <CommandPalette username={profile?.username ?? null}>
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        {onboardingIncomplete && (
          <div className="flex items-center justify-center gap-2 border-b border-border bg-accent/5 px-4 py-2 text-sm">
            <span className="text-muted">Finish setting up your profile</span>
            <Link href="/onboarding" className="font-medium text-accent hover:underline">
              Complete onboarding
            </Link>
          </div>
        )}
        {showPhotoNudge && (
          <div className="flex items-center justify-center gap-2 border-b border-border bg-accent/5 px-4 py-2 text-sm">
            <span className="text-muted">Unlock achievements by adding a photo to your post</span>
            <Link href={`/post/${latestPosts[0]?.id}`} className="font-medium text-accent hover:underline">
              Add a photo
            </Link>
          </div>
        )}

        <ResponsiveShellFrame
          username={profile?.username ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          leftPanel={leftPanel}
          rightPanel={rightPanel}
        >
          {children}
        </ResponsiveShellFrame>
      </div>
    </CommandPalette>
  );
}
