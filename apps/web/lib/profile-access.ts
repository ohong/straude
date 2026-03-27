import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";

type ProfileShape = {
  id: string;
  is_public: boolean;
};

export interface ProfileAccessContext<TProfile extends ProfileShape> {
  authUserId: string | null;
  canView: boolean;
  isFollowing: boolean;
  isOwn: boolean;
  profile: TProfile;
}

export async function getProfileAccessContext<TProfile extends ProfileShape>(
  username: string,
  selectFields: string,
): Promise<ProfileAccessContext<TProfile> | null> {
  const db = getServiceClient();

  // Use cached auth (shared with middleware/layout) + profile fetch in parallel
  const [authUser, { data: rawProfile, error: profileError }] =
    await Promise.all([
      getAuthUser(),
      db
        .from("users")
        .select(selectFields)
        .eq("username", username)
        .single(),
    ]);

  if (profileError || !rawProfile) {
    return null;
  }

  const required = rawProfile as { id?: unknown; is_public?: unknown };
  if (
    typeof required.id !== "string"
    || typeof required.is_public !== "boolean"
  ) {
    return null;
  }

  const profile = rawProfile as unknown as TProfile;

  const authUserId = authUser?.id ?? null;
  const isOwn = authUserId === profile.id;
  let isFollowing = false;

  if (authUserId && !isOwn) {
    const supabase = await createClient();
    const { data: follow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", authUserId)
      .eq("following_id", profile.id)
      .maybeSingle();

    isFollowing = !!follow;
  }

  return {
    authUserId,
    canView: profile.is_public || isOwn || isFollowing,
    isFollowing,
    isOwn,
    profile: profile as TProfile,
  };
}
