import Link from "next/link";
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

  const onboardingIncomplete = !profile?.onboarding_completed;

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
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {onboardingIncomplete && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-accent/5 px-4 py-2 text-sm">
          <span className="text-muted">Finish setting up your profile</span>
          <Link href="/onboarding" className="font-medium text-accent hover:underline">
            Complete onboarding
          </Link>
        </div>
      )}
      <TopHeader
        username={profile?.username ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 border-x border-border">
        {/* Left sidebar — hidden below lg */}
        <aside className="hidden w-60 shrink-0 overflow-y-auto overscroll-contain border-r border-border lg:flex lg:flex-col">
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
        <main className="min-w-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", overscrollBehavior: "contain" }}>
          <div className="pb-[60px] lg:pb-0">
            {children}
          </div>
        </main>

        {/* Right sidebar — hidden below xl */}
        <aside className="hidden w-80 shrink-0 overflow-y-auto overscroll-contain border-l border-border xl:flex xl:flex-col">
          <RightSidebar userId={user.id} />
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav username={profile?.username} />

      <a
        href="https://x.com/oscrhong"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-3 right-3 hidden text-sm text-muted hover:text-foreground lg:block"
      >
        Feedback? DM us.
      </a>
    </div>
  );
}
