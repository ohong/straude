import type { SupabaseClient } from "@supabase/supabase-js";

export interface PersonalReviewDay {
  date: string;
  cost_usd: number | string;
  output_tokens: number | string;
  model_breakdown: Array<{ model: string; cost_usd: number }> | null;
}

export interface PersonalReviewAgent {
  date: string;
  agent: string;
  cost_usd: number | string;
}

export interface PersonalWeeklyReview {
  start: string;
  end: string;
  previous_start: string;
  previous_end: string;
  current: { estimated_value_usd: number; output_tokens: number; received_days: number };
  previous: { estimated_value_usd: number; output_tokens: number; received_days: number };
  models: Array<{ name: string; estimated_value_usd: number }>;
  tools: Array<{ name: string; estimated_value_usd: number }>;
  model_unattributed_usd: number;
  tool_unattributed_usd: number;
}

const DAY = 86_400_000;
const key = (date: Date) => date.toISOString().slice(0, 10);

/** Match elapsed weekdays so Friday is never presented against an entire week. */
export function personalWeekRange(now: Date) {
  const today = new Date(`${key(now)}T00:00:00Z`);
  const offset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - offset * DAY);
  return {
    start: key(monday),
    end: key(today),
    previous_start: key(new Date(monday.getTime() - 7 * DAY)),
    previous_end: key(new Date(today.getTime() - 7 * DAY)),
  };
}

export function summarizePersonalWeek(
  days: PersonalReviewDay[],
  agents: PersonalReviewAgent[],
  now: Date,
): PersonalWeeklyReview {
  const range = personalWeekRange(now);
  const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
  const current = days.filter((day) => inRange(day.date, range.start, range.end));
  const previous = days.filter((day) => inRange(day.date, range.previous_start, range.previous_end));
  const totals = (rows: PersonalReviewDay[]) => ({
    estimated_value_usd: rows.reduce((sum, row) => sum + Number(row.cost_usd), 0),
    output_tokens: rows.reduce((sum, row) => sum + Number(row.output_tokens), 0),
    received_days: new Set(rows.map((row) => row.date)).size,
  });
  const modelValues = new Map<string, number>();
  for (const day of current) {
    for (const model of day.model_breakdown ?? []) {
      modelValues.set(model.model, (modelValues.get(model.model) ?? 0) + Number(model.cost_usd));
    }
  }
  const toolValues = new Map<string, number>();
  for (const row of agents) {
    if (!inRange(row.date, range.start, range.end) || row.agent === "legacy-unpartitioned") continue;
    toolValues.set(row.agent, (toolValues.get(row.agent) ?? 0) + Number(row.cost_usd));
  }
  const breakdown = (values: Map<string, number>) => [...values]
    .map(([name, estimated_value_usd]) => ({ name, estimated_value_usd }))
    .sort((a, b) => b.estimated_value_usd - a.estimated_value_usd || a.name.localeCompare(b.name));
  const currentTotals = totals(current);
  return {
    ...range,
    current: currentTotals,
    previous: totals(previous),
    models: breakdown(modelValues),
    tools: breakdown(toolValues),
    model_unattributed_usd: currentTotals.estimated_value_usd - [...modelValues.values()].reduce((a, b) => a + b, 0),
    tool_unattributed_usd: currentTotals.estimated_value_usd - [...toolValues.values()].reduce((a, b) => a + b, 0),
  };
}

/** Call only with a verified, authenticated user's ID; agent rows are service-only. */
export async function loadPersonalWeeklyReview(db: SupabaseClient, userId: string): Promise<PersonalWeeklyReview | null> {
  const now = new Date();
  const range = personalWeekRange(now);
  const days = await db.from("daily_usage")
    .select("date,cost_usd,output_tokens,model_breakdown")
    .eq("user_id", userId).gte("date", range.previous_start).lte("date", range.end);
  if (days.error) return null;

  // Multiple devices and tools can exceed PostgREST's default row limit.
  const agents: PersonalReviewAgent[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await db.from("usage_agent_daily")
      .select("date,agent,cost_usd")
      .eq("user_id", userId).gte("date", range.start).lte("date", range.end)
      .order("date").order("device_id").order("agent")
      .range(offset, offset + pageSize - 1);
    if (page.error) return null;
    agents.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < pageSize) break;
  }
  return summarizePersonalWeek(days.data ?? [], agents, now);
}
