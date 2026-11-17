import { prettifyModel } from "@straude/shared/models";
import { getServiceClient } from "@/lib/supabase/service";

const OPEN_STATS_SNAPSHOT_TABLE = "open_stats_snapshots";
const DAY_MS = 86_400_000;
const USAGE_PAGE_SIZE = 1000;
const SEED_USER_PREFIX = "a0000000-0000-4000-8000-";
export const OPEN_STATS_STALE_AFTER_HOURS = 48;

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
  totalStreaks: number;
  concentration: ConcentrationRow[];
  concentrationBasis?: "percentiles" | "users";
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

type SupabaseResult<T = unknown> = {
  data: T | null;
  error: SupabaseErrorLike;
  count?: number | null;
};

type OpenStatsQueryResult = PromiseLike<SupabaseResult> & {
  order: (...args: unknown[]) => OpenStatsQueryResult;
  range: (...args: unknown[]) => OpenStatsQueryResult;
  limit: (...args: unknown[]) => OpenStatsQueryResult;
};

type OpenStatsTable = {
  select: (...args: unknown[]) => OpenStatsQueryResult;
  upsert: (...args: unknown[]) => PromiseLike<SupabaseResult>;
};

export type OpenStatsDb = {
  from: (table: string) => OpenStatsTable;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<SupabaseResult>;
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
  // The durable row is authoritative. Never give missing data a new capture time.
  const fetchedAt = options?.fallbackFetchedAt ||
    (typeof record.fetchedAt === "string" ? record.fetchedAt : "");
  if (!fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) return null;
  const snapshotDate = options?.fallbackSnapshotDate ||
    (typeof record.snapshotDate === "string" && record.snapshotDate
      ? record.snapshotDate
      : snapshotDateFromIso(fetchedAt));

  return {
    trackedUsers: normalizeNumber(record.trackedUsers ?? record.uniqueUsers),
    totalUsers: normalizeNumber(record.totalUsers ?? record.uniqueUsers),
    totalSpend: normalizeNumber(record.totalSpend),
    avgWeeklySpend: normalizeNumber(record.avgWeeklySpend),
    totalTokens: normalizeNumber(record.totalTokens),
    totalSessions: normalizeNumber(record.totalSessions),
    avgStreak: normalizeNumber(record.avgStreak),
    totalStreaks: normalizeNumber(record.totalStreaks),
    concentration: normalizeConcentrationRows(record.concentration),
    // Historical snapshots used rank buckets (people), despite percentage labels.
    concentrationBasis: record.concentrationBasis === "percentiles" ? "percentiles" : "users",
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

function isLocalSupabaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    (message.includes("127.0.0.1:54321") ||
      message.includes("localhost:54321")) &&
    (message.includes("ECONNREFUSED") || message.includes("fetch failed"))
  );
}

function logOpenStatsError(message: string, error: unknown) {
  if (isLocalSupabaseConnectionError(error)) return;
  console.error(message, error);
}

