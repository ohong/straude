import { getServiceClient } from "@/lib/supabase/service";
import { getResend } from "./resend";
import { createUnsubscribeToken } from "./unsubscribe";
import WeeklyDigestEmail from "./weekly-digest-email";

interface WeeklyDigestResult {
  dryRun: boolean;
  sent: number;
  skipped: number;
  eligible: number;
  errors?: string[];
  weeklySpend: string;
  leaderboard: { rank: number; username: string; spend: string }[];
  /** Sample of eligible usernames (first 10) for dry-run inspection */
  preview?: string[];
}

/**
 * Fetch the top 5 users by spend in the last 7 days.
 */
async function getWeeklyLeaderboard(db: ReturnType<typeof getServiceClient>) {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await db.rpc("get_weekly_leaderboard", {
    since_date: sevenDaysAgo,
    limit_count: 5,
  });

  // Fallback: query directly if RPC doesn't exist
  if (error) {
    const { data: fallback } = await db
      .from("daily_usage")
      .select("user_id, cost_usd")
      .gte("usage_date", sevenDaysAgo.split("T")[0]);

    if (!fallback || fallback.length === 0) return { entries: [], totalSpend: 0 };

    // Aggregate by user
    const byUser = new Map<string, number>();
    let totalSpend = 0;
    for (const row of fallback) {
      const cost = Number(row.cost_usd) || 0;
      totalSpend += cost;
      byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + cost);
    }

    // Sort and take top 5
    const sorted = [...byUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Fetch usernames
    const userIds = sorted.map(([id]) => id);
    const { data: users } = await db
      .from("users")
      .select("id, username")
      .in("id", userIds);

    const usernameMap = new Map(
      (users ?? []).map((u) => [u.id, u.username ?? "anonymous"]),
    );

    const entries = sorted.map(([id, spend], i) => ({
      rank: i + 1,
      username: usernameMap.get(id) ?? "anonymous",
      spend: `$${spend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    }));

    return { entries, totalSpend };
  }

  // RPC succeeded
  let totalSpend = 0;
  const entries = (data ?? []).map(
    (row: { username: string; total_spend: number }, i: number) => {
      totalSpend += Number(row.total_spend) || 0;
      return {
        rank: i + 1,
        username: row.username ?? "anonymous",
        spend: `$${Number(row.total_spend).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      };
    },
  );

  return { entries, totalSpend };
}

/**
 * Send (or dry-run) the weekly digest email to all unactivated users
 * with email_notifications enabled.
 *
 * This is a ONE-TIME activation blast, not a recurring cron.
 * Always dry-run first to inspect the data before sending.
 */
export async function sendWeeklyDigest(
  dryRun: boolean,
): Promise<WeeklyDigestResult> {
  const db = getServiceClient();

  // Get weekly leaderboard data
  const { entries: leaderboard, totalSpend } = await getWeeklyLeaderboard(db);
  const weeklySpend = `$${Math.round(totalSpend).toLocaleString("en-US")}`;

  // Find unactivated users: have account, email_notifications=true, no daily_usage rows
  const { data: candidates, error: queryError } = await db
    .from("users")
    .select("id, username")
    .eq("email_notifications", true);

  if (queryError) throw new Error(`Query failed: ${queryError.message}`);
  if (!candidates || candidates.length === 0) {
    return { dryRun, sent: 0, skipped: 0, eligible: 0, weeklySpend, leaderboard };
  }

  // Filter out users who have any daily_usage rows
  const userIds = candidates.map((u) => u.id);
  const { data: usageRows } = await db
    .from("daily_usage")
    .select("user_id")
    .in("user_id", userIds);

  const usersWithUsage = new Set((usageRows ?? []).map((r) => r.user_id));
  const eligibleUsers = candidates.filter((u) => !usersWithUsage.has(u.id));

  if (eligibleUsers.length === 0) {
    return {
      dryRun,
      sent: 0,
      skipped: candidates.length,
      eligible: 0,
      weeklySpend,
      leaderboard,
    };
  }

  // Dry run: return what would happen without sending
  if (dryRun) {
    return {
      dryRun: true,
      sent: 0,
      skipped: candidates.length - eligibleUsers.length,
      eligible: eligibleUsers.length,
      weeklySpend,
      leaderboard,
      preview: eligibleUsers.slice(0, 10).map((u) => u.username ?? u.id),
    };
  }

  // --- Actual send ---
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY not configured");
  if (!process.env.UNSUBSCRIBE_SECRET)
    throw new Error("UNSUBSCRIBE_SECRET not configured");

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";
  const leaderboardUrl = `${appUrl}/leaderboard`;

  // Use ISO date for idempotency
  const weekDate = new Date().toISOString().split("T")[0];

  let sent = 0;
  const errors: string[] = [];

  for (const user of eligibleUsers) {
    const { data: authData } = await db.auth.admin.getUserById(user.id);
    const email = authData?.user?.email;
    if (!email) {
      errors.push(`${user.id}: no email found`);
      continue;
    }

    const displayName = user.username ?? "there";
    const unsubscribeToken = createUnsubscribeToken(user.id);
    const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;

    try {
      await resend.emails.send({
        from: `Straude <${fromEmail}>`,
        replyTo: "hey@straude.com",
        to: email,
        subject: `This week on Straude: ${weeklySpend} logged`,
        react: WeeklyDigestEmail({
          username: displayName,
          leaderboard,
          leaderboardUrl,
          unsubscribeUrl,
        }),
        headers: {
          "Idempotency-Key": `weekly-digest/${user.id}/${weekDate}`,
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [{ name: "type", value: "weekly-digest" }],
      });
      sent++;
    } catch (err) {
      errors.push(
        `${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    dryRun: false,
    sent,
    skipped: candidates.length - eligibleUsers.length,
    eligible: eligibleUsers.length,
    errors: errors.length > 0 ? errors : undefined,
    weeklySpend,
    leaderboard,
  };
}
