import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getProfileAccessContext } from "@/lib/profile-access";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, LinkIcon, Github, Flame, Zap, Users, Lock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LevelBadge, LevelDialogTrigger } from "@/components/app/shared/LevelBadge";
import { AchievementBadges } from "@/components/app/profile/AchievementBadges";
import { ContributionGraph } from "@/components/app/profile/ContributionGraph";
import { ProfileSharePanel } from "@/components/app/profile/ProfileSharePanel";
import { FeedList } from "@/components/app/feed/FeedList";
import { FollowButton } from "@/components/app/profile/FollowButton";
import { InviteButton } from "@/components/app/profile/InviteButton";
import { CrewPopover, type CrewMember } from "@/components/app/profile/CrewPopover";
import { formatTokens } from "@/lib/utils/format";
import { normalizeCommentPreview, type JoinedUserSummary, type RawCommentPreviewRow } from "@/lib/feed-normalization";
import { firstRelation } from "@/lib/utils/first-relation";
import type { CommentPreviewItem, FeedPostRow, Post, UserSummary } from "@/types";
import type { Metadata } from "next";

type PostDateRow = {
  daily_usage: Array<{ date: string }> | null;
};

type KudosRow = {
  post_id: string;
  user: JoinedUserSummary;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  region: string | null;
  link: string | null;
  github_username: string | null;
  is_public: boolean;
  streak_freezes: number | null;
  referred_by: string | null;
};

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
  const access = await getProfileAccessContext<ProfileRow>(
    username,
    "id, username, display_name, avatar_url, bio, country, region, link, github_username, is_public, streak_freezes, referred_by",
  );
  if (!access) notFound();

  const { authUserId, canView, isFollowing, isOwn, profile } = access;
  const supabase = await createClient();
  const db = getServiceClient();

  if (!canView) {
    return (
      <>
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
          <h3 className="text-lg font-medium">@{username}</h3>
        </header>
        <div className="border-b border-border px-4 py-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <Avatar src={profile.avatar_url} alt={profile.username ?? ""} size="lg" fallback={profile.username ?? "?"} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl font-medium sm:text-2xl" style={{ letterSpacing: "-0.03em" }}>
                  {profile.display_name ?? profile.username}
                </h1>
                {authUserId && (
                  <FollowButton username={username} initialFollowing={isFollowing} />
                )}
              </div>
              {profile.display_name && (
                <p className="text-sm text-muted">@{profile.username}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Lock size={32} className="text-muted" />
          <p className="text-sm font-medium">This profile is private</p>
          <p className="text-sm text-muted">Follow @{username} to see their activity.</p>
        </div>
      </>
    );
  }

  // Run all independent queries in parallel (including follow check)
  const [
    { count: followersCount },
    { count: followingCount },
    { count: postsCount },
    { data: streak },
    { data: totalSpendRows },
    { data: achievements },
    { data: levelRow },
    { data: referrerData },
    { data: crewMembers },
  ] = await Promise.all([
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    db
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id),
    db.rpc("calculate_user_streak", { p_user_id: profile.id, p_freeze_days: profile.streak_freezes ?? 0 }),
    db
      .from("daily_usage")
      .select("cost_usd, output_tokens")
      .eq("user_id", profile.id),
    db
      .from("user_achievements")
      .select("*")
      .eq("user_id", profile.id),
    db
      .from("user_levels")
      .select("level")
      .eq("user_id", profile.id)
      .maybeSingle(),
    profile.referred_by
      ? db
          .from("users")
          .select("username, avatar_url")
          .eq("id", profile.referred_by)
          .single()
      : Promise.resolve({ data: null }),
    db
      .from("users")
      .select("username, display_name, avatar_url")
      .eq("referred_by", profile.id)
      .order("created_at", { ascending: true }),
  ]);
  const totalSpend = totalSpendRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const lifetimeOutputTokens = totalSpendRows?.reduce((s, r) => s + Number(r.output_tokens), 0) ?? 0;

  // Contribution data (current year)
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const { data: contributions } = await db
    .from("daily_usage")
    .select("date, cost_usd")
    .eq("user_id", profile.id)
    .gte("date", yearStart)
    .lte("date", yearEnd);

  const { data: postDates } = await db
    .from("posts")
    .select("daily_usage:daily_usage!posts_daily_usage_id_fkey(date)")
    .eq("user_id", profile.id);

  const postDateSet = new Set(
    ((postDates ?? []) as PostDateRow[])
      .map((post) => firstRelation(post.daily_usage)?.date)
      .filter((date): date is string => Boolean(date))
  );

  const contributionData = (contributions ?? []).map((c) => ({
    date: c.date,
    cost_usd: Number(c.cost_usd),
    has_post: postDateSet.has(c.date),
  }));

  // Recent posts — sorted by session date via unified RPC
  const { data: posts } = await db.rpc("get_feed", {
    p_type: "mine",
    p_user_id: profile.id,
    p_limit: 20,
  });

  let normalizedPosts: Post[] = [];
  if (posts && posts.length > 0) {
    const feedPosts = posts as FeedPostRow[];
    const postIds = feedPosts.map((post) => post.id);

    const [{ data: userKudos }, { data: recentKudos }, { data: recentComments }] =
      await Promise.all([
        authUserId
          ? supabase
              .from("kudos")
              .select("post_id")
              .eq("user_id", authUserId)
              .in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        db
          .from("kudos")
          .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 3),
        db
          .from("comments")
          .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
          .is("parent_comment_id", null)
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 2),
      ]);

    const kudosedSet = new Set(userKudos?.map((k) => k.post_id));

    const kudosUsersMap = new Map<string, UserSummary[]>();
    for (const kudos of (recentKudos ?? []) as KudosRow[]) {
      const list = kudosUsersMap.get(kudos.post_id) ?? [];
      const userSummary = firstRelation(kudos.user);
      if (list.length < 3 && userSummary) {
        list.push(userSummary);
        kudosUsersMap.set(kudos.post_id, list);
      }
    }

    const commentsMap = new Map<string, CommentPreviewItem[]>();
    for (const comment of (recentComments ?? []) as RawCommentPreviewRow[]) {
      const list = commentsMap.get(comment.post_id) ?? [];
      if (list.length < 2) {
        list.push(normalizeCommentPreview(comment));
        commentsMap.set(comment.post_id, list);
      }
    }
    for (const [, list] of commentsMap) {
      list.reverse();
    }

    normalizedPosts = feedPosts.map((post) => ({
      ...post,
      kudos_count: typeof post.kudos_count === "number" ? post.kudos_count : post.kudos_count?.[0]?.count ?? 0,
      kudos_users: kudosUsersMap.get(post.id) ?? [],
      comment_count: typeof post.comment_count === "number" ? post.comment_count : post.comment_count?.[0]?.count ?? 0,
      recent_comments: commentsMap.get(post.id) ?? [],
      has_kudosed: kudosedSet.has(post.id),
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
              {levelRow?.level ? (
                <LevelBadge level={Number(levelRow.level)} />
              ) : null}
              {!isOwn && authUserId && (
                <>
                  <FollowButton
                    username={username}
                    initialFollowing={isFollowing}
                  />
                  <Link
                    href={`/messages?with=${encodeURIComponent(username)}`}
                    className="border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle"
                    style={{ borderRadius: 4 }}
                  >
                    Message
                  </Link>
                </>
              )}
              {isOwn && (
                <>
                  <Link
                    href="/settings"
                    className="border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle"
                    style={{ borderRadius: 4 }}
                  >
                    Edit Profile
                  </Link>
                  <InviteButton username={username} />
                </>
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
              {referrerData?.username && (
                <span className="inline-flex items-center gap-1">
                  <Users size={14} /> Recruited by{" "}
                  <Link href={`/u/${referrerData.username}`} className="text-accent hover:underline">
                    @{referrerData.username}
                  </Link>
                </span>
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
          {levelRow?.level ? (
            <LevelDialogTrigger level={Number(levelRow.level)} className="cursor-pointer text-left hover:opacity-80">
              <p className="text-[0.7rem] uppercase tracking-widest text-muted">Level</p>
              <p className="font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-accent">
                L{Number(levelRow.level)}
              </p>
              <p className="text-xs text-muted">Your 30-day heat check</p>
            </LevelDialogTrigger>
          ) : (
            <div>
              <p className="text-[0.7rem] uppercase tracking-widest text-muted">Level</p>
              <p className="font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-accent">
                L0
              </p>
              <p className="text-xs text-muted">Just getting started</p>
            </div>
          )}
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
          {(crewMembers ?? []).length > 0 && (
            <CrewPopover
              count={(crewMembers ?? []).length}
              members={(crewMembers ?? []) as CrewMember[]}
            />
          )}
        </div>

        {/* Achievement badges */}
        {(achievements && achievements.length > 0 || isOwn) && (
          <div className="mt-6">
            <p className="mb-2 text-[0.7rem] uppercase tracking-widest text-muted">Achievements</p>
            <AchievementBadges earned={achievements ?? []} showLocked={isOwn} />
          </div>
        )}

        <div className="mt-6 rounded-[10px] border border-border bg-subtle/40 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Levels reflect how deep you've gone into agentic coding.
          </p>
          <p className="mt-1 text-muted">
            From first completions to building your own orchestrator.
          </p>
        </div>
      </div>

      {/* Contribution graph */}
      <div className="border-b border-border px-4 py-5 sm:p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Contributions
        </p>
        <ContributionGraph data={contributionData} />
        <ProfileSharePanel
          username={profile.username ?? username}
          isPublic={profile.is_public}
          isOwner={isOwn}
        />
      </div>

      {/* Posts */}
      <div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Recent Activities
          </p>
        </div>
        {normalizedPosts.length > 0 ? (
          <FeedList initialPosts={normalizedPosts} userId={authUserId} showTabs={false} />
        ) : (
          <div className="px-4 py-12 text-center text-sm text-muted sm:px-6">
            No activities yet.
          </div>
        )}
      </div>
    </>
  );
}
