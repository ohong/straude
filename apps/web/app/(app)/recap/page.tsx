import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecapPage } from "@/components/app/recap/RecapPage";

export default async function RecapRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <RecapPage />;
}