function buildOpenStats(params: {
  usageRows: UsageRow[];
  growthRows: unknown;
  fetchedAt: string;
  source: OpenStatsSource;
}): OpenStats {
  const { usageRows, growthRows, fetchedAt, source } = params;

  let totalSessions = 0;
  let totalTokens = 0;
  let totalSpend = 0;
  const datesByUser = new Map<string, string[]>();
  const modelCostMap = new Map<string, number>();
  const spendByUser = new Map<string, number>();

  for (const row of usageRows) {
    totalSessions += row.session_count ?? 0;
    totalTokens += row.total_tokens ?? 0;
    totalSpend += row.cost_usd ?? 0;

    if (row.user_id && row.date) {
      const dates = datesByUser.get(row.user_id) ?? [];
      dates.push(row.date);
      datesByUser.set(row.user_id, dates);
      spendByUser.set(row.user_id, (spendByUser.get(row.user_id) ?? 0) + (row.cost_usd ?? 0));
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

  const avgWeeklySpend =
    trackedUsers > 0 ? totalSpend / trackedUsers / weeksOfData : 0;

  // Disjoint percentile buckets; their cumulative percentages describe top 1/5/10%.
  const rankedSpend = [...spendByUser.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const concentration: ConcentrationRow[] = [];
  let previousEnd = 0;
  for (const [segment, fraction] of [["top_1", 0.01], ["top_5", 0.05], ["top_10", 0.1], ["rest", 1]] as const) {
    const end = Math.ceil(rankedSpend.length * fraction);
    const members = rankedSpend.slice(previousEnd, end);
    const spend = members.reduce((sum, [, cost]) => sum + cost, 0);
    concentration.push({
      segment,
      user_count: members.length,
      total_spend: spend,
      pct_of_total: totalSpend > 0 ? Math.round(spend / totalSpend * 1000) / 10 : 0,
    });
    previousEnd = end;
  }
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
    totalSpend,
    avgWeeklySpend,
    totalTokens,
    totalSessions,
    avgStreak,
    totalStreaks,
    concentration,
    concentrationBasis: "percentiles",
    cumulativePct,
    models,
    fetchedAt,
    snapshotDate: snapshotDateFromIso(fetchedAt),
    source,
  };
}

async function fetchLiveOpenStats(db: OpenStatsDb): Promise<OpenStats> {
  const usageRows: UsageRow[] = [];
  let offset = 0;
  let expectedCount: number | null = null;

  // A large range does not override PostgREST's row cap. Advance by the actual
  // returned length, with a unique ordering, so smaller server caps work too.
  for (;;) {
    const result = await db.from("daily_usage")
      .select("session_count, total_tokens, cost_usd, user_id, date, model_breakdown", { count: "exact" })
      .order("date", { ascending: true })
      .order("user_id", { ascending: true })
      .range(offset, offset + USAGE_PAGE_SIZE - 1);
    throwIfSupabaseError("open stats daily_usage query failed", result.error);
    const rows = Array.isArray(result.data) ? result.data as UsageRow[] : [];
    if (result.count == null) {
      throw new Error("open stats daily_usage query did not return an exact count");
    }
    if (expectedCount != null && expectedCount !== result.count) {
      throw new Error("open stats usage changed during pagination; retry refresh");
    }
    expectedCount = result.count;
    if (rows.length === 0) {
      if (offset !== expectedCount) {
        throw new Error("open stats daily_usage query returned an incomplete result");
      }
      break;
    }
    usageRows.push(...rows.filter(row => row.user_id && !row.user_id.startsWith(SEED_USER_PREFIX)));
    offset += rows.length;
    if (offset === expectedCount) break;
    if (offset > expectedCount) throw new Error("open stats daily_usage query exceeded its exact count");
  }

  if (usageRows.length === 0) {
    throw new Error("open stats daily_usage query returned no rows");
  }

  // This count uses the same seed exclusion; usage metrics all derive from the
  // paginated cohort instead of mixing independently capped RPC totals.
  const growthResult = await db.rpc("admin_growth_metrics");
  throwIfSupabaseError("open stats growth metrics query failed", growthResult.error);
  return buildOpenStats({
    usageRows,
    growthRows: growthResult.data,
    fetchedAt: new Date().toISOString(),
    source: "live",
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

function createPlaceholderOpenStats(): OpenStats {
  return {
    trackedUsers: 0,
    totalUsers: 0,
    totalSpend: 0,
    avgWeeklySpend: 0,
    totalTokens: 0,
    totalSessions: 0,
    avgStreak: 0,
    totalStreaks: 0,
    concentration: [],
    cumulativePct: {},
    models: [],
    fetchedAt: "",
    snapshotDate: "",
    source: "snapshot",
  };
}

export async function refreshOpenStatsSnapshot(
  db: OpenStatsDb = getServiceClient() as unknown as OpenStatsDb,
): Promise<OpenStats> {
  const liveStats = await fetchLiveOpenStats(db);

  // A refresh succeeds only when public readers can retrieve the new snapshot.
  await persistOpenStatsSnapshot(db, liveStats);

  return liveStats;
}

export async function getOpenStatsForPage(
  db: OpenStatsDb = getServiceClient() as unknown as OpenStatsDb,
): Promise<OpenStats> {
  try {
    const snapshot = await readLatestOpenStatsSnapshot(db);
    if (snapshot) return snapshot;
  } catch (snapshotError) {
    // TODO(observability): forward to PostHog server-side capture once a
    // helper exists (context: "open-stats:snapshot-read").
    logOpenStatsError("open stats snapshot read failed:", snapshotError);
  }

  // Public pages must not run live aggregation during render.
  // Return a coherent placeholder until the scheduled/admin refresh writes a
  // new durable snapshot.
  return createPlaceholderOpenStats();
}

export function getOpenStatsFreshness(stats: Pick<OpenStats, "fetchedAt">, now = Date.now()) {
  const capturedAt = Date.parse(stats.fetchedAt);
  if (!Number.isFinite(capturedAt) || capturedAt > now) {
    return { state: "unavailable" as const, ageHours: null };
  }
  const ageHours = (now - capturedAt) / (DAY_MS / 24);
  return {
    state: ageHours > OPEN_STATS_STALE_AFTER_HOURS ? "stale" as const : "fresh" as const,
    ageHours,
  };
}
