import { loadPersonalWeeklyReview } from "@/lib/utils/personal-review";
import { getServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/utils/recap";
import { RecapPage } from "@/components/app/recap/RecapPage";

export default async function RecapRoutePage() {
  const { identity } = await getAuthContext();

  if (!identity) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("username, is_public, streak_freezes")
    .eq("id", identity.id)
    .single();

  if (!profile) {
    return <RecapPage initialData={null} initialError="Profile not found" />;
  }

  const initialData = await getRecapData(
    supabase,
    identity.id,
    profile.username ?? "Your account",
    Boolean(profile.username && profile.is_public),
    "week",
    profile.streak_freezes ?? 0,
  );

  initialData.personal_review = await loadPersonalWeeklyReview(getServiceClient(), identity.id);

  return <RecapPage initialData={initialData} />;
}
