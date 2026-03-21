import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

type CohortRetentionRow = {
  cohort_week: string;
  cohort_size: number | string;
  week_0: number | string | null;
  week_1: number | string | null;
  week_2: number | string | null;
  week_3: number | string | null;
  week_4: number | string | null;
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
  const { data, error } = await db.rpc("admin_cohort_retention");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as CohortRetentionRow[]).map((row) => ({
    cohort_week: row.cohort_week,
    cohort_size: Number(row.cohort_size),
    week_0: row.week_0 !== null ? Number(row.week_0) : null,
    week_1: row.week_1 !== null ? Number(row.week_1) : null,
    week_2: row.week_2 !== null ? Number(row.week_2) : null,
    week_3: row.week_3 !== null ? Number(row.week_3) : null,
    week_4: row.week_4 !== null ? Number(row.week_4) : null,
  }));

  return NextResponse.json(rows);
}
