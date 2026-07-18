import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/auth";
import { RecapPage } from "@/components/app/recap/RecapPage";

export default async function RecapRoutePage() {
  const { identity } = await getAuthContext();

  if (!identity) {
    redirect("/login");
  }

  return <RecapPage />;
}
