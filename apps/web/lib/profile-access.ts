import { createClient } from "@/lib/supabase/server";
import { getAuthIdentity } from "@/lib/supabase/auth";
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
  const authPromise = getAuthIdentity();
  const userClientPromise = createClient();

  // The follow lookup can filter through the target username, so it does not
  // need to wait for the profile query to return its id.
  const followPromise = Promise.all([authPromise, userClientPromise]).then(
    async ([authUser, supabase]) => {
      if (!authUser) return null;

      const { data } = await supabase
        .from("follows")
        .select("id, following:users!follows_following_id_fkey!inner(username)")
        .eq("follower_id", authUser.id)
        .eq("following.username", username)
        .maybeSingle();

      return data;
    },
  );

  // Auth, target profile, and follow status are one parallel request wave.
  const [authUser, { data: rawProfile, error: profileError }, follow] =
    await Promise.all([
      authPromise,
      db
        .from("users")
        .select(selectFields)
        .eq("username", username)
        .single(),
      followPromise,
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
  const isFollowing = !isOwn && Boolean(follow);

  return {
    authUserId,
    canView: profile.is_public || isOwn || isFollowing,
    isFollowing,
    isOwn,
    profile: profile as TProfile,
  };
}
