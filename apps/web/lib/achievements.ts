import { getServiceClient } from "@/lib/supabase/service";

export type AchievementTrigger = "usage" | "kudos" | "comment";

export interface AchievementStats {
  totalCost: number;
  totalOutputTokens: number;
  totalInputTokens: number;
  totalCacheTokens: number;
  totalSessions: number;
  maxDailyCost: number;
  streak: number;
  syncCount: number;
  verifiedSyncCount: number;
  kudosReceived: number;
  kudosSent: number;
  commentsReceived: number;
  commentsSent: number;
}

export interface AchievementDef {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  trigger: AchievementTrigger;
  check: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    slug: "first-sync",
    title: "First Sync",
    description: "Push your first session",
    emoji: "\u{1F331}",
    trigger: "usage",
    check: (s) => s.syncCount >= 1,
  },
  {
    slug: "7-day-streak",
    title: "7-Day Streak",
    description: "Log 7 days in a row",
    emoji: "\u{1F525}",
    trigger: "usage",
    check: (s) => s.streak >= 7,
  },
  {
    slug: "30-day-streak",
    title: "30-Day Streak",
    description: "Log 30 days in a row",
    emoji: "\u{1F3C6}",
    trigger: "usage",
    check: (s) => s.streak >= 30,
  },
  {
    slug: "100-club",
    title: "$100 Club",
    description: "Spend $100 lifetime",
    emoji: "\u{1F4B8}",
    trigger: "usage",
    check: (s) => s.totalCost >= 100,
  },
  {
    slug: "big-spender",
    title: "Big Spender",
    description: "Spend $500 lifetime",
    emoji: "\u{1F911}",
    trigger: "usage",
    check: (s) => s.totalCost >= 500,
  },
  {
    slug: "1m-output",
    title: "1M Output",
    description: "Generate 1 million output tokens",
    emoji: "\u{26A1}",
    trigger: "usage",
    check: (s) => s.totalOutputTokens >= 1_000_000,
  },
  {
    slug: "10m-output",
    title: "10M Output",
    description: "Generate 10 million output tokens",
    emoji: "\u{1F680}",
    trigger: "usage",
    check: (s) => s.totalOutputTokens >= 10_000_000,
  },
  {
    slug: "100m-output",
    title: "100M Output",
    description: "Generate 100 million output tokens",
    emoji: "\u{1F30B}",
    trigger: "usage",
    check: (s) => s.totalOutputTokens >= 100_000_000,
  },
  {
    slug: "1m-input",
    title: "1M Input",
    description: "Process 1 million input tokens",
    emoji: "\u{1F4E5}",
    trigger: "usage",
    check: (s) => s.totalInputTokens >= 1_000_000,
  },
  {
    slug: "10m-input",
    title: "10M Input",
    description: "Process 10 million input tokens",
    emoji: "\u{1F4DA}",
    trigger: "usage",
    check: (s) => s.totalInputTokens >= 10_000_000,
  },
  {
    slug: "100m-input",
    title: "100M Input",
    description: "Process 100 million input tokens",
    emoji: "\u{1F9E0}",
    trigger: "usage",
    check: (s) => s.totalInputTokens >= 100_000_000,
  },
  {
    slug: "1b-cache",
    title: "1B Cache",
    description: "Use 1 billion cache tokens",
    emoji: "\u{1F4BE}",
    trigger: "usage",
    check: (s) => s.totalCacheTokens >= 1_000_000_000,
  },
  {
    slug: "5b-cache",
    title: "5B Cache",
    description: "Use 5 billion cache tokens",
    emoji: "\u{1F5C4}\uFE0F",
    trigger: "usage",
    check: (s) => s.totalCacheTokens >= 5_000_000_000,
  },
  {
    slug: "20b-cache",
    title: "20B Cache",
    description: "Use 20 billion cache tokens",
    emoji: "\u{1F3ED}",
    trigger: "usage",
    check: (s) => s.totalCacheTokens >= 20_000_000_000,
  },
  {
    slug: "session-surge",
    title: "Session Surge",
    description: "Log 1,000 sessions",
    emoji: "\u{1F300}",
    trigger: "usage",
    check: (s) => s.totalSessions >= 1_000,
  },
  {
    slug: "power-session",
    title: "Power Session",
    description: "Spend $100 in a single day",
    emoji: "\u{1F4A5}",
    trigger: "usage",
    check: (s) => s.maxDailyCost >= 100,
  },
  {
    slug: "verified-contributor",
    title: "Verified Contributor",
    description: "Push 50 verified syncs",
    emoji: "\u{2705}",
    trigger: "usage",
    check: (s) => s.verifiedSyncCount >= 50,
  },
  {
    slug: "kudos-received-1",
    title: "First Kudos",
    description: "Receive your first kudos",
    emoji: "\u{1F44D}",
    trigger: "kudos",
    check: (s) => s.kudosReceived >= 1,
  },
  {
    slug: "kudos-received-25",
    title: "Appreciated",
    description: "Receive 25 kudos on your posts",
    emoji: "\u{2B50}",
    trigger: "kudos",
    check: (s) => s.kudosReceived >= 25,
  },
  {
    slug: "kudos-received-100",
    title: "Community Favorite",
    description: "Receive 100 kudos on your posts",
    emoji: "\u{1F31F}",
    trigger: "kudos",
    check: (s) => s.kudosReceived >= 100,
  },
  {
    slug: "kudos-received-500",
    title: "Beloved",
    description: "Receive 500 kudos on your posts",
    emoji: "\u{1F49B}",
    trigger: "kudos",
    check: (s) => s.kudosReceived >= 500,
  },
  {
    slug: "kudos-sent-1",
    title: "First High Five",
    description: "Give your first kudos",
    emoji: "\u{1F64C}",
    trigger: "kudos",
    check: (s) => s.kudosSent >= 1,
  },
  {
    slug: "kudos-sent-25",
    title: "Supporter",
    description: "Give 25 kudos to others",
    emoji: "\u{1F91D}",
    trigger: "kudos",
    check: (s) => s.kudosSent >= 25,
  },
  {
    slug: "kudos-sent-100",
    title: "Kudos Giver",
    description: "Give 100 kudos to others",
    emoji: "\u{1F4AA}",
    trigger: "kudos",
    check: (s) => s.kudosSent >= 100,
  },
  {
    slug: "kudos-sent-500",
    title: "Hype Machine",
    description: "Give 500 kudos to others",
    emoji: "\u{1F514}",
    trigger: "kudos",
    check: (s) => s.kudosSent >= 500,
  },
  {
    slug: "comments-received-1",
    title: "First Reply",
    description: "Receive your first comment",
    emoji: "\u{1F4AC}",
    trigger: "comment",
    check: (s) => s.commentsReceived >= 1,
  },
  {
    slug: "comments-received-25",
    title: "Conversation Starter",
    description: "Receive 25 comments on your posts",
    emoji: "\u{1F5E3}\uFE0F",
    trigger: "comment",
    check: (s) => s.commentsReceived >= 25,
  },
  {
    slug: "comments-received-100",
    title: "Discussion Magnet",
    description: "Receive 100 comments on your posts",
    emoji: "\u{1F9F2}",
    trigger: "comment",
    check: (s) => s.commentsReceived >= 100,
  },
  {
    slug: "comments-received-500",
    title: "Town Square",
    description: "Receive 500 comments on your posts",
    emoji: "\u{1F4E2}",
    trigger: "comment",
    check: (s) => s.commentsReceived >= 500,
  },
  {
    slug: "comments-sent-1",
    title: "First Comment",
    description: "Leave your first comment",
    emoji: "\u{270D}\uFE0F",
    trigger: "comment",
    check: (s) => s.commentsSent >= 1,
  },
  {
    slug: "comments-sent-25",
    title: "Active Voice",
    description: "Leave 25 comments",
    emoji: "\u{1F4DD}",
    trigger: "comment",
    check: (s) => s.commentsSent >= 25,
  },
  {
    slug: "comments-sent-100",
    title: "Prolific Commenter",
    description: "Leave 100 comments",
    emoji: "\u{1F58A}\uFE0F",
    trigger: "comment",
    check: (s) => s.commentsSent >= 100,
  },
  {
    slug: "comments-sent-500",
    title: "Never Silent",
    description: "Leave 500 comments",
    emoji: "\u{1F3A4}",
    trigger: "comment",
    check: (s) => s.commentsSent >= 500,
  },
];

