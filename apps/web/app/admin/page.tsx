import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/service";
import { StatCard } from "./components/StatCard";
import { NorthStarChart } from "./components/NorthStarChart";
import { TopUsersTable } from "./components/TopUsersTable";
import { ActivationFunnel } from "./components/ActivationFunnel";
import { GrowthMetrics } from "./components/GrowthMetrics";
import { CohortRetention } from "./components/CohortRetention";
import { ModelUsageChart } from "./components/ModelUsageChart";
import { RevenueConcentration } from "./components/RevenueConcentration";
import { TimeToFirstSync } from "./components/TimeToFirstSync";
import { PromptInbox } from "./components/PromptInbox";

export default async function AdminPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || !isAdmin(user.id)) redirect("/feed");

  const supabase = getServiceClient();

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [
    spendRes,
    usersRes,
    funnelRes,
    growthRes,
    dauRes,
    wauRes,
    promptsRes,
  ] = await Promise.all([
    supabase.rpc("admin_cumulative_spend"),
    supabase.rpc("admin_top_users", { p_limit: 20 }),
    supabase.rpc("admin_activation_funnel"),
    supabase.rpc("admin_growth_metrics"),
    supabase.from("daily_usage").select("user_id").gte("date", today),
    supabase.from("daily_usage").select("user_id").gte("date", weekAgo),
    supabase
      .from("prompt_submissions")
      .select(
        "id,prompt,is_anonymous,status,is_hidden,created_at,user:users!prompt_submissions_user_id_fkey(username,display_name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
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

  const isDummy = (id: string) => id.startsWith("a0000000-0000-4000-8000-");
  const uniqueReal = (rows: any[]) =>
    new Set(rows.filter((r) => !isDummy(r.user_id)).map((r) => r.user_id)).size;

  const dau = uniqueReal(dauRes.data ?? []);
  const wau = uniqueReal(wauRes.data ?? []);

  // WoW spend growth: compare last 7 days vs prior 7 days
  const now = Date.now();
  const thisWeekSpend = spendData
    .filter((r: { date: string; daily_total: number }) => {
      const t = new Date(r.date).getTime();
      return t > now - 7 * 86400000;
    })
    .reduce((s: number, r: { daily_total: number }) => s + r.daily_total, 0);
  const lastWeekSpend = spendData
    .filter((r: { date: string; daily_total: number }) => {
      const t = new Date(r.date).getTime();
      return t > now - 14 * 86400000 && t <= now - 7 * 86400000;
    })
    .reduce((s: number, r: { daily_total: number }) => s + r.daily_total, 0);
  const wowGrowth =
    lastWeekSpend > 0
      ? ((thisWeekSpend - lastWeekSpend) / lastWeekSpend) * 100
      : null;

  const promptRows = (promptsRes.data ?? []).map((r: any) => ({
    id: r.id,
    prompt: r.prompt,
    is_anonymous: r.is_anonymous,
    status: r.status,
    is_hidden: r.is_hidden,
    created_at: r.created_at,
    user: r.user,
  }));

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
        <StatCard
          label="Spend WoW"
          value={wowGrowth !== null ? `${wowGrowth >= 0 ? "+" : ""}${wowGrowth.toFixed(0)}%` : "\u2014"}
        />
      </div>

      {/* North Star chart */}
      <NorthStarChart data={spendData} />

      {/* Model usage — loads client-side */}
      <ModelUsageChart />

      {/* Funnel + Growth side by side */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ActivationFunnel data={funnelData} />
        <GrowthMetrics data={growthData} />
      </div>

      {/* Cohort Retention — loads client-side */}
      <CohortRetention />

      {/* Revenue Concentration + Time to First Sync — load client-side */}
      <div className="grid gap-3 lg:grid-cols-2">
        <RevenueConcentration />
        <TimeToFirstSync />
      </div>

      <PromptInbox initialPrompts={promptRows} />

      {/* Top users table */}
      <TopUsersTable users={topUsers} />
    </div>
  );
}
