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

  // Fetch leaderboard data from API
  const params = new URLSearchParams({ period, limit: "50" });
  if (region) params.set("region", region);

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

  const { data: entries } = await query;

  // Get current user's profile for highlighting
  const { data: profile } = await supabase
    .from("users")
    .select("country, region")
    .eq("id", user!.id)
    .single();

  // Add rank numbers
  const ranked =
    entries?.map((e, i) => ({
      ...e,
      rank: i + 1,
      total_cost: Number(e.total_cost),
      total_tokens: Number(e.total_tokens),
    })) ?? [];

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Leaderboard</h3>
      </header>

      <LeaderboardTable
        entries={ranked}
        currentUserId={user!.id}
        currentPeriod={period}
        currentRegion={region ?? null}
        userCountry={profile?.country ?? null}
      />
    </>
  );
}
