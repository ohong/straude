import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  OPEN_STATS_REVALIDATE_SECONDS,
  getOpenStatsForPage,
} from "@/lib/open-stats";
import { formatTokens } from "@/lib/utils/format";
import type { Metadata } from "next";

export const revalidate = OPEN_STATS_REVALIDATE_SECONDS; // refresh once per day

export const metadata: Metadata = {
  title: { absolute: "Global AI Token Usage Statistics | Straude" },
  description:
    "How much does the average Claude Code user spend? See daily, anonymized usage statistics: total spend, tokens processed, most popular models, and spending distribution across all Straude users.",
  alternates: { canonical: "/open" },
  openGraph: {
    url: "/open",
    title: "Claude Code Usage Statistics — Daily Snapshot from Straude",
    description:
      "Daily Claude Code usage statistics from the Straude community. Average spend, popular models, and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Usage Statistics",
    description:
      "How much does the average Claude Code user spend? Daily data from Straude.",
  },
};

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                         */
/* -------------------------------------------------------------------------- */

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtUsdDecimal(n: number): string {
  if (n >= 100) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
}

function segmentLabel(seg: string): string {
  switch (seg) {
    case "top_1":
      return "Top 1%";
    case "top_5":
      return "Top 5%";
    case "top_10":
      return "Top 10%";
    case "rest":
      return "Everyone else";
    default:
      return seg;
  }
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default async function OpenStatsPage() {
  const stats = await getOpenStatsForPage();

  const top10Pct = stats.cumulativePct["top_10"] ?? 0;
  const topModels = stats.models.slice(0, 3);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does the average Claude Code user spend?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Based on Straude community data, the average tracked user spends about ${fmtUsdDecimal(stats.avgWeeklySpend)} per week. Spending is heavily concentrated — the top 10% of users account for ${top10Pct}% of total spend.`,
        },
      },
      {
        "@type": "Question",
        name: "How do I track my Claude Code spending?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Straude tracks Claude Code spending automatically. Run npx straude@latest to sync your usage data. Straude tracks cost per session, tokens used, model breakdown, and daily streaks, then refreshes the public stats snapshot every day.",
        },
      },
      {
        "@type": "Question",
        name: "What models do Claude Code users use most?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            topModels.length >= 3
              ? `Based on Straude data, the most popular models are ${topModels[0].name} (${topModels[0].pct}%), ${topModels[1].name} (${topModels[1].pct}%), and ${topModels[2].name} (${topModels[2].pct}%).`
              : "Model usage data is currently being collected.",
        },
      },
      {
        "@type": "Question",
        name: "What is Straude?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Straude is a usage tracker for Claude Code \u2014 often described as Strava for Claude Code. It tracks AI coding sessions, spending, streaks, and ranks users on a global leaderboard at straude.com.",
        },
      },
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Straude",
        item: "https://straude.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Usage Statistics",
        item: "https://straude.com/open",
      },
    ],
  };

  const updatedHuman = new Date(stats.fetchedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <Navbar variant="light" />

      <main className="bg-background py-32 text-foreground md:py-40">
        <article className="mx-auto max-w-3xl px-6 md:px-8">
          {/* ---- Header -------------------------------------------------- */}
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Claude Code Usage Statistics
          </h1>
          <p className="mt-2 text-[0.9375rem] text-foreground/80">
            Daily, anonymized data from the Straude community.
          </p>
          <p className="mt-2 text-sm text-muted">
            {stats.source === "snapshot"
              ? "Showing the last successful snapshot while the live refresh recovers."
              : "Updated daily from the latest successful Straude snapshot."}
          </p>

          {/* ---- Big Number Grid ----------------------------------------- */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StatCard label="Total Spend" value={fmtUsd(stats.totalSpend)} />
            <StatCard
              label="Total Tokens"
              value={formatTokens(stats.totalTokens)}
            />
            <StatCard
              label="Avg Streak"
              value={`${stats.avgStreak}`}
              context="days"
            />
          </div>

          {/* ---- Spending Distribution ----------------------------------- */}
          <div className="mt-16 space-y-10 text-[0.9375rem] leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-lg font-bold text-foreground">
                How Much Does the Average Claude Code User Spend?
              </h2>
              <p className="mt-3">
                Across{" "}
                <strong className="text-foreground">
                  {stats.trackedUsers.toLocaleString("en-US")}
                </strong>{" "}
                tracked users and{" "}
                <strong className="text-foreground">
                  {stats.totalSessions.toLocaleString("en-US")}
                </strong>{" "}
                logged sessions, the average Straude user spends about{" "}
                <strong className="text-foreground">
                  {fmtUsdDecimal(stats.avgWeeklySpend)}
                </strong>{" "}
                per week.
              </p>
              <p className="mt-3">
                Straude users have tracked a combined{" "}
                <strong className="text-foreground">
                  {fmtUsd(stats.totalSpend)}
                </strong>{" "}
                in Claude Code spend so far.
              </p>

              {stats.concentration.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table
                    className="w-full text-left text-[0.8125rem]"
                    aria-label="Spending concentration by user segment"
                  >
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-widest text-muted">
                        <th scope="col" className="pb-2 pr-4 font-medium">
                          Segment
                        </th>
                        <th scope="col" className="pb-2 pr-4 font-medium">
                          Total Spend
                        </th>
                        <th scope="col" className="pb-2 font-medium">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.concentration.map((row) => (
                        <tr
                          key={row.segment}
                          className="border-b border-border/50"
                        >
                          <td className="py-2 pr-4 font-medium text-foreground">
                            {segmentLabel(row.segment)}
                          </td>
                          <td className="py-2 pr-4 font-[family-name:var(--font-mono)]">
                            {fmtUsd(row.total_spend)}
                          </td>
                          <td className="py-2 font-[family-name:var(--font-mono)]">
                            {row.pct_of_total}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ---- Model Popularity -------------------------------------- */}
            {stats.models.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-foreground">
                  Most Popular Models
                </h2>
                <p className="mt-3">
                  Ranked by share of total spend across all sessions.
                </p>
                <ol
                  className="mt-4 space-y-2"
                  aria-label="Models ranked by spend share"
                >
                  {stats.models.map((m, i) => (
                    <li key={m.name} className="flex items-baseline gap-3">
                      <span className="w-6 shrink-0 text-right font-[family-name:var(--font-mono)] text-xs text-muted">
                        {i + 1}.
                      </span>
                      <span className="font-medium text-foreground">
                        {m.name}
                      </span>
                      <span className="flex-1 border-b border-dotted border-border/50" />
                      <span className="font-[family-name:var(--font-mono)] text-foreground">
                        {m.pct}%
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* ---- CTA --------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">
                Track Your Own Usage
              </h2>
              <p className="mt-3">
                One command to start logging. Your data joins the community
                totals above — anonymized, aggregated, and refreshed daily.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-subtle px-4 py-3 font-mono text-[0.8125rem] leading-relaxed">
                npx straude@latest
              </pre>
            </section>

            {/* ---- Cross-links ------------------------------------------- */}
            <nav aria-label="Related pages" className="flex flex-wrap gap-4 text-sm">
              <Link href="/leaderboard" className="font-medium text-accent hover:underline">
                Global Leaderboard →
              </Link>
              <Link href="/feed" className="font-medium text-accent hover:underline">
                Community Feed →
              </Link>
              <Link href="/cli" className="font-medium text-accent hover:underline">
                CLI Reference →
              </Link>
            </nav>

            {/* ---- Last Updated ------------------------------------------ */}
            <div className="pt-4 text-xs text-muted">
              <time dateTime={stats.fetchedAt} suppressHydrationWarning>
                Last updated: {updatedHuman}
              </time>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  StatCard — inline to avoid creating a separate component file              */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  context,
}: {
  label: string;
  value: string;
  context?: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold font-[family-name:var(--font-mono)] text-foreground">
        {value}
      </p>
      {context && (
        <p className="mt-0.5 text-xs text-muted">{context}</p>
      )}
    </div>
  );
}
