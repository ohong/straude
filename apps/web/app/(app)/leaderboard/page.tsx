import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable } from "@/components/app/leaderboard/LeaderboardTable";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; region?: string }>;
}) {
  const { period = "week", region } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // We'll use the materialized view directly for SSR
  const viewName = `leaderboard_${period === "all_time" ? "all_time" : period === "month" ? "monthly" : period === "day" ? "daily" : "weekly"}`;

  let query = supabase
    .from(viewName)
    .select("*")
    .order("total_cost", { ascending: false })
    .limit(50);

  if (region) {
    query = query.eq("region", region);
  }

  // Fetch leaderboard + profile in parallel (skip profile for guests)
  const profilePromise = user
    ? supabase.from("users").select("country, region").eq("id", user.id).single()
    : Promise.resolve({ data: null });

  const [{ data: entries }, { data: profile }] = await Promise.all([
    query,
    profilePromise,
  ]);

  // Fetch streaks for all leaderboard users in a single RPC call
  const userIds = (entries ?? []).map((e: any) => e.user_id);
  const { data: streakRows } = userIds.length > 0
    ? await supabase.rpc("calculate_streaks_batch", { p_user_ids: userIds })
    : { data: [] };

  const streakMap = new Map<string, number>();
  for (const row of streakRows ?? []) {
    streakMap.set(row.user_id, row.streak);
  }

  // Add rank numbers and streaks
  const ranked =
    entries?.map((e: any, i: number) => ({
      ...e,
      rank: i + 1,
      total_cost: Number(e.total_cost),
      total_output_tokens: Number(e.total_output_tokens),
      streak: streakMap.get(e.user_id) ?? 0,
    })) ?? [];

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Leaderboard</h3>
      </header>

      <LeaderboardTable
        entries={ranked}
        currentUserId={user?.id ?? null}
        currentPeriod={period}
        currentRegion={region ?? null}
        userCountry={profile?.country ?? null}
      />
    </>
  );
}
