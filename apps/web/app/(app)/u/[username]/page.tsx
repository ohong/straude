import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, LinkIcon, Github, Flame, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AchievementBadges } from "@/components/app/profile/AchievementBadges";
import { ContributionGraph } from "@/components/app/profile/ContributionGraph";
import { FeedList } from "@/components/app/feed/FeedList";
import { FollowButton } from "@/components/app/profile/FollowButton";
import type { Metadata } from "next";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();
  if (!profile.is_public && authUser?.id !== profile.id) notFound();

  const isOwn = authUser?.id === profile.id;

  // Check follow status
  let isFollowing = false;
  if (authUser && !isOwn) {
    const { data: f } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", authUser.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    isFollowing = !!f;
  }

  // Run independent queries in parallel
  const [
    { count: followersCount },
    { count: followingCount },
    { count: postsCount },
    { data: streak },
    { data: totalSpendRows },
    { data: achievements },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase.rpc("calculate_user_streak", { p_user_id: profile.id }),
    supabase
      .from("daily_usage")
      .select("cost_usd, output_tokens")
      .eq("user_id", profile.id),
    supabase
      .from("user_achievements")
      .select("*")
      .eq("user_id", profile.id),
  ]);
  const totalSpend = totalSpendRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const lifetimeOutputTokens = totalSpendRows?.reduce((s, r) => s + Number(r.output_tokens), 0) ?? 0;

  // Contribution data (current year)
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const { data: contributions } = await supabase
    .from("daily_usage")
    .select("date, cost_usd")
    .eq("user_id", profile.id)
    .gte("date", yearStart)
    .lte("date", yearEnd);

  const { data: postDates } = await supabase
    .from("posts")
    .select("daily_usage:daily_usage!posts_daily_usage_id_fkey(date)")
    .eq("user_id", profile.id);

  const postDateSet = new Set(
    postDates?.map((p: any) => p.daily_usage?.date).filter(Boolean)
  );

  const contributionData = (contributions ?? []).map((c) => ({
    date: c.date,
    cost_usd: Number(c.cost_usd),
    has_post: postDateSet.has(c.date),
  }));

  // Recent posts
  const { data: posts } = await supabase
    .from("posts")
    .select(
      `
      *,
      user:users!posts_user_id_fkey(*),
      daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
      kudos_count:kudos(count),
      comment_count:comments(count)
    `
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  let normalizedPosts: any[] = [];
  if (posts && posts.length > 0) {
    const postIds = posts.map((p: any) => p.id);

    const [{ data: userKudos }, { data: recentKudos }, { data: recentComments }] =
      await Promise.all([
        authUser
          ? supabase
              .from("kudos")
              .select("post_id")
              .eq("user_id", authUser.id)
              .in("post_id", postIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("kudos")
          .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 3),
        supabase
          .from("comments")
          .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false }),
      ]);

    const kudosedSet = new Set(userKudos?.map((k) => k.post_id));

    const kudosUsersMap = new Map<string, any[]>();
    for (const k of recentKudos ?? []) {
      const list = kudosUsersMap.get(k.post_id) ?? [];
      if (list.length < 3) {
        list.push(k.user);
        kudosUsersMap.set(k.post_id, list);
      }
    }

    const commentsMap = new Map<string, any[]>();
    for (const c of recentComments ?? []) {
      const list = commentsMap.get(c.post_id) ?? [];
      if (list.length < 2) {
        list.push(c);
        commentsMap.set(c.post_id, list);
      }
    }
    for (const [, list] of commentsMap) {
      list.reverse();
    }

    normalizedPosts = posts.map((p: any) => ({
      ...p,
      kudos_count: p.kudos_count?.[0]?.count ?? 0,
      kudos_users: kudosUsersMap.get(p.id) ?? [],
      comment_count: p.comment_count?.[0]?.count ?? 0,
      recent_comments: commentsMap.get(p.id) ?? [],
      has_kudosed: kudosedSet.has(p.id),
    }));
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
        <h3 className="text-lg font-medium">@{username}</h3>
      </header>

      {/* Profile header */}
      <div className="border-b border-border px-4 py-5 sm:p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar src={profile.avatar_url} alt={profile.username ?? ""} size="lg" fallback={profile.username ?? "?"} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-medium sm:text-2xl" style={{ letterSpacing: "-0.03em" }}>
                {profile.display_name ?? profile.username}
              </h1>
              {!isOwn && authUser && (
                <FollowButton
                  username={username}
                  initialFollowing={isFollowing}
                />
              )}
              {isOwn && (
                <Link
                  href="/settings"
                  className="border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle"
                  style={{ borderRadius: 4 }}
                >
                  Edit Profile
                </Link>
              )}
            </div>
            {profile.display_name && (
              <p className="text-sm text-muted">@{profile.username}</p>
            )}
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
              {profile.country && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {profile.country}
                </span>
              )}
              {profile.link && (
                <a
                  href={profile.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <LinkIcon size={14} /> {profile.link.replace(/^https?:\/\//, "")}
                </a>
              )}
              {profile.github_username && (
                <a
                  href={`https://github.com/${profile.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Github size={14} /> {profile.github_username}
                </a>
              )}
            </div>
            <div className="mt-3 flex gap-6 text-sm">
              <Link href={`/u/${username}/follows?tab=following`} className="hover:underline">
                <strong>{followingCount ?? 0}</strong>{" "}
                <span className="text-muted">Following</span>
              </Link>
              <Link href={`/u/${username}/follows?tab=followers`} className="hover:underline">
                <strong>{followersCount ?? 0}</strong>{" "}
                <span className="text-muted">Followers</span>
              </Link>
              <span>
                <strong>{postsCount ?? 0}</strong>{" "}
                <span className="text-muted">Activities</span>
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[0.7rem] uppercase tracking-widest text-muted">Streak</p>
            <p className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums">
              <Flame size={16} className="text-accent" />
              {streak ?? 0} days
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-widest text-muted">Output Tokens</p>
            <p className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums">
              <Zap size={16} className="text-accent" />
              {formatTokens(lifetimeOutputTokens)}
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-widest text-muted">Total Spend</p>
            <p className="font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-accent">
              ${totalSpend.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Achievement badges */}
        {(achievements && achievements.length > 0 || isOwn) && (
          <div className="mt-6">
            <p className="mb-2 text-[0.7rem] uppercase tracking-widest text-muted">Achievements</p>
            <AchievementBadges earned={achievements ?? []} showLocked={isOwn} />
          </div>
        )}
      </div>

      {/* Contribution graph */}
      <div className="border-b border-border px-4 py-5 sm:p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Contributions
        </p>
        <ContributionGraph data={contributionData} />
      </div>

      {/* Posts */}
      <div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Recent Activities
          </p>
        </div>
        {normalizedPosts.length > 0 ? (
          <FeedList initialPosts={normalizedPosts} userId={authUser?.id ?? null} showTabs={false} />
        ) : (
          <div className="px-4 py-12 text-center text-sm text-muted sm:px-6">
            No activities yet.
          </div>
        )}
      </div>
    </>
  );
}
