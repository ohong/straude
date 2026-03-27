import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { FeedList } from "@/components/app/feed/FeedList";
import { normalizeCommentPreview, normalizeFeedPost, type JoinedUserSummary, type RawCommentPreviewRow } from "@/lib/feed-normalization";
import { firstRelation } from "@/lib/utils/first-relation";
import type { CommentPreviewItem, FeedPostRow, Post, UserSummary } from "@/types";
import type { Metadata } from "next";

type KudosRow = {
  post_id: string;
  user: JoinedUserSummary;
};

const FEED_DESCRIPTION =
  "Browse real Claude Code sessions from the Straude community. See what developers are building, how much they spend, and which models they use.";

const SOCIAL_IMAGE = {
  url: "/og-image.png?v=2",
  width: 1200,
  height: 630,
  alt: "Straude — Code like an athlete. Track your Claude Code spend, compete with friends, share your breakthrough sessions.",
  type: "image/png",
};

export const metadata: Metadata = {
  title: "Feed",
  description: FEED_DESCRIPTION,
  alternates: {
    canonical: "/feed",
  },
  openGraph: {
    url: "https://straude.com/feed",
    title: "Feed | Straude",
    description: FEED_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feed | Straude",
    description: FEED_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

type FeedType = "global" | "following" | "mine";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthUser();
  const supabase = await createClient();

  // Unauthenticated visitors can only see the global feed
  const feedType: FeedType =
    user && (params.tab === "following" || params.tab === "mine")
      ? params.tab
      : "global";

  // Feed + pending posts in parallel (independent queries)
  const [{ data: feedData }, { data: pendingData }] = await Promise.all([
    supabase.rpc("get_feed", {
      p_type: feedType,
      p_user_id: user?.id ?? null,
      p_limit: 20,
    }),
    user
      ? supabase
          .from("posts")
          .select("*, daily_usage:daily_usage!posts_daily_usage_id_fkey(*)")
          .eq("user_id", user.id)
          .is("description", null)
          .eq("images", "[]")
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
  ]);
  let posts: Post[] = ((feedData ?? []) as FeedPostRow[]).map(normalizeFeedPost);
  const pendingPosts: Post[] = ((pendingData ?? []) as FeedPostRow[]).map(normalizeFeedPost);

  // Enrich with kudos status + kudos users + recent comments
  if (posts.length > 0) {
    const postIds = posts.map((post) => post.id);

    // User-specific kudos check only when logged in
    const userKudosPromise = user
      ? supabase
          .from("kudos")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] });

    const [{ data: userKudos }, { data: recentKudos }, { data: recentComments }] =
      await Promise.all([
        userKudosPromise,
        supabase
          .from("kudos")
          .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 3),
        supabase
          .from("comments")
          .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
          .is("parent_comment_id", null)
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 2),
      ]);

    const kudosedSet = new Set((userKudos ?? []).map((k) => k.post_id));

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

    posts = posts.map((post) => ({
      ...post,
      kudos_users: kudosUsersMap.get(post.id) ?? [],
      recent_comments: commentsMap.get(post.id) ?? [],
      has_kudosed: kudosedSet.has(post.id),
    }));
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What are people building with Claude Code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Straude community feed shows real Claude Code sessions — full-stack apps, CLI tools, refactors, bug fixes, and more. Each post includes cost, tokens used, and models involved.",
        },
      },
      {
        "@type": "Question",
        name: "Can I see other people's Claude Code usage?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Straude's public feed shows Claude Code sessions shared by the community. Users choose what to publish — each post shows the session cost, models used, and a description of what was built.",
        },
      },
    ],
  };

  return (
    <>
      <h1 className="sr-only">Claude Code Community Feed</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FeedList initialPosts={posts} userId={user?.id ?? null} feedType={feedType} pendingPosts={pendingPosts} />
      {!user && (
        <nav aria-label="Related pages" className="flex gap-4 border-t border-border px-4 py-4 text-sm sm:px-6">
          <Link href="/leaderboard" className="font-medium text-accent hover:underline">
            Leaderboard →
          </Link>
          <Link href="/open" className="font-medium text-accent hover:underline">
            Usage Statistics →
          </Link>
        </nav>
      )}
    </>
  );
}
