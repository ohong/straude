import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { FeedList } from "@/components/app/feed/FeedList";
import { enrichFeedPosts, getFeedCursor, getPendingPosts } from "@/lib/feed-enrichment";
import type { FeedPostRow } from "@/types";
import type { Metadata } from "next";

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
  const [{ data: feedData }, pendingPosts] = await Promise.all([
    supabase.rpc("get_feed", {
      p_type: feedType,
      p_user_id: user?.id ?? null,
      p_limit: 20,
    }),
    getPendingPosts(supabase, user?.id ?? null),
  ]);
  const posts = await enrichFeedPosts({
    posts: (feedData ?? []) as FeedPostRow[],
    userId: user?.id ?? null,
    userScopedClient: supabase,
  });
  const nextCursor = getFeedCursor(posts, 20);

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
      <FeedList
        initialPosts={posts}
        initialNextCursor={nextCursor}
        userId={user?.id ?? null}
        feedType={feedType}
        pendingPosts={pendingPosts}
      />
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