function fetchIf<T>(condition: boolean, fn: () => PromiseLike<T>): Promise<T | null> {
  return condition ? Promise.resolve(fn()) : Promise.resolve(null);
}

/**
 * Check and award achievements for a user, filtered by trigger type.
 * Called fire-and-forget from API routes after relevant data changes.
 *
 * - "usage" trigger: called from POST /api/usage/submit
 * - "kudos" trigger: called from POST /api/posts/[id]/kudos (for both giver and post owner)
 * - "comment" trigger: called from POST /api/posts/[id]/comments (for both commenter and post owner)
 */
export async function checkAndAwardAchievements(
  userId: string,
  trigger?: AchievementTrigger,
): Promise<void> {
  const db = getServiceClient();

  const candidates = trigger
    ? ACHIEVEMENTS.filter((a) => a.trigger === trigger)
    : ACHIEVEMENTS;

  if (candidates.length === 0) return;

  const { data: earned } = await db
    .from("user_achievements")
    .select("achievement_slug")
    .eq("user_id", userId);

  const earnedSlugs = new Set(earned?.map((r) => r.achievement_slug) ?? []);

  const needs = (...triggers: AchievementTrigger[]) =>
    !trigger || triggers.includes(trigger);

  const [usageResult, streakResult, socialResult] = await Promise.all([
    fetchIf(needs("usage"), () => db.rpc("get_achievement_stats", { p_user_id: userId }).single()),
    fetchIf(needs("usage"), () => db.rpc("calculate_user_streak", { p_user_id: userId })),
    fetchIf(needs("kudos", "comment"), () => db.rpc("get_social_achievement_stats", { p_user_id: userId }).single()),
  ]);

  const usageRow = usageResult?.data as Record<string, unknown> | null;
  const socialRow = socialResult?.data as Record<string, unknown> | null;

  const stats: AchievementStats = {
    totalCost: Number(usageRow?.total_cost ?? 0),
    totalOutputTokens: Number(usageRow?.total_output_tokens ?? 0),
    totalInputTokens: Number(usageRow?.total_input_tokens ?? 0),
    totalCacheTokens: Number(usageRow?.total_cache_tokens ?? 0),
    totalSessions: Number(usageRow?.total_sessions ?? 0),
    maxDailyCost: Number(usageRow?.max_daily_cost ?? 0),
    streak: (streakResult?.data as number) ?? 0,
    syncCount: Number(usageRow?.sync_count ?? 0),
    verifiedSyncCount: Number(usageRow?.verified_sync_count ?? 0),
    // Self-interactions (kudos/comments on own posts) are counted intentionally.
    kudosReceived: Number(socialRow?.kudos_received ?? 0),
    kudosSent: Number(socialRow?.kudos_sent ?? 0),
    commentsReceived: Number(socialRow?.comments_received ?? 0),
    commentsSent: Number(socialRow?.comments_sent ?? 0),
  };

  const newAwards = candidates.filter(
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
