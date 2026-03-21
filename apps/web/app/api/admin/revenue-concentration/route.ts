import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type RevenueConcentrationRow = {
  segment: string;
  user_count: number | string;
  total_spend: number | string;
  pct_of_total: number | string;
};

export async function GET() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data, error } = await db.rpc("admin_revenue_concentration");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as RevenueConcentrationRow[]).map((row) => ({
    segment: row.segment,
    user_count: Number(row.user_count),
    total_spend: Number(row.total_spend),
    pct_of_total: Number(row.pct_of_total),
  }));

  return NextResponse.json(rows);
}
