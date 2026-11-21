import type { SupabaseClient } from "@supabase/supabase-js";
import { firstRelation } from "./first-relation";
import { formatDateKey } from "@/lib/utils/dates";

export interface BuildHighlight { id: string; title: string }

export interface RecapData {
  highlight?: BuildHighlight;
  highlight_options?: BuildHighlight[];
  week_start?: string;
  personal_review?: import("./personal-review").PersonalWeeklyReview | null;
  total_cost: number;
  output_tokens: number;
  active_days: number;
  total_days: number;
  session_count: number;
  streak: number;
  primary_model: string;
  contribution_data: { date: string; cost_usd: number }[];
  period_label: string;
  period: "week" | "month";
  username: string;
  is_public: boolean;
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-fable": "Claude Fable",
  "claude-opus": "Claude Opus",
  "claude-sonnet": "Claude Sonnet",
  "claude-haiku": "Claude Haiku",
};

function resolveModelName(raw: string): string {
  // Match against known prefixes (e.g. "claude-sonnet-20250514" → "Claude Sonnet")
  for (const [prefix, display] of Object.entries(MODEL_DISPLAY_NAMES)) {
    if (raw.startsWith(prefix)) return display;
  }
  // Fallback: capitalize first letter of each word
  return raw
    .replace(/-/g, " ")
    .replace(/\d{8}$/, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPeriodRange(period: "week" | "month"): {
  start: string;
  end: string;
  totalDays: number;
  label: string;
} {
  const now = new Date();

  if (period === "week") {
    // Current week: Monday through Sunday
    const day = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const yearSuffix =
      monday.getFullYear() !== sunday.getFullYear()
        ? ""
        : `, ${now.getFullYear()}`;

    return {
      start: formatDateKey(monday),
      end: formatDateKey(sunday),
      totalDays: 7,
      label: `My Week in Claude Code · ${fmt(monday)}–${fmt(sunday)}${yearSuffix}`,
    };
  }

  // Month
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthName = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    start: formatDateKey(firstDay),
    end: formatDateKey(lastDay),
    totalDays: lastDay.getDate(),
    label: `My Month in Claude Code · ${monthName}`,
  };
}

/**
 * Fill in missing days with $0 entries — only up to today (no future days).
 * Used by the recap card components and the OG image renderer to produce a
 * complete contribution strip for the current week or month.
 */
export function fillContributionDays(
  data: { date: string; cost_usd: number }[],
  totalDays: number,
  period: "week" | "month",
): { date: string; cost_usd: number }[] {
  const lookup = new Map(data.map((d) => [d.date, d.cost_usd]));
  const now = new Date();
  let start: Date;

  if (period === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Cap at today — don't render future days
  const msPerDay = 86400000;
  const daysSinceStart =
    Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  const cappedDays = Math.min(totalDays, daysSinceStart);

  const result: { date: string; cost_usd: number }[] = [];
  for (let i = 0; i < cappedDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({ date: key, cost_usd: lookup.get(key) ?? 0 });
  }
  return result;
}

export async function getRecapData(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  isPublic: boolean,
  period: "week" | "month",
  streakFreezes: number = 0,
  includeHighlightOptions = false
): Promise<RecapData> {
  const { start, end, totalDays, label } = getPeriodRange(period);

  const fields = "date, cost_usd, output_tokens, session_count, models";
  const weeklyFields = `${fields}, posts!posts_daily_usage_id_fkey(id,title,description,images,usage_generated_title,weekly_build_highlights(week_start))`;
  const [{ data: usageRows, error: usageError }, { data: streakData, error: streakError }] = await Promise.all([
    supabase
      .from("daily_usage")
      .select(period === "week" ? weeklyFields : fields)
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date"),
    supabase.rpc("calculate_user_streak", {
      p_user_id: userId,
      p_freeze_days: streakFreezes,
    }),
  ]);

  if (usageError || streakError) throw new Error("Unable to load recap statistics.");
  type RecapDay = { date: string; cost_usd: number; output_tokens: number; session_count: number; models: string[];
    posts?: { id: string; title: string | null; description: string | null; images: string[]; usage_generated_title: boolean;
      weekly_build_highlights: { week_start: string } | { week_start: string }[] | null } };
  const rows = (usageRows ?? []) as unknown as RecapDay[];
  let highlight: BuildHighlight | undefined;
  const options: BuildHighlight[] = [];

  let totalCost = 0;
  let outputTokens = 0;
  let sessionCount = 0;
  const modelCounts = new Map<string, number>();
  const contributionData: { date: string; cost_usd: number }[] = [];

  for (const row of rows) {
    const cost = Number(row.cost_usd);
    const post = firstRelation(row.posts);
    if (post) {
      const title = (!post.usage_generated_title && post.title?.trim()) || post.description?.trim().slice(0, 100)
        || (post.images?.length ? `Screenshot from ${row.date}` : "");
      if (title) {
        const choice = { id: post.id, title };
        if (includeHighlightOptions) options.push(choice);
        if (firstRelation(post.weekly_build_highlights)?.week_start === start) highlight = choice;
      }
    }
    totalCost += cost;
    outputTokens += Number(row.output_tokens);
    sessionCount += Number(row.session_count);
    contributionData.push({ date: row.date, cost_usd: cost });

    for (const model of row.models ?? []) {
      modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
    }
  }

  // Resolve primary model
  let primaryModel = "";
  if (modelCounts.size > 0) {
    const topModel = [...modelCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]![0];
    primaryModel = resolveModelName(topModel);
  }

  return {
    ...(period === "week" ? { highlight, week_start: start } : {}),
    ...(includeHighlightOptions && period === "week" ? { highlight_options: options } : {}),
    total_cost: totalCost,
    output_tokens: outputTokens,
    active_days: rows.length,
    total_days: totalDays,
    session_count: sessionCount,
    streak: typeof streakData === "number" ? streakData : 0,
    primary_model: primaryModel,
    contribution_data: contributionData,
    period_label: label,
    period,
    username,
    is_public: isPublic,
  };
}
