import { requireAuth } from "../lib/auth.js";
import { apiRequest } from "../lib/api.js";
function formatTokens(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${Math.round(n / 1_000)}k`;
    return String(n);
}
function formatCost(n) {
    return `$${n.toFixed(2)}`;
}
function formatLastPush(dateStr) {
    if (!dateStr)
        return "never";
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (dateStr === todayStr)
        return `${dateStr} (today)`;
    return dateStr;
}
export async function statusCommand() {
    const config = requireAuth();
    let status;
    try {
        status = await apiRequest(config, "/api/users/me/status");
    }
    catch (err) {
        console.error(`Failed to fetch status: ${err.message}`);
        process.exit(1);
    }
    console.log(`@${status.username}`);
    console.log(`  Streak: ${status.streak} day${status.streak !== 1 ? "s" : ""}`);
    console.log(`  This week: ${formatCost(status.week_cost)} · ${formatTokens(status.week_tokens)} tokens`);
    if (status.global_rank !== null) {
        console.log(`  Global rank: #${status.global_rank}`);
    }
    console.log(`\nLast push: ${formatLastPush(status.last_push_date)}`);
}
