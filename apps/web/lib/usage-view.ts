export const USAGE_VIEW_MAX_DAYS = 90;
export const USAGE_WINDOW_DAYS = [7, 30, 90] as const;
export type UsageWindowDays = (typeof USAGE_WINDOW_DAYS)[number];
export type UsageMetric = "cost" | "tokens";

/** Rows synced before per-tool tracking; their tool is unknown. */
export const LEGACY_TOOL = "legacy-unpartitioned";

export interface UsageTokens {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  reasoning: number;
  /** Tokens with no known type: legacy remainders. */
  other: number;
}

/** One date x tool x model cell, summed across devices. `model` is "" for usage no model accounts for. */
export interface UsageViewRow {
  date: string;
  tool: string;
  model: string;
  cost: number;
  tokens: UsageTokens;
}

export interface UsageViewData {
  /** Last day of the widest window, as YYYY-MM-DD in the user's timezone. */
  end: string;
  rows: UsageViewRow[];
}

export interface AgentDailyRecord {
  date: string;
  agent: string;
  input_tokens: number | string;
  output_tokens: number | string;
  reasoning_output_tokens: number | string;
  cache_creation_tokens: number | string;
  cache_read_tokens: number | string;
  cost_usd: number | string;
  model_breakdown: Array<Record<string, unknown>> | null;
}

const TOKEN_KEYS = ["input", "cacheRead", "cacheWrite", "output", "reasoning", "other"] as const;
const COST_EPSILON = 0.000001;
const DAY_MS = 86_400_000;

export const emptyTokens = (): UsageTokens => ({
  input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, other: 0,
});

export const totalTokens = (tokens: UsageTokens) =>
  TOKEN_KEYS.reduce((sum, key) => sum + tokens[key], 0);

function addTokens(target: UsageTokens, source: UsageTokens) {
  for (const key of TOKEN_KEYS) target[key] += source[key];
}

const count = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

