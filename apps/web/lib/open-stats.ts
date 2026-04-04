import { getServiceClient } from "@/lib/supabase/service";

export const OPEN_STATS_REVALIDATE_SECONDS = 86_400;

const OPEN_STATS_SNAPSHOT_TABLE = "open_stats_snapshots";
const DAY_MS = 86_400_000;

export type OpenStatsSource = "live" | "snapshot";

export interface ConcentrationRow {
  segment: string;
  user_count: number;
  total_spend: number;
  pct_of_total: number;
}

export interface ModelEntry {
  name: string;
  pct: number;
}

export interface OpenStats {
  trackedUsers: number;
  totalUsers: number;
  totalSpend: number;
  avgWeeklySpend: number;
  totalTokens: number;
  totalSessions: number;
  avgStreak: number;
  concentration: ConcentrationRow[];
  cumulativePct: Record<string, number>;
  models: ModelEntry[];
  fetchedAt: string;
  snapshotDate: string;
  source: OpenStatsSource;
}

type UsageRow = {
  session_count: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  user_id: string | null;
  date: string | null;
  model_breakdown: unknown;
};

type SnapshotRow = {
  snapshot_date: string;
  captured_at: string | null;
  stats: unknown;
};

type SupabaseErrorLike = {
  message: string;
  code?: string | null;
  hint?: string | null;
  details?: string | null;
} | null;

export type OpenStatsDb = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

function snapshotDateFromIso(iso: string) {
  return iso.slice(0, 10);
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value ?? 0) || 0;
}

function normalizeConcentrationRows(value: unknown): ConcentrationRow[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;

    return [
      {
        segment: String(record.segment ?? ""),
        user_count: normalizeNumber(record.user_count),
        total_spend: normalizeNumber(record.total_spend),
        pct_of_total: normalizeNumber(record.pct_of_total),
      },
    ];
  });
}

function normalizeModelEntries(value: unknown): ModelEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";

    if (!name) return [];

    return [
      {
        name,
        pct: normalizeNumber(record.pct),
      },
    ];
  });
}

function normalizeOpenStats(
  value: unknown,
  options?: {
    fallbackFetchedAt?: string | null;
    fallbackSnapshotDate?: string | null;
    source?: OpenStatsSource;
  },
): OpenStats | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const fetchedAt =
    typeof record.fetchedAt === "string" && record.fetchedAt
      ? record.fetchedAt
      : options?.fallbackFetchedAt || new Date().toISOString();
  const snapshotDate =
    typeof record.snapshotDate === "string" && record.snapshotDate
      ? record.snapshotDate
      : options?.fallbackSnapshotDate || snapshotDateFromIso(fetchedAt);

  return {
    trackedUsers: normalizeNumber(record.trackedUsers ?? record.uniqueUsers),
    totalUsers: normalizeNumber(record.totalUsers ?? record.uniqueUsers),
    totalSpend: normalizeNumber(record.totalSpend),
    avgWeeklySpend: normalizeNumber(record.avgWeeklySpend),
    totalTokens: normalizeNumber(record.totalTokens),
    totalSessions: normalizeNumber(record.totalSessions),
    avgStreak: normalizeNumber(record.avgStreak),
    concentration: normalizeConcentrationRows(record.concentration),
    cumulativePct:
      record.cumulativePct && typeof record.cumulativePct === "object"
        ? Object.fromEntries(
            Object.entries(record.cumulativePct as Record<string, unknown>).map(
              ([key, entryValue]) => [key, normalizeNumber(entryValue)],
            ),
          )
        : {},
    models: normalizeModelEntries(record.models),
    fetchedAt,
    snapshotDate,
    source: options?.source ?? "live",
  };
}

function throwIfSupabaseError(label: string, error: SupabaseErrorLike) {
  if (!error) return;

  const details = [error.message, error.code, error.hint, error.details]
    .filter(Boolean)
    .join(" | ");

  throw new Error(`${label}: ${details}`);
}

