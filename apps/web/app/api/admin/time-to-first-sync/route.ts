import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type TimeToFirstSyncRow = {
  bucket: string;
  bucket_order: number | string;
  user_count: number | string;
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
  const { data, error } = await db.rpc("admin_time_to_first_sync");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as TimeToFirstSyncRow[]).map((row) => ({
    bucket: row.bucket,
    bucket_order: Number(row.bucket_order),
    user_count: Number(row.user_count),
  }));

  return NextResponse.json(rows);
}
