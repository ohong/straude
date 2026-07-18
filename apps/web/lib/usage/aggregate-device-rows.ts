import type { ModelBreakdownEntry, UsageCollectorMeta } from "@/types";

export interface DeviceUsageRow {
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens?: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  models: string[];
  model_breakdown: ModelBreakdownEntry[] | null;
  collector_meta?: UsageCollectorMeta | null;
}

export function aggregateDeviceRows(rows: DeviceUsageRow[]) {
  let cost_usd = 0;
  let input_tokens = 0;
  let output_tokens = 0;
  let reasoning_output_tokens = 0;
  let cache_creation_tokens = 0;
  let cache_read_tokens = 0;
  let total_tokens = 0;
  const modelsSet = new Set<string>();
  const breakdownMap = new Map<string, number>();

  for (const row of rows) {
    cost_usd += Number(row.cost_usd);
    input_tokens += Number(row.input_tokens);
    output_tokens += Number(row.output_tokens);
    reasoning_output_tokens += Number(row.reasoning_output_tokens ?? 0);
    cache_creation_tokens += Number(row.cache_creation_tokens ?? 0);
    cache_read_tokens += Number(row.cache_read_tokens ?? 0);
    total_tokens += Number(row.total_tokens);

    for (const model of row.models ?? []) modelsSet.add(model);
    for (const entry of row.model_breakdown ?? []) {
      breakdownMap.set(
        entry.model,
        (breakdownMap.get(entry.model) ?? 0) + entry.cost_usd,
      );
    }
  }

  const model_breakdown: ModelBreakdownEntry[] = [...breakdownMap].map(
    ([model, cost_usd]) => ({ model, cost_usd }),
  );

  return {
    cost_usd,
    input_tokens,
    output_tokens,
    reasoning_output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    total_tokens,
    models: [...modelsSet],
    model_breakdown: model_breakdown.length > 0 ? model_breakdown : null,
    session_count: rows.length,
  };
}
