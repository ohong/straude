import { loadPersonalWeeklyReview } from "@/lib/utils/personal-review";
import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/utils/recap";
import { RecapPage } from "@/components/app/recap/RecapPage";

export default async function RecapRoutePage() {
  const identity = await getAuthIdentity();

  if (!identity) {
    redirect("/login");
  }

  const db = getServiceClient();
  const review = loadPersonalWeeklyReview(db, identity.id).catch(() => null);
  const supabase = await createClient();
  const { data: profile } = await db
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
  ).catch(() => null);

  return <RecapPage initialReview={review} initialError={initialData ? null : "Unable to load recap statistics."} initialData={initialData} />;
}
