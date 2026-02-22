import { getServiceClient } from "@/lib/supabase/service";

export interface AchievementStats {
  totalCost: number;
  totalOutputTokens: number;
  streak: number;
  syncCount: number;
}

export interface AchievementDef {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  check: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    slug: "first-sync",
    title: "First Sync",
    description: "Push your first session",
    emoji: "\u{1F331}",
    check: (s) => s.syncCount >= 1,
  },
  {
    slug: "7-day-streak",
    title: "7-Day Streak",
    description: "Log 7 days in a row",
    emoji: "\u{1F525}",
    check: (s) => s.streak >= 7,
  },
  {
    slug: "30-day-streak",
    title: "30-Day Streak",
    description: "Log 30 days in a row",
    emoji: "\u{1F3C6}",
    check: (s) => s.streak >= 30,
  },
  {
    slug: "100-club",
    title: "$100 Club",
    description: "Spend $100 lifetime",
    emoji: "\u{1F4B8}",
    check: (s) => s.totalCost >= 100,
  },
  {
    slug: "big-spender",
    title: "Big Spender",
    description: "Spend $500 lifetime",
    emoji: "\u{1F911}",
    check: (s) => s.totalCost >= 500,
  },
  {
    slug: "1m-output",
    title: "1M Output",
    description: "Generate 1 million output tokens",
    emoji: "\u{26A1}",
    check: (s) => s.totalOutputTokens >= 1_000_000,
  },
  {
    slug: "10m-output",
    title: "10M Output",
    description: "Generate 10 million output tokens",
    emoji: "\u{1F680}",
    check: (s) => s.totalOutputTokens >= 10_000_000,
  },
  {
    slug: "100m-output",
    title: "100M Output",
    description: "Generate 100 million output tokens",
    emoji: "\u{1F30B}",
    check: (s) => s.totalOutputTokens >= 100_000_000,
  },
];

export async function checkAndAwardAchievements(userId: string): Promise<void> {
  const db = getServiceClient();

  // Fetch earned slugs and aggregate stats in parallel
  const [{ data: earned }, { data: usageRows }, streakResult] = await Promise.all([
    db.from("user_achievements").select("achievement_slug").eq("user_id", userId),
    db.from("daily_usage").select("cost_usd, output_tokens").eq("user_id", userId),
    db.rpc("calculate_user_streak", { p_user_id: userId }),
  ]);

  const earnedSlugs = new Set(earned?.map((r) => r.achievement_slug) ?? []);

  const stats: AchievementStats = {
    totalCost: usageRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0,
    totalOutputTokens: usageRows?.reduce((s, r) => s + Number(r.output_tokens), 0) ?? 0,
    streak: (streakResult.data as number) ?? 0,
    syncCount: usageRows?.length ?? 0,
  };

  const newAwards = ACHIEVEMENTS.filter(
    (a) => !earnedSlugs.has(a.slug) && a.check(stats),
  );

  if (newAwards.length === 0) return;

  await db.from("user_achievements").insert(
    newAwards.map((a) => ({
      user_id: userId,
      achievement_slug: a.slug,
    })),
  );
}
