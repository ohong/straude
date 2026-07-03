import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/app/shared/Sidebar";
import { LazyRightSidebar } from "@/components/app/shared/RightSidebar";
import { InviteButton } from "@/components/app/profile/InviteButton";
import { ResponsiveShellFrame } from "@/components/app/shared/ResponsiveShellFrame";
import { GuestHeader, GuestMobileNav } from "@/components/app/shared/GuestHeader";
import { CommandPalette } from "@/components/app/shared/CommandPalette";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppProviders } from "@/components/providers/AppProviders";
import { firstRelation } from "@/lib/utils/first-relation";
import { loadUsageTotals } from "@/lib/data/usage-totals";
import type { DailyUsage } from "@/types";

type ShellProfile = {
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
  team_url: string | null;
  team_favicon_url: string | null;
  onboarding_completed: boolean | null;
  streak_freezes: number | null;
};

type LatestPostRow = {
  id: string;
  title: string | null;
  created_at: string;
  daily_usage: Array<Pick<DailyUsage, "date">> | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function formatLatestPosts(rows: LatestPostRow[]) {
  return rows
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
}

async function loadLatestPosts(supabase: SupabaseServerClient, userId: string) {
  // Order by daily_usage.date so backfills (which insert many posts in the same
  // second) still surface the most recent activity. !inner is required for
  // referencedTable ordering to apply to the parent rows.
  const { data } = await supabase
    .from("posts")
    .select("id, title, created_at, daily_usage:daily_usage!posts_daily_usage_id_fkey!inner(date)")
    .eq("user_id", userId)
    .order("date", { ascending: false, referencedTable: "daily_usage" })
    .order("created_at", { ascending: false })
    .limit(3);

  return formatLatestPosts((data ?? []) as LatestPostRow[]);
}

function SidebarFallback({ profile }: { profile: ShellProfile | null }) {
  const username = profile?.username ?? null;
  const displayName = profile?.display_name ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-6">
        <Avatar
          src={profile?.avatar_url ?? null}
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
      </div>
      <div className="grid grid-cols-3 border-b border-border py-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col items-center gap-2 px-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="mb-3 h-3 w-28" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      {username && (
        <div className="border-b border-border p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
            Grow Your Crew
          </p>
          <p className="mb-3 text-sm text-muted">
            Invite a training partner. See who racks up more.
          </p>
          <InviteButton username={username} />
        </div>
      )}
      <div className="mt-auto border-t border-border p-6">
        <Skeleton className="mb-3 h-3 w-20" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-3 h-5 w-20" />
      </div>
    </div>
  );
}

async function DeferredSidebar({
  userId,
  profile,
}: {
  userId: string;
  profile: ShellProfile | null;
}) {
  const supabase = await createClient();

  const [
    followingRes,
    followersRes,
    postsRes,
    latestPosts,
    usageTotals,
    streakRes,
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    loadLatestPosts(supabase, userId),
    loadUsageTotals(supabase, userId),
    supabase.rpc("calculate_user_streak", {
      p_user_id: userId,
      p_freeze_days: profile?.streak_freezes ?? 0,
    }),
  ]);

  return (
    <Sidebar
      username={profile?.username ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      displayName={profile?.display_name ?? null}
      teamUrl={profile?.team_url ?? null}
      teamFaviconUrl={profile?.team_favicon_url ?? null}
      followingCount={followingRes.count ?? 0}
      followersCount={followersRes.count ?? 0}
      postsCount={postsRes.count ?? 0}
      streak={Number(streakRes.data) || 0}
      streakFreezes={profile?.streak_freezes ?? 0}
      latestPosts={latestPosts}
      totalOutputTokens={usageTotals.totalTokens}
      totalCost={usageTotals.totalCost}
    />
  );
}

async function PhotoNudge({
  userId,
  onboardingIncomplete,
}: {
  userId: string;
  onboardingIncomplete: boolean;
}) {
  if (onboardingIncomplete) return null;

  const supabase = await createClient();
  const [latestPosts, photoAchievementRes] = await Promise.all([
    loadLatestPosts(supabase, userId),
    supabase
      .from("user_achievements")
      .select("id")
      .eq("user_id", userId)
      .eq("achievement_slug", "first-photo")
      .maybeSingle(),
  ]);

  if (latestPosts.length === 0 || photoAchievementRes.data) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-border bg-accent/5 px-4 py-2 text-sm">
      <span className="text-muted">Unlock achievements by adding a photo to your post</span>
      <Link href={`/post/${latestPosts[0].id}`} className="font-medium text-accent hover:underline">
        Add a photo
      </Link>
    </div>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  // If not logged in: allow public pages, redirect others to login
  if (!user) {
    // This check runs server-side as a safety net alongside proxy.ts
    // Public pages render with a guest layout below
    return (
      <AppProviders>
        <div className="fixed inset-0 flex flex-col overflow-hidden">
          <GuestHeader />
          <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden border-x border-border">
            <main id="main-content" className="scrollbar-none min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className="pb-[var(--mobile-nav-height)] sm:pb-0">
                {children}
              </div>
            </main>
          </div>
          <GuestMobileNav />
        </div>
      </AppProviders>
    );
  }

  const db = getServiceClient();
  const { data: profileData } = await db
    .from("users")
    .select("username, avatar_url, display_name, team_url, team_favicon_url, onboarding_completed, streak_freezes")
    .eq("id", user.id)
    .single();

  const profile = profileData as ShellProfile | null;
  const onboardingIncomplete = !profile?.onboarding_completed;

  const leftPanel = (
    <Suspense fallback={<SidebarFallback profile={profile} />}>
      <DeferredSidebar userId={user.id} profile={profile} />
    </Suspense>
  );

  const rightPanel = <LazyRightSidebar />;

  return (
    <AppProviders>
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
          <Suspense fallback={null}>
            <PhotoNudge
              userId={user.id}
              onboardingIncomplete={onboardingIncomplete}
            />
          </Suspense>

          <ResponsiveShellFrame
            username={profile?.username ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            leftPanel={leftPanel}
            rightPanel={rightPanel}
            showPromptWidget={!onboardingIncomplete}
          >
            {children}
          </ResponsiveShellFrame>
        </div>
      </CommandPalette>
    </AppProviders>
  );
}
