import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { LeaderboardTable } from "@/components/app/leaderboard/LeaderboardTable";
import type { LeaderboardEntry } from "@/types";
import type { Metadata } from "next";

type LeaderboardViewRow = Omit<LeaderboardEntry, "rank" | "streak"> & {
  display_name: string | null;
  total_cost: number | string;
  total_output_tokens: number | string;
};

const LEADERBOARD_DESCRIPTION =
  "Who's logging the most AI usage? Individual & team rankings by token spend from the Strava for Claude Code.";

const SOCIAL_IMAGE = {
  url: "/og-image.png?v=2",
  width: 1200,
  height: 630,
  alt: "Straude — Code like an athlete. Track your Claude Code spend, compete with friends, share your breakthrough sessions.",
  type: "image/png",
};

export const metadata: Metadata = {
  title: "Leaderboard",
  description: LEADERBOARD_DESCRIPTION,
  alternates: {
    canonical: "/leaderboard",
  },
  openGraph: {
    url: "https://straude.com/leaderboard",
    title: "Global Tokenmaxxing Leaderboard | Straude",
    description: LEADERBOARD_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Global Tokenmaxxing Leaderboard | Straude",
    description: LEADERBOARD_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; region?: string }>;
}) {
  const { period = "week", region } = await searchParams;
  const user = await getAuthUser();
  const supabase = await createClient();
  const db = getServiceClient();

  // We'll use the materialized view directly for SSR
  const viewName = `leaderboard_${period === "all_time" ? "all_time" : period === "month" ? "monthly" : period === "day" ? "daily" : "weekly"}`;

  let query = supabase
    .from(viewName)
    .select("*")
    .order("total_cost", { ascending: false })
    .limit(50);

  if (region) {
    query = query.eq("region", region);
  }
  const { data: rawEntries } = await query;
  const entries = (rawEntries ?? []) as LeaderboardViewRow[];

  // Fetch streaks + levels for all leaderboard users in parallel
  const userIds = entries.map((entry) => entry.user_id);
  const [{ data: streakRows }, { data: levelRows }] = userIds.length > 0
    ? await Promise.all([
        supabase.rpc("calculate_streaks_batch", { p_user_ids: userIds }),
        db.from("user_levels").select("user_id, level").in("user_id", userIds),
      ])
    : [{ data: [] }, { data: [] }];

  const streakMap = new Map<string, number>();
  for (const row of streakRows ?? []) {
    streakMap.set(row.user_id, row.streak);
  }

  const levelMap = new Map<string, number>();
  for (const row of levelRows ?? []) {
    levelMap.set(row.user_id, Number(row.level));
  }

  // Add rank numbers and streaks
  const ranked: LeaderboardEntry[] = entries.map((entry, i) => ({
      ...entry,
      rank: i + 1,
      total_cost: Number(entry.total_cost),
      total_output_tokens: Number(entry.total_output_tokens),
      streak: streakMap.get(entry.user_id) ?? 0,
      level: levelMap.get(entry.user_id),
    }));

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Claude Code Global Leaderboard",
    description: "Top Claude Code users ranked by weekly spend",
    itemListElement: ranked.slice(0, 10).map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://straude.com/u/${entry.username}`,
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the Claude Code global leaderboard?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Straude leaderboard ranks Claude Code users by their weekly spend. Users push their usage data via the Straude CLI, and the leaderboard updates in real time with daily, weekly, monthly, and all-time rankings.",
        },
      },
      {
        "@type": "Question",
        name: "How are Claude Code users ranked on Straude?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Users are ranked by total Claude Code spend in the selected period. The leaderboard shows weekly rankings by default, with options for daily, monthly, and all-time views. Only users with public profiles appear.",
        },
      },
      {
        "@type": "Question",
        name: "Who spends the most on Claude Code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Straude leaderboard at straude.com/leaderboard shows the top Claude Code spenders updated in real time. View daily, weekly, monthly, or all-time rankings to see who's logging the most usage.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a Strava for Claude Code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — Straude (straude.com) is often described as Strava for Claude Code. It tracks your AI coding sessions, spending, and streaks, then ranks you on a global leaderboard against other developers.",
        },
      },
    ],
  };

  return (
    <>
      <h1 className="sr-only">Claude Code Global Leaderboard</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LeaderboardTable
        entries={ranked}
        currentUserId={user?.id ?? null}
        currentPeriod={period}
        currentRegion={region ?? null}
      />
      {!user && (
        <nav aria-label="Related pages" className="flex gap-4 border-t border-border px-4 py-4 text-sm sm:px-6">
          <Link href="/feed" className="font-medium text-accent hover:underline">
            Community Feed →
          </Link>
          <Link href="/open" className="font-medium text-accent hover:underline">
            Usage Statistics →
          </Link>
        </nav>
      )}
    </>
  );
}
