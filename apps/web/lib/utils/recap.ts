import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecapData {
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
  "claude-opus-4": "Claude Opus",
  "claude-sonnet-4": "Claude Sonnet",
  "claude-haiku-4": "Claude Haiku",
};

function resolveModelName(raw: string): string {
  // Match against known prefixes (e.g. "claude-sonnet-4-20250514" → "Claude Sonnet")
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

function getPeriodRange(period: "week" | "month"): {
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
      start: formatDate(monday),
      end: formatDate(sunday),
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
    start: formatDate(firstDay),
    end: formatDate(lastDay),
    totalDays: lastDay.getDate(),
    label: `My Month in Claude Code · ${monthName}`,
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getRecapData(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  isPublic: boolean,
  period: "week" | "month"
): Promise<RecapData> {
  const { start, end, totalDays, label } = getPeriodRange(period);

  const [{ data: usageRows }, { data: streakData }] = await Promise.all([
    supabase
      .from("daily_usage")
      .select("date, cost_usd, output_tokens, session_count, models")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date"),
    supabase.rpc("calculate_user_streak", { p_user_id: userId }),
  ]);

  const rows = usageRows ?? [];

  let totalCost = 0;
  let outputTokens = 0;
  let sessionCount = 0;
  const modelCounts = new Map<string, number>();
  const contributionData: { date: string; cost_usd: number }[] = [];

  for (const row of rows) {
    const cost = Number(row.cost_usd);
    totalCost += cost;
    outputTokens += Number(row.output_tokens);
    sessionCount += Number(row.session_count);
    contributionData.push({ date: row.date, cost_usd: cost });

    for (const model of row.models ?? []) {
      modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
    }
  }

  // Resolve primary model
  let primaryModel = "Claude Sonnet";
  if (modelCounts.size > 0) {
    const topModel = [...modelCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]![0];
    primaryModel = resolveModelName(topModel);
  }

  return {
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