export function prettifyModel(model: string): string {
  const normalized = model.trim();
  if (/claude-opus-4/i.test(normalized)) return "Claude Opus";
  if (/claude-sonnet-4/i.test(normalized)) return "Claude Sonnet";
  if (/claude-haiku-4/i.test(normalized)) return "Claude Haiku";
  if (/^gpt-/i.test(normalized)) {
    return normalized.replace(/^gpt/i, "GPT").replace(/-codex$/i, "-Codex");
  }
  if (/^o4/i.test(normalized)) return "o4";
  if (/^o3/i.test(normalized)) return "o3";
  // Gemini family: "gemini-3.1-pro-preview" → "Gemini 3.1 Pro"
  if (/^gemini-/i.test(normalized)) {
    return normalized
      .replace(/^gemini-/i, "Gemini ")
      .replace(/-preview.*$/, "")
      .replace(/-exp.*$/, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  if (normalized.includes("opus")) return "Claude Opus";
  if (normalized.includes("sonnet")) return "Claude Sonnet";
  if (normalized.includes("haiku")) return "Claude Haiku";
  return normalized;
}

function buildOpenStats(params: {
  usageRows: UsageRow[];
  concentrationRows: unknown;
  growthRows: unknown;
  fetchedAt: string;
  source: OpenStatsSource;
  totalSpendOverride?: number;
}): OpenStats {
  const { usageRows, concentrationRows, growthRows, fetchedAt, source } = params;

  let totalSessions = 0;
  let totalTokens = 0;
  let totalSpend = 0;
  const datesByUser = new Map<string, string[]>();
  const modelCostMap = new Map<string, number>();

  for (const row of usageRows) {
    totalSessions += row.session_count ?? 0;
    totalTokens += row.total_tokens ?? 0;
    totalSpend += row.cost_usd ?? 0;

    if (row.user_id && row.date) {
      const dates = datesByUser.get(row.user_id) ?? [];
      dates.push(row.date);
      datesByUser.set(row.user_id, dates);
    }

    if (row.model_breakdown && Array.isArray(row.model_breakdown)) {
      for (const entry of row.model_breakdown as Array<Record<string, unknown>>) {
        const model = typeof entry.model === "string" ? entry.model : "";
        const cost = normalizeNumber(entry.cost_usd);
        if (!model || cost <= 0) continue;
        const name = prettifyModel(model);
        modelCostMap.set(name, (modelCostMap.get(name) ?? 0) + cost);
      }
    }
  }

  const trackedUsers = datesByUser.size;
  let totalStreaks = 0;

  for (const [, dates] of datesByUser) {
    const sorted = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    let streak = 1;
    for (let index = 1; index < sorted.length; index += 1) {
      const prev = new Date(sorted[index - 1]).getTime();
      const current = new Date(sorted[index]).getTime();
      if (prev - current <= DAY_MS) {
        streak += 1;
      } else {
        break;
      }
    }
    totalStreaks += streak;
  }

  const avgStreak =
    trackedUsers > 0 ? Math.round(totalStreaks / trackedUsers) : 0;

  const allDates = usageRows.map((row) => row.date).filter(Boolean) as string[];
  let weeksOfData = 1;
  if (allDates.length > 1) {
    const sorted = [...allDates].sort();
    const earliest = new Date(sorted[0]).getTime();
    const latest = new Date(sorted[sorted.length - 1]).getTime();
    weeksOfData = Math.max(1, (latest - earliest) / (7 * DAY_MS));
  }

  const effectiveSpend = params.totalSpendOverride ?? totalSpend;

  const avgWeeklySpend =
    trackedUsers > 0 ? effectiveSpend / trackedUsers / weeksOfData : 0;

  const concentration = normalizeConcentrationRows(concentrationRows);
  const cumulativePct: Record<string, number> = {};
  let runningPct = 0;
  for (const segment of ["top_1", "top_5", "top_10"]) {
    const row = concentration.find((entry) => entry.segment === segment);
    if (row) runningPct += row.pct_of_total;
    cumulativePct[segment] = Math.round(runningPct);
  }

  const totalModelCost = [...modelCostMap.values()].reduce(
    (sum, cost) => sum + cost,
    0,
  );
  const models: ModelEntry[] = [...modelCostMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, cost]) => ({
      name,
      pct: totalModelCost > 0 ? Math.round((cost / totalModelCost) * 100) : 0,
    }))
    .filter((entry) => entry.pct > 0);

  const normalizedGrowthRows = Array.isArray(growthRows) ? growthRows : [];
  const latestGrowth =
    normalizedGrowthRows.length > 0
      ? (normalizedGrowthRows[normalizedGrowthRows.length - 1] as Record<
          string,
          unknown
        >)
      : null;
  const cumulativeUsers = latestGrowth
    ? normalizeNumber(latestGrowth.cumulative_users)
    : trackedUsers;

  return {
    trackedUsers,
    totalUsers: cumulativeUsers || trackedUsers,
    totalSpend: effectiveSpend,
    avgWeeklySpend,
    totalTokens,
    totalSessions,
    avgStreak,
    concentration,
    cumulativePct,
    models,
    fetchedAt,
    snapshotDate: snapshotDateFromIso(fetchedAt),
    source,
  };
}

