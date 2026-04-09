import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type RpcRow = {
  date: string;
  model_family: string;
  spend: number | string;
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
  const { data, error } = await db.rpc("admin_model_share_by_day");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as RpcRow[]).map((row) => ({
    date: row.date,
    model_family: row.model_family,
    spend: Number(row.spend),
  }));

  return NextResponse.json(rows);
}
