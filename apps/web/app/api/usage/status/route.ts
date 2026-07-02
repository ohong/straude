import { NextResponse } from "next/server";
import { after } from "@/lib/utils/after";
import { captureServerActivationEvent } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch aggregated usage
  const { data: usageRows, error: usageError } = await supabase
    .from("daily_usage")
    .select("id,date,cost_usd,total_tokens,session_count,models")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (usageError) {
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }

  if (!usageRows || usageRows.length === 0) {
    return NextResponse.json({ has_data: false });
  }

  const cost_usd = usageRows.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const total_tokens = usageRows.reduce((sum, r) => sum + Number(r.total_tokens), 0);
  const session_count = usageRows.reduce((sum, r) => sum + Number(r.session_count), 0);

  // Top model from most recent row
  const top_model =
    Array.isArray(usageRows[0].models) && usageRows[0].models.length > 0
      ? usageRows[0].models[0]
      : null;
  const latestUsage = usageRows[0];

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
      "$insert_id": `first_sync_confirmed:${user.id}:${latestUsage.id ?? latestUsage.date}`,
    },
  }));

  return NextResponse.json({
    has_data: true,
    cost_usd: Math.round(cost_usd * 100) / 100,
    total_tokens,
    session_count,
    top_model,
  });
}
