import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { LeaderboardTable } from "@/components/app/leaderboard/LeaderboardTable";
import type { LeaderboardEntry } from "@/types";
import type { Metadata } from "next";

type LeaderboardViewRow = Omit<LeaderboardEntry, "rank" | "streak"> & {
  display_name: string | null;
  total_cost: number | string;
  total_output_tokens: number | string;
};

const LEADERBOARD_DESCRIPTION =
  "See who's leading the pack. Weekly, monthly, and all-time Claude Code spend rankings.";

const SOCIAL_IMAGE = {
  url: "/og-image.png?v=2",
  width: 1200,
  height: 630,
  alt: "Straude — Code like an athlete. Track your Claude Code spend, compete with friends, share your breakthrough sessions.",
  type: "image/png",
};

export const metadata: Metadata = {
  title: "Leaderboard",
  description: LEADERBOARD_DESCRIPTION,
  alternates: {
    canonical: "/leaderboard",
  },
  openGraph: {
    url: "https://straude.com/leaderboard",
    title: "Leaderboard | Straude",
    description: LEADERBOARD_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaderboard | Straude",
    description: LEADERBOARD_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; region?: string }>;
}) {
  const { period = "week", region } = await searchParams;
  const user = await getAuthUser();
  const supabase = await createClient();
  const db = getServiceClient();

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
  const { data: rawEntries } = await query;
  const entries = (rawEntries ?? []) as LeaderboardViewRow[];

  // Fetch streaks for all leaderboard users in a single RPC call
  const userIds = entries.map((entry) => entry.user_id);
  const { data: streakRows } = userIds.length > 0
    ? await supabase.rpc("calculate_streaks_batch", { p_user_ids: userIds })
    : { data: [] };

  const streakMap = new Map<string, number>();
  for (const row of streakRows ?? []) {
    streakMap.set(row.user_id, row.streak);
  }

  const { data: levelRows } = userIds.length > 0
    ? await db
        .from("user_levels")
        .select("user_id, level")
        .in("user_id", userIds)
    : { data: [] };

  const levelMap = new Map<string, number>();
  for (const row of levelRows ?? []) {
    levelMap.set(row.user_id, Number(row.level));
  }

  // Add rank numbers and streaks
  const ranked: LeaderboardEntry[] = entries.map((entry, i) => ({
      ...entry,
      rank: i + 1,
      total_cost: Number(entry.total_cost),
      total_output_tokens: Number(entry.total_output_tokens),
      streak: streakMap.get(entry.user_id) ?? 0,
      level: levelMap.get(entry.user_id),
    }));

  return (
    <>
      <LeaderboardTable
        entries={ranked}
        currentUserId={user?.id ?? null}
        currentPeriod={period}
        currentRegion={region ?? null}
      />
    </>
  );
}
