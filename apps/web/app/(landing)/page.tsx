import { Suspense } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Ticker } from "@/components/landing/Ticker";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { PrometheusPreview } from "@/components/landing/PrometheusPreview";
import { PrivacyPledge } from "@/components/landing/PrivacyPledge";
import { WallOfLove } from "@/components/landing/WallOfLove";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { LazyHalftoneCanvas } from "@/components/landing/LazyHalftoneCanvas";
import { wallOfLovePosts } from "@/content/wall-of-love";
import { getServiceClient } from "@/lib/supabase/service";
import { getOpenStatsForPage } from "@/lib/open-stats";
import { formatTokens } from "@/lib/utils/format";
import type { Metadata } from "next";

export const revalidate = 86400; // cache for 1 day

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
  const [stats, { data: topUser }] = await Promise.all([
    getOpenStatsForPage(),
    getServiceClient()
      .from("leaderboard_weekly")
      .select("username, total_output_tokens")
      .order("total_output_tokens", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const paceLeader = topUser
    ? `@${topUser.username} (${formatTokens(topUser.total_output_tokens)}/wk)`
    : "---";

  return [
    { label: "Pace Leader", value: paceLeader },
    {
      label: "Sessions Logged",
      value: stats.totalSessions.toLocaleString("en-US"),
    },
    { label: "Tokens Processed", value: formatTokens(stats.totalTokens) },
    {
      label: "Spend Tracked",
      value: `$${Math.round(stats.totalSpend).toLocaleString("en-US")}`,
    },
    { label: "Active Streaks", value: stats.totalStreaks.toLocaleString("en-US") },
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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-landing-bg text-landing-text">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Straude",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "macOS, Linux, Windows",
              url: "https://straude.com",
              description:
                "One command to log your Claude Code output. Track your spend, compare your pace, keep the streak alive.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        <LazyHalftoneCanvas />
        <div className="relative z-10">
          <Navbar />
          <main id="main-content">
            <Hero />
            <Suspense fallback={<Ticker items={TICKER_FALLBACK} />}>
              <TickerWithData />
            </Suspense>
            <FeaturesGrid />
            <PrometheusPreview />
            <WallOfLove posts={wallOfLovePosts} />
            <PrivacyPledge />
            <CTASection />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
