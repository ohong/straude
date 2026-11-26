import type { SupabaseClient } from "@supabase/supabase-js";
import {
  USAGE_VIEW_MAX_DAYS,
  buildUsageViewRows,
  todayInTimezone,
  windowStart,
  type AgentDailyRecord,
  type UsageViewData,
} from "@/lib/usage-view";

/** Call only with a verified, authenticated user's ID; agent rows are service-only. */
export async function loadUsageView(
  db: SupabaseClient,
  userId: string,
  timezone: string | null | undefined,
): Promise<UsageViewData> {
  const today = todayInTimezone(timezone, new Date());
  const start = windowStart(today, USAGE_VIEW_MAX_DAYS);

  // Multiple devices and tools can exceed PostgREST's default row limit.
  const records: AgentDailyRecord[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await db.from("usage_agent_daily")
      .select("date,agent,input_tokens,output_tokens,reasoning_output_tokens,cache_creation_tokens,cache_read_tokens,cost_usd,model_breakdown")
      .eq("user_id", userId).gte("date", start)
      .order("date").order("device_id").order("agent")
      .range(offset, offset + pageSize - 1);
    if (page.error) throw new Error(`Unable to load usage view (${page.error.message})`);
    records.push(...((page.data ?? []) as AgentDailyRecord[]));
    if ((page.data?.length ?? 0) < pageSize) break;
  }

  // A device ahead of the profile timezone can already hold tomorrow's date.
  const latest = records.reduce((max, record) => (record.date > max ? record.date : max), today);
  return { end: latest, rows: buildUsageViewRows(records) };
}
