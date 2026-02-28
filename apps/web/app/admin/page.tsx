import { getServiceClient } from "@/lib/supabase/service";
import { StatCard } from "./components/StatCard";
import { NorthStarChart } from "./components/NorthStarChart";
import { TopUsersTable } from "./components/TopUsersTable";
import { ActivationFunnel } from "./components/ActivationFunnel";
import { GrowthMetrics } from "./components/GrowthMetrics";

export default async function AdminPage() {
  const supabase = getServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [spendRes, usersRes, funnelRes, growthRes, dauRes, wauRes, mauRes] =
    await Promise.all([
      supabase.rpc("admin_cumulative_spend"),
      supabase.rpc("admin_top_users", { p_limit: 20 }),
      supabase.rpc("admin_activation_funnel"),
      supabase.rpc("admin_growth_metrics"),
      supabase.from("daily_usage").select("user_id").gte("date", today),
      supabase.from("daily_usage").select("user_id").gte("date", weekAgo),
      supabase.from("daily_usage").select("user_id").gte("date", monthAgo),
    ]);

  const spendData = (spendRes.data ?? []).map((r: any) => ({
    date: r.date,
    daily_total: Number(r.daily_total),
    cumulative_total: Number(r.cumulative_total),
  }));

  const topUsers = (usersRes.data ?? []).map((r: any) => ({
    ...r,
    total_spend: Number(r.total_spend),
    total_tokens: Number(r.total_tokens),
    usage_days: Number(r.usage_days),
  }));

  const funnelData = (funnelRes.data ?? []).map((r: any) => ({
    stage: r.stage,
    count: Number(r.count),
  }));

  const growthData = (growthRes.data ?? []).map((r: any) => ({
    date: r.date,
    signups: Number(r.signups),
    cumulative_users: Number(r.cumulative_users),
  }));

  const totalSpend =
    spendData.length > 0
      ? spendData[spendData.length - 1].cumulative_total
      : 0;
  const totalUsers =
    funnelData.find((s: any) => s.stage === "signed_up")?.count ?? 0;

  const dau = new Set((dauRes.data ?? []).map((r: any) => r.user_id)).size;
  const wau = new Set((wauRes.data ?? []).map((r: any) => r.user_id)).size;
  const mau = new Set((mauRes.data ?? []).map((r: any) => r.user_id)).size;

  const spendFormatted = totalSpend.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <p
          className="text-sm"
          style={{ color: "var(--admin-fg-secondary)" }}
        >
          ${spendFormatted} logged across {totalUsers} users.{" "}
          {dau} active today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Spend" value={`$${spendFormatted}`} />
        <StatCard label="Total Users" value={String(totalUsers)} />
        <StatCard label="DAU" value={String(dau)} />
        <StatCard label="WAU" value={String(wau)} />
        <StatCard label="MAU" value={String(mau)} />
      </div>

      {/* North Star chart */}
      <NorthStarChart data={spendData} />

      {/* Funnel + Growth side by side */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ActivationFunnel data={funnelData} />
        <GrowthMetrics data={growthData} />
      </div>

      {/* Top users table */}
      <TopUsersTable users={topUsers} />
    </div>
  );
}