async function fetchLiveOpenStats(db: OpenStatsDb): Promise<OpenStats> {
  const [usageResult, concentrationResult, growthResult, spendResult] = await Promise.all([
    db
      .from("daily_usage")
      .select(
        "session_count, total_tokens, cost_usd, user_id, date, model_breakdown",
      )
      .order("date", { ascending: false })
      .range(0, 49999),
    db.rpc("admin_revenue_concentration"),
    db.rpc("admin_growth_metrics"),
    db.rpc("admin_cumulative_spend"),
  ]);

  throwIfSupabaseError("open stats daily_usage query failed", usageResult.error);
  throwIfSupabaseError(
    "open stats revenue concentration query failed",
    concentrationResult.error,
  );
  throwIfSupabaseError(
    "open stats growth metrics query failed",
    growthResult.error,
  );
  throwIfSupabaseError(
    "open stats cumulative spend query failed",
    spendResult.error,
  );

  const usageRows = Array.isArray(usageResult.data)
    ? (usageResult.data as UsageRow[])
    : [];

  if (usageRows.length === 0) {
    throw new Error("open stats daily_usage query returned no rows");
  }

  const spendRows = Array.isArray(spendResult.data) ? spendResult.data as Array<{ cumulative_total: number | string }> : [];
  const totalSpendFromRpc = spendRows.length > 0
    ? Number(spendRows[spendRows.length - 1].cumulative_total)
    : undefined;

  return buildOpenStats({
    usageRows,
    concentrationRows: concentrationResult.data,
    growthRows: growthResult.data,
    fetchedAt: new Date().toISOString(),
    source: "live",
    totalSpendOverride: totalSpendFromRpc,
  });
}

async function readLatestOpenStatsSnapshot(db: OpenStatsDb): Promise<OpenStats | null> {
  const result = await db
    .from(OPEN_STATS_SNAPSHOT_TABLE)
    .select("snapshot_date, captured_at, stats")
    .order("snapshot_date", { ascending: false })
    .limit(1);

  throwIfSupabaseError("open stats snapshot read failed", result.error);

  const row = Array.isArray(result.data)
    ? ((result.data[0] as SnapshotRow | undefined) ?? null)
    : null;
  if (!row) return null;

  return normalizeOpenStats(row.stats, {
    fallbackFetchedAt: row.captured_at,
    fallbackSnapshotDate: row.snapshot_date,
    source: "snapshot",
  });
}

async function persistOpenStatsSnapshot(db: OpenStatsDb, stats: OpenStats) {
  const snapshot = {
    ...stats,
    source: "live" as const,
  };

  const result = await db.from(OPEN_STATS_SNAPSHOT_TABLE).upsert(
    {
      snapshot_date: stats.snapshotDate,
      captured_at: stats.fetchedAt,
      stats: snapshot,
    },
    { onConflict: "snapshot_date" },
  );

  throwIfSupabaseError("open stats snapshot write failed", result.error);
}

export async function getOpenStatsForPage(
  db: OpenStatsDb = getServiceClient(),
): Promise<OpenStats> {
  try {
    const liveStats = await fetchLiveOpenStats(db);

    try {
      await persistOpenStatsSnapshot(db, liveStats);
    } catch (error) {
      console.error(error);
    }

    return liveStats;
  } catch (liveError) {
    try {
      const snapshot = await readLatestOpenStatsSnapshot(db);
      if (snapshot) return snapshot;
    } catch (snapshotError) {
      console.error("open stats snapshot fallback failed:", snapshotError);
    }

    // Both live and snapshot failed (e.g. Supabase unreachable in CI).
    // Return an empty placeholder so the build doesn't crash.
    console.error("open stats: all sources failed, returning placeholder", liveError);
    const now = new Date().toISOString();
    return {
      trackedUsers: 0,
      totalUsers: 0,
      totalSpend: 0,
      avgWeeklySpend: 0,
      totalTokens: 0,
      totalSessions: 0,
      avgStreak: 0,
      concentration: [],
      cumulativePct: {},
      models: [],
      fetchedAt: now,
      snapshotDate: snapshotDateFromIso(now),
      source: "snapshot",
    };
  }
}
