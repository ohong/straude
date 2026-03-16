import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type ModelUsageRow = {
  date: string;
  claude_spend: number | string;
  codex_spend: number | string;
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
  const { data, error } = await db.rpc("admin_model_usage_by_day");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as ModelUsageRow[]).map((row) => ({
    date: row.date,
    claude_spend: Number(row.claude_spend),
    codex_spend: Number(row.codex_spend),
  }));

  return NextResponse.json(rows);
}
