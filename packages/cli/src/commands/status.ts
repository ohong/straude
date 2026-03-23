import { requireAuth } from "../lib/auth.js";
import { apiRequest } from "../lib/api.js";
import type { DashboardData } from "../components/PushSummary.js";

export async function statusCommand(): Promise<void> {
  const config = requireAuth();

  let dashboard: DashboardData;
  try {
    dashboard = await apiRequest<DashboardData>(config, "/api/cli/dashboard");
  } catch (err) {
    console.error(`Failed to fetch status: ${(err as Error).message}`);
    process.exit(1);
  }

  try {
    const { render } = await import("ink");
    const { createElement } = await import("react");
    const { PushSummary } = await import("../components/PushSummary.js");

    const shareUrl = config.username
      ? new URL(`/consistency/${config.username}`, config.api_url).toString()
      : undefined;

    const { waitUntilExit } = render(
      createElement(PushSummary, { dashboard, shareUrl }),
    );
    await waitUntilExit();
  } catch (err) {
    // Fallback: plain text if Ink fails
    console.log(`@${dashboard.username}`);
    console.log(`  Streak: ${dashboard.streak} day${dashboard.streak !== 1 ? "s" : ""}`);
    console.log(`  This week: $${dashboard.week_cost.toFixed(2)}`);
    if (dashboard.leaderboard) {
      console.log(`  Global rank: #${dashboard.leaderboard.rank}`);
    }
  }
}
