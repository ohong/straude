import { NextResponse } from "next/server";
import { after } from "@/lib/utils/after";
import { captureServerActivationEvent } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

type LatestUsageRow = {
  id: string;
  date: string;
  cost_usd: number | string | null;
  total_tokens: number | string | null;
  session_count: number | string | null;
  models: unknown;
  created_at: string | null;
};

type UsageTotalsRow = {
  total_cost: number | string | null;
  total_tokens: number | string | null;
};

function firstModel(models: unknown): string | null {
  if (!Array.isArray(models) || models.length === 0) return null;
  return typeof models[0] === "string" ? models[0] : null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [latestUsageResult, usageTotalsResult] = await Promise.all([
    supabase
      .from("daily_usage")
      .select("id,date,cost_usd,total_tokens,session_count,models,created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .rpc("get_user_usage_totals", { p_user_id: user.id })
      .single(),
  ]);

  if (latestUsageResult.error) {
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }

  const latestUsage = latestUsageResult.data as LatestUsageRow | null;

  if (!latestUsage) {
    return NextResponse.json({ has_data: false, has_usage: false });
  }

  const totals = usageTotalsResult.data as UsageTotalsRow | null;
  const cost_usd = usageTotalsResult.error
    ? Number(latestUsage.cost_usd ?? 0)
    : Number(totals?.total_cost ?? latestUsage.cost_usd ?? 0);
  const total_tokens = usageTotalsResult.error
    ? Number(latestUsage.total_tokens ?? 0)
    : Number(totals?.total_tokens ?? latestUsage.total_tokens ?? 0);
  const session_count = Number(latestUsage.session_count ?? 0);

  const { data: latestPost } = await supabase
    .from("posts")
    .select("id")
    .eq("daily_usage_id", latestUsage.id)
    .maybeSingle();

  after(() => captureServerActivationEvent({
    event: "first_sync_confirmed",
    distinctId: user.id,
    properties: {
      surface: "usage_status",
      activation_state: "activated",
      is_authenticated: true,
      session_count,
      total_tokens,
      total_cost_usd: Math.round(cost_usd * 100) / 100,
      "$insert_id": `first_sync_confirmed:${user.id}:${latestUsage.id}`,
    },
  }));

  return NextResponse.json({
    has_data: true,
    has_usage: true,
    cost_usd: Math.round(cost_usd * 100) / 100,
    total_tokens,
    session_count,
    top_model: firstModel(latestUsage.models),
    latest_usage_id: latestUsage.id,
    latest_usage_at: latestUsage.created_at ?? latestUsage.date,
    latest_usage_date: latestUsage.date,
    latest_post_url: latestPost?.id ? `/post/${latestPost.id}` : null,
  });
}
