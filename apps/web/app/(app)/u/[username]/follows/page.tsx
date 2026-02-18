import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { Metadata } from "next";

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

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  let users: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null }[] = [];

  if (activeTab === "following") {
    const { data } = await supabase
      .from("follows")
      .select("following:users!follows_following_id_fkey(id, username, display_name, avatar_url, bio)")
      .eq("follower_id", profile.id)
      .order("created_at", { ascending: false });

    users = (data ?? []).map((r: any) => r.following).filter(Boolean);
  } else {
    const { data } = await supabase
      .from("follows")
      .select("follower:users!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)")
      .eq("following_id", profile.id)
      .order("created_at", { ascending: false });

    users = (data ?? []).map((r: any) => r.follower).filter(Boolean);
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
            <Link
              key={user.id}
              href={user.username ? `/u/${user.username}` : "#"}
              className="flex items-center gap-4 border-b border-border px-6 py-4 hover:bg-subtle"
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
          ))
        )}
      </div>
    </>
  );
}
