import { loadPersonalWeeklyReview } from "@/lib/utils/personal-review";
import { getServiceClient } from "@/lib/supabase/service";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/utils/recap";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username, is_public")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  const periodParam = request.nextUrl.searchParams.get("period");
  const period =
    periodParam === "month" ? "month" : ("week" as "week" | "month");

  const data = await getRecapData(
    supabase,
    user.id,
    profile.username ?? "Your account",
    Boolean(profile.username && profile.is_public),
    period
  );

  if (period === "week") {
    data.personal_review = await loadPersonalWeeklyReview(getServiceClient(), user.id);
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
