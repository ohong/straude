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

  if (!profile?.username) {
    return <RecapPage initialData={null} initialError="Profile not found" />;
  }

  const initialData = await getRecapData(
    supabase,
    identity.id,
    profile.username,
    profile.is_public,
    "week",
    profile.streak_freezes ?? 0,
  );

  return <RecapPage initialData={initialData} />;
}
