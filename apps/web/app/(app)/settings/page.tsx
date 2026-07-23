import { redirect } from "next/navigation";
import SettingsClient, {
  type SettingsProfile,
} from "@/components/app/settings/SettingsClient";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";

export default async function SettingsPage() {
  const identity = await getAuthIdentity();
  if (!identity) redirect("/login");

  const db = getServiceClient();
  const [{ data: profile, error }, { count: crewCount }] = await Promise.all([
    db
      .from("users")
      .select(
        "id, username, display_name, bio, heard_about, avatar_url, country, region, link, github_username, is_public, timezone, email_notifications, email_mention_notifications, email_dm_notifications, streak_freezes, referred_by, team_url, team_favicon_url, created_at, updated_at",
      )
      .eq("id", identity.id)
      .single(),
    db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", identity.id),
  ]);

  if (error || !profile) {
    return (
      <p role="alert" className="px-[var(--app-page-padding-x)] py-6 text-sm text-muted">
        Unable to load profile.
      </p>
    );
  }

  const initialProfile: SettingsProfile = {
    ...profile,
    crew_count: crewCount ?? 0,
  };

  return <SettingsClient initialProfile={initialProfile} />;
}
