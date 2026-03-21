import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/service";
import { firstRelation } from "@/lib/utils/first-relation";
import { StatCard } from "./components/StatCard";
import { NorthStarChart } from "./components/NorthStarChart";
import { TopUsersTable } from "./components/TopUsersTable";
import { ActivationFunnel } from "./components/ActivationFunnel";
import { GrowthMetrics } from "./components/GrowthMetrics";
import { CohortRetention } from "./components/CohortRetention";
import { ModelUsageChart } from "./components/ModelUsageChart";
import { CodexGrowthCharts } from "./components/CodexGrowthCharts";
import { RevenueConcentration } from "./components/RevenueConcentration";
import { TimeToFirstSync } from "./components/TimeToFirstSync";
import { PromptInbox } from "./components/PromptInbox";
import { CompanySuggestionsInbox } from "./components/CompanySuggestionsInbox";

type SpendRow = {
  date: string;
  daily_total: number | string;
  cumulative_total: number | string;
};
type TopUserRow = {
  total_spend: number | string;
  total_tokens: number | string;
  usage_days: number | string;
} & Record<string, unknown>;
type FunnelRow = { stage: string; count: number | string };
type GrowthRow = { date: string; signups: number | string; cumulative_users: number | string };
type DailyUsageUserRow = { user_id: string };
type PromptInboxRow = {
  id: string;
  prompt: string;
  is_anonymous: boolean;
  status: "new" | "accepted" | "in_progress" | "rejected" | "shipped";
  is_hidden: boolean;
  created_at: string;
  user: Array<{ username: string | null; display_name: string | null }> | null;
};
type TopUsersTableRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_spend: number;
  total_tokens: number;
  usage_days: number;
  last_active: string;
  signed_up: string;
};
type CompanySuggestionInboxRow = {
  id: string;
  company_name: string;
  company_url: string;
  policy_description: string;
  source_url: string;
  status: "new" | "accepted" | "rejected" | "published";
  is_hidden: boolean;
  created_at: string;
  user: Array<{ username: string | null; display_name: string | null }> | null;
};

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
    companySuggestionsRes,
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
    supabase
      .from("company_suggestions")
      .select(
        "id,company_name,company_url,policy_description,source_url,status,is_hidden,created_at,user:users!company_suggestions_user_id_fkey(username,display_name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const spendData = ((spendRes.data ?? []) as SpendRow[]).map((row) => ({
    date: row.date,
    daily_total: Number(row.daily_total),
    cumulative_total: Number(row.cumulative_total),
  }));

  const topUsers: TopUsersTableRow[] = ((usersRes.data ?? []) as TopUserRow[]).map((row) => ({
    ...row,
    total_spend: Number(row.total_spend),
    total_tokens: Number(row.total_tokens),
    usage_days: Number(row.usage_days),
  })) as TopUsersTableRow[];

  const funnelData = ((funnelRes.data ?? []) as FunnelRow[]).map((row) => ({
    stage: row.stage,
    count: Number(row.count),
  }));

  const growthData = ((growthRes.data ?? []) as GrowthRow[]).map((row) => ({
    date: row.date,
    signups: Number(row.signups),
    cumulative_users: Number(row.cumulative_users),
  }));

  const totalSpend =
    spendData.length > 0
      ? spendData[spendData.length - 1].cumulative_total
      : 0;
  const totalUsers =
    funnelData.find((stage) => stage.stage === "signed_up")?.count ?? 0;

  const isDummy = (id: string) => id.startsWith("a0000000-0000-4000-8000-");
  const uniqueReal = (rows: DailyUsageUserRow[]) =>
    new Set(rows.filter((row) => !isDummy(row.user_id)).map((row) => row.user_id)).size;

  const dau = uniqueReal((dauRes.data ?? []) as DailyUsageUserRow[]);
  const wau = uniqueReal((wauRes.data ?? []) as DailyUsageUserRow[]);

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

  const companySuggestionRows = ((companySuggestionsRes.data ?? []) as CompanySuggestionInboxRow[]).map((row) => ({
    id: row.id,
    company_name: row.company_name,
    company_url: row.company_url,
    policy_description: row.policy_description,
    source_url: row.source_url,
    status: row.status,
    is_hidden: row.is_hidden,
    created_at: row.created_at,
    user: firstRelation(row.user),
  }));

  const promptRows = ((promptsRes.data ?? []) as PromptInboxRow[]).map((row) => ({
    id: row.id,
    prompt: row.prompt,
    is_anonymous: row.is_anonymous,
    status: row.status,
    is_hidden: row.is_hidden,
    created_at: row.created_at,
    user: firstRelation(row.user),
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

      {/* Model usage section */}
      <div className="space-y-3">
        <ModelUsageChart />
        <CodexGrowthCharts />
      </div>

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

      <CompanySuggestionsInbox initialSuggestions={companySuggestionRows} />

      {/* Top users table */}
      <TopUsersTable users={topUsers} />
    </div>
  );
}
