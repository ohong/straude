import type { CcusageDailyEntry } from "../lib/ccusage.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";

interface UsageSubmitResult {
  date: string;
  post_url: string;
  action: "created" | "updated";
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function printDryRunEntries(entries: CcusageDailyEntry[]): void {
  for (const entry of entries) {
    console.log(`  ${entry.date}:`);
    console.log(`    Cost: ${formatCost(entry.costUSD)}`);
    console.log(
      `    Tokens: ${formatTokens(entry.totalTokens)} (input: ${formatTokens(entry.inputTokens)}, output: ${formatTokens(entry.outputTokens)})`,
    );
    console.log(`    Models: ${entry.models.join(", ")}`);
  }
}

export function printSubmittedResults(results: UsageSubmitResult[]): void {
  console.log("");
  for (const result of results) {
    const verb = result.action === "updated" ? "Updated" : "Posted";
    console.log(`${verb} ${result.date}: ${result.post_url}?edit=1`);
  }
}

function isDashboardData(value: unknown): value is DashboardResponse {
  if (!value || typeof value !== "object") return false;
  const dashboard = value as Partial<DashboardResponse>;
  return (
    typeof dashboard.username === "string" &&
    typeof dashboard.streak === "number" &&
    Array.isArray(dashboard.daily) &&
    typeof dashboard.week_cost === "number" &&
    typeof dashboard.prev_week_cost === "number"
  );
}

export async function renderPushSummary(
  dashboard: unknown,
  results?: UsageSubmitResult[],
): Promise<void> {
  if (!isDashboardData(dashboard)) {
    throw new Error("Dashboard data unavailable");
  }

  const { render } = await import("ink");
  const { createElement } = await import("react");
  const { PushSummary } = await import("../components/PushSummary.js");

  const { waitUntilExit } = render(
    createElement(PushSummary, { dashboard, results }),
  );
  await waitUntilExit();
}