function readTokens(source: Record<string, unknown>, legacy: boolean): UsageTokens {
  const reasoning = count(source.reasoning_output_tokens);
  return {
    input: count(source.input_tokens),
    cacheRead: count(source.cache_read_tokens),
    cacheWrite: count(source.cache_creation_tokens),
    output: count(source.output_tokens),
    // Legacy rows store their unattributed remainder in the reasoning column.
    reasoning: legacy ? 0 : reasoning,
    other: legacy ? reasoning : 0,
  };
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

export function windowStart(end: string, days: number): string {
  return shiftDate(end, -(days - 1));
}

/**
 * Flattens stored per-device tool rows into date x tool x model cells. Each
 * stored row's own totals are authoritative: whatever its model breakdown does
 * not account for lands in a cell with model "", so sums always match the row.
 */
export function buildUsageViewRows(records: readonly AgentDailyRecord[]): UsageViewRow[] {
  const cells = new Map<string, UsageViewRow>();
  const cell = (date: string, tool: string, model: string) => {
    const key = `${date}\u0000${tool}\u0000${model}`;
    let row = cells.get(key);
    if (!row) {
      row = { date, tool, model, cost: 0, tokens: emptyTokens() };
      cells.set(key, row);
    }
    return row;
  };

  for (const record of records) {
    const legacy = record.agent === LEGACY_TOOL;
    const remaining = readTokens(record as unknown as Record<string, unknown>, legacy);
    let remainingCost = count(record.cost_usd);

    for (const entry of record.model_breakdown ?? []) {
      const model = typeof entry.model === "string" ? entry.model : "";
      if (model === "") continue;
      const tokens = readTokens(entry, legacy);
      for (const key of TOKEN_KEYS) {
        tokens[key] = Math.min(tokens[key], remaining[key]);
        remaining[key] -= tokens[key];
      }
      const cost = Math.min(count(entry.cost_usd), remainingCost);
      remainingCost -= cost;
      const target = cell(record.date, record.agent, model);
      target.cost += cost;
      addTokens(target.tokens, tokens);
    }

    if (remainingCost > COST_EPSILON || totalTokens(remaining) > 0) {
      const target = cell(record.date, record.agent, "");
      target.cost += remainingCost > COST_EPSILON ? remainingCost : 0;
      addTokens(target.tokens, remaining);
    }
  }

  return [...cells.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.tool.localeCompare(b.tool) || a.model.localeCompare(b.model));
}

export interface UsageToolTotals {
  tool: string;
  cost: number;
  totalTokens: number;
  costShare: number;
  tokenShare: number;
  activeDays: number;
}

export interface UsageModelTotals {
  tool: string;
  model: string;
  cost: number;
  totalTokens: number;
  costShare: number;
  tokenShare: number;
}

export interface UsageDayTotals {
  date: string;
  cost: number;
  totalTokens: number;
  byTool: Record<string, { cost: number; totalTokens: number }>;
}

export interface UsageSummary {
  cost: number;
  totalTokens: number;
  tokens: UsageTokens;
  activeDays: number;
  /** Cache reads over all input (uncached + cache read + cache write); null without input. */
  cacheHitRate: number | null;
  /** Sorted by the chosen metric, largest first. */
  tools: UsageToolTotals[];
  /** Sorted by the chosen metric, largest first. */
  models: UsageModelTotals[];
  /** Every date in the window in ascending order, including days with no usage. */
  days: UsageDayTotals[];
}

export function summarizeUsage(
  rows: readonly UsageViewRow[],
  options: { start: string; end: string; metric: UsageMetric; tool?: string | null },
): UsageSummary {
  const { start, end, metric, tool = null } = options;
  const days = new Map<string, UsageDayTotals>(
    enumerateDates(start, end).map((date) => [date, { date, cost: 0, totalTokens: 0, byTool: {} }]),
  );
  const tokens = emptyTokens();
  const tools = new Map<string, { cost: number; totalTokens: number; dates: Set<string> }>();
  const models = new Map<string, { tool: string; model: string; cost: number; totalTokens: number }>();
  const activeDates = new Set<string>();
  let cost = 0;

  for (const row of rows) {
    const day = days.get(row.date);
    if (!day || (tool !== null && row.tool !== tool)) continue;
    const rowTokens = totalTokens(row.tokens);
    if (row.cost <= 0 && rowTokens <= 0) continue;

    cost += row.cost;
    addTokens(tokens, row.tokens);
    activeDates.add(row.date);

    day.cost += row.cost;
    day.totalTokens += rowTokens;
    const dayTool = (day.byTool[row.tool] ??= { cost: 0, totalTokens: 0 });
    dayTool.cost += row.cost;
    dayTool.totalTokens += rowTokens;

    let toolTotals = tools.get(row.tool);
    if (!toolTotals) {
      toolTotals = { cost: 0, totalTokens: 0, dates: new Set() };
      tools.set(row.tool, toolTotals);
    }
    toolTotals.cost += row.cost;
    toolTotals.totalTokens += rowTokens;
    toolTotals.dates.add(row.date);

    const modelKey = `${row.tool}\u0000${row.model}`;
    let modelTotals = models.get(modelKey);
    if (!modelTotals) {
      modelTotals = { tool: row.tool, model: row.model, cost: 0, totalTokens: 0 };
      models.set(modelKey, modelTotals);
    }
    modelTotals.cost += row.cost;
    modelTotals.totalTokens += rowTokens;
  }

  const allTokens = totalTokens(tokens);
  const share = (value: number, whole: number) => (whole > 0 ? value / whole : 0);
  const byMetric = <T extends { cost: number; totalTokens: number }>(a: T, b: T) =>
    metric === "cost"
      ? b.cost - a.cost || b.totalTokens - a.totalTokens
      : b.totalTokens - a.totalTokens || b.cost - a.cost;
  const allInput = tokens.input + tokens.cacheRead + tokens.cacheWrite;

  return {
    cost,
    totalTokens: allTokens,
    tokens,
    activeDays: activeDates.size,
    cacheHitRate: allInput > 0 ? tokens.cacheRead / allInput : null,
    tools: [...tools]
      .map(([name, totals]) => ({
        tool: name,
        cost: totals.cost,
        totalTokens: totals.totalTokens,
        costShare: share(totals.cost, cost),
        tokenShare: share(totals.totalTokens, allTokens),
        activeDays: totals.dates.size,
      }))
      .sort((a, b) => byMetric(a, b) || a.tool.localeCompare(b.tool)),
    models: [...models.values()]
      // Sub-cent rounding remainders stay in the totals but are not worth a table row.
      .filter((totals) => totals.model !== "" || totals.totalTokens > 0 || totals.cost >= 0.005)
      .map((totals) => ({
        ...totals,
        costShare: share(totals.cost, cost),
        tokenShare: share(totals.totalTokens, allTokens),
      }))
      .sort((a, b) => byMetric(a, b) || a.model.localeCompare(b.model)),
    days: [...days.values()],
  };
}

/** Tools ranked by cost over every loaded row, so a tool keeps its colour across windows and metrics. */
export function rankTools(rows: readonly UsageViewRow[]): string[] {
  const costs = new Map<string, number>();
  for (const row of rows) costs.set(row.tool, (costs.get(row.tool) ?? 0) + row.cost);
  return [...costs]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tool]) => tool);
}

/** Today's date in an IANA timezone; falls back to UTC for an unknown zone. */
export function todayInTimezone(timezone: string | null | undefined, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
