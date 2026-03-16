import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const db = getServiceClient();

  const [
    {
      data: { user: authUser },
    },
    { data: rawProfile, error: profileError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    db
      .from("users")
      .select(selectFields)
      .eq("username", username)
      .single(),
  ]);

  if (profileError || !rawProfile) {
    return null;
  }

  const profile = rawProfile as unknown as TProfile;

  const authUserId = authUser?.id ?? null;
  const isOwn = authUserId === profile.id;
  let isFollowing = false;

  if (authUserId && !isOwn) {
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
