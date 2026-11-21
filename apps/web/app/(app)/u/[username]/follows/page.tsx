import { getServiceClient } from "@/lib/supabase/service";
import { getProfileAccessContext } from "@/lib/profile-access";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { firstRelation } from "@/lib/utils/first-relation";
import { Avatar } from "@/components/ui/Avatar";
import type { Metadata } from "next";

type FollowsProfileRow = {
  id: string;
  username: string | null;
  is_public: boolean;
};
type FollowUserRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};
type FollowingRelationRow = { following: FollowUserRow[] | null };
type FollowerRelationRow = { follower: FollowUserRow[] | null };

async function removeFollower(username: string, followerId: string) {
  "use server";
  const owner = await getAuthIdentity();
  if (!owner) throw new Error("Sign in to remove a follower");
  const { error } = await getServiceClient().from("follows").delete()
    .eq("following_id", owner.id).eq("follower_id", followerId);
  if (error) throw new Error("Could not remove follower");
  revalidatePath(`/u/${username}/follows`);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const { tab } = await searchParams;
  const label = tab === "followers" ? "Followers" : "Following";
  return { title: `${label} — @${username}` };
}

export default async function FollowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "followers" ? "followers" : "following";
  const access = await getProfileAccessContext<FollowsProfileRow>(
    username,
    "id, username, is_public",
  );
  if (!access) notFound();
  if (!access.canView) notFound();

  const { profile } = access;
  const db = getServiceClient();

  let users: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null }[] = [];

  if (activeTab === "following") {
    const { data } = await db
      .from("follows")
      .select("following:users!follows_following_id_fkey(id, username, display_name, avatar_url, bio)")
      .eq("follower_id", profile.id)
      .order("created_at", { ascending: false });

    users = ((data ?? []) as FollowingRelationRow[])
      .map((row) => firstRelation(row.following))
      .filter((user): user is FollowUserRow => Boolean(user));
  } else {
    const { data } = await db
      .from("follows")
      .select("follower:users!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)")
      .eq("following_id", profile.id)
      .order("created_at", { ascending: false });

    users = ((data ?? []) as FollowerRelationRow[])
      .map((row) => firstRelation(row.follower))
      .filter((user): user is FollowUserRow => Boolean(user));
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="flex h-16 items-center px-6">
          <h3 className="text-lg font-medium">@{username}</h3>
        </div>
        <div className="flex border-t border-border">
          <Link
            href={`/u/${username}/follows?tab=following`}
            className={`flex-1 py-3 text-center text-sm font-semibold ${
              activeTab === "following"
                ? "border-b-2 border-accent text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Following
          </Link>
          <Link
            href={`/u/${username}/follows?tab=followers`}
            className={`flex-1 py-3 text-center text-sm font-semibold ${
              activeTab === "followers"
                ? "border-b-2 border-accent text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Followers
          </Link>
        </div>
      </header>

      <div>
        {users.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">
            {activeTab === "following"
              ? "Not following anyone yet."
              : "No followers yet."}
          </p>
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex items-center border-b border-border pr-6">
              <Link
                href={user.username ? `/u/${user.username}` : "#"}
                className="flex min-w-0 flex-1 items-center gap-4 px-6 py-4 hover:bg-subtle"
              >
                <Avatar
                  src={user.avatar_url}
                  alt={user.username ?? ""}
                  fallback={user.display_name ?? user.username ?? "?"}
                  size="md"
                />
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium">
                    {user.display_name ?? user.username ?? "User"}
                  </p>
                  {user.username && (
                    <p className="text-sm text-muted">@{user.username}</p>
                  )}
                  {user.bio && (
                    <p className="mt-0.5 truncate text-sm text-muted">{user.bio}</p>
                  )}
                </div>
              </Link>
              {access.isOwn && activeTab === "followers" && (
                <form action={removeFollower.bind(null, username, user.id)}>
                  <button className="text-sm underline" type="submit" aria-label={`Remove ${user.username ?? "follower"}`}>Remove</button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
