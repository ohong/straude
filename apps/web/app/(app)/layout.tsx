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
  const [
    followingRes,
    followersRes,
    postsRes,
    latestPostRes,
    streakRes,
    allTimeUsageRes,
  ] = await Promise.all([
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
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.rpc("calculate_user_streak", { p_user_id: user.id }),
    supabase
      .from("daily_usage")
      .select("cost_usd, output_tokens")
      .eq("user_id", user.id),
  ]);

  const followingCount = followingRes.count ?? 0;
  const followersCount = followersRes.count ?? 0;
  const postsCount = postsRes.count ?? 0;
  const streak = Number(streakRes.data) || 0;

  const totalOutputTokens =
    allTimeUsageRes.data?.reduce((s, r) => s + Number(r.output_tokens), 0) ?? 0;
  const totalCost =
    allTimeUsageRes.data?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;

  const latestPosts = (latestPostRes.data ?? []).map((row) => ({
    id: row.id,
    title: row.title ?? "Untitled",
    date: new Date(row.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

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
            latestPosts={latestPosts}
            totalOutputTokens={totalOutputTokens}
            totalCost={totalCost}
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
