import { Suspense } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Ticker } from "@/components/landing/Ticker";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { GlobalFeed } from "@/components/landing/GlobalFeed";
import { WallOfLove } from "@/components/landing/WallOfLove";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { HalftoneCanvas } from "@/components/landing/HalftoneCanvas";
import { wallOfLovePosts } from "@/content/wall-of-love";
import { getServiceClient } from "@/lib/supabase/service";
import { formatTokens } from "@/lib/utils/format";
import type { Metadata } from "next";

export const revalidate = 300; // cache for 5 minutes

export const metadata: Metadata = {
  title: "Straude — Code like an athlete.",
  description:
    "One command to log your Claude Code output. Track your spend, compare your pace, keep the streak alive.",
};

const TICKER_FALLBACK = [
  { label: "Pace Leader", value: "---" },
  { label: "Sessions Logged", value: "---" },
  { label: "Tokens Processed", value: "---" },
  { label: "Spend Tracked", value: "---" },
  { label: "Active Streaks", value: "---" },
];

async function getTickerStats() {
  const supabase = getServiceClient();

  // Run independent queries in parallel
  const [{ data: usageRows }, { data: topUser }] = await Promise.all([
    supabase
      .from("daily_usage")
      .select("session_count, total_tokens, cost_usd, user_id, date")
      .order("date", { ascending: false }),
    supabase
      .from("leaderboard_weekly")
      .select("username, total_output_tokens")
      .order("total_output_tokens", { ascending: false })
      .limit(1)
      .single(),
  ]);

  let totalSessions = 0;
  let totalTokens = 0;
  let totalSpend = 0;
  const datesByUser = new Map<string, string[]>();
  for (const row of usageRows ?? []) {
    totalSessions += row.session_count ?? 0;
    totalTokens += row.total_tokens ?? 0;
    totalSpend += row.cost_usd ?? 0;
    if (row.user_id && row.date) {
      const dates = datesByUser.get(row.user_id) ?? [];
      dates.push(row.date);
      datesByUser.set(row.user_id, dates);
    }
  }

  // Sum of all current streaks (consecutive days ending at most recent entry per user)
  const DAY_MS = 86_400_000;

  let totalStreaks = 0;
  for (const [, dates] of datesByUser) {
    const sorted = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]).getTime();
      const curr = new Date(sorted[i]).getTime();
      if (prev - curr <= DAY_MS) {
        streak++;
      } else {
        break;
      }
    }
    totalStreaks += streak;
  }

  const paceLeader = topUser
    ? `@${topUser.username} (${formatTokens(topUser.total_output_tokens)}/wk)`
    : "---";

  return [
    { label: "Pace Leader", value: paceLeader },
    {
      label: "Sessions Logged",
      value: totalSessions.toLocaleString("en-US"),
    },
    { label: "Tokens Processed", value: formatTokens(totalTokens) },
    {
      label: "Spend Tracked",
      value: `$${Math.round(totalSpend).toLocaleString("en-US")}`,
    },
    { label: "Active Streaks", value: totalStreaks.toLocaleString("en-US") },
  ];
}

async function TickerWithData() {
  let items: { label: string; value: string }[];
  try {
    items = await getTickerStats();
  } catch {
    items = TICKER_FALLBACK;
  }
  return <Ticker items={items} />;
}

export default function LandingPage() {
  return (
    <div className="bg-[#050505] text-[#F0F0F0] min-h-screen relative">
      <HalftoneCanvas />
      <div className="relative z-10">
        <Navbar />
        <main>
          <Hero />
          <Suspense fallback={<Ticker items={TICKER_FALLBACK} />}>
            <TickerWithData />
          </Suspense>
          <FeaturesGrid />
          <Suspense fallback={null}>
            <GlobalFeed />
          </Suspense>
          <WallOfLove posts={wallOfLovePosts} />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
