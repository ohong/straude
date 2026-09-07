import CardClient from "@/components/app/card/CardClient";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";

export default async function CardPage() {
  const identity = await getAuthIdentity();
  if (!identity) {
    return <CardClient username={null} isPublic />;
  }

  const { data: profile } = await getServiceClient()
    .from("users")
    .select("username, is_public")
    .eq("id", identity.id)
    .single();

  return (
    <CardClient
      username={profile?.username ?? null}
      isPublic={profile?.is_public ?? true}
    />
  );
}
