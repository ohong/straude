import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TopHeader } from "@/components/app/shared/TopHeader";
import { Sidebar } from "@/components/app/shared/Sidebar";
import { RightSidebar } from "@/components/app/shared/RightSidebar";
import { MobileNav } from "@/components/app/shared/MobileNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch sidebar data in parallel
  const [followingRes, followersRes, postsRes, latestPostRes, streakRes] =
    await Promise.all([
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", user.id),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", user.id),
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("posts")
        .select("title, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.rpc("calculate_user_streak", { p_user_id: user.id }),
    ]);

  const followingCount = followingRes.count ?? 0;
  const followersCount = followersRes.count ?? 0;
  const postsCount = postsRes.count ?? 0;
  const streak = Number(streakRes.data) || 0;

  const latestPostRow = latestPostRes.data?.[0] ?? null;
  const latestPost = latestPostRow
    ? {
        title: latestPostRow.title ?? "Untitled",
        date: new Date(latestPostRow.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      }
    : null;

  return (
    <>
      <TopHeader
        username={profile?.username ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <div className="mx-auto flex h-screen w-full max-w-[1600px] border-x border-border lg:h-[calc(100vh-3.5rem)]">
        {/* Left sidebar — hidden below lg */}
        <aside className="hidden w-60 shrink-0 border-r border-border lg:flex lg:flex-col">
          <Sidebar
            username={profile?.username ?? null}
            avatarUrl={profile?.avatar_url ?? null}
            displayName={profile?.display_name ?? null}
            followingCount={followingCount}
            followersCount={followersCount}
            postsCount={postsCount}
            streak={streak}
            latestPost={latestPost}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {children}
        </main>

        {/* Right sidebar — hidden below xl */}
        <aside className="hidden w-80 shrink-0 border-l border-border xl:flex xl:flex-col">
          <RightSidebar userId={user.id} />
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav username={profile?.username} />
    </>
  );
}
