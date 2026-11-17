import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { getOpenStatsForPage, getOpenStatsFreshness } from "@/lib/open-stats";
import { formatCurrency, formatTokens } from "@/lib/utils/format";
import type { Metadata } from "next";

export const revalidate = 3600; // keep snapshot age visible within an hour

export const metadata: Metadata = {
  title: { absolute: "Global AI Token Usage Statistics | Straude" },
  description:
    "Anonymized Claude Code and Codex statistics from Straude: estimated usage cost, tokens, model shares, and spending distribution, with the capture date and snapshot status.",
  alternates: { canonical: "/open" },
  openGraph: {
    url: "/open",
    title: "AI Coding Usage Statistics — Community Snapshot from Straude",
    description:
      "Claude Code and Codex statistics from the Straude community, including estimated usage cost, tokens, model shares, and capture status.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Coding Usage Statistics",
    description:
      "Estimated Claude Code and Codex usage cost, tokens, and model shares from Straude community snapshots.",
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
  return `$${formatCurrency(n)}`;
}

function segmentLabel(seg: string, percentiles: boolean): string {
  switch (seg) {
    case "top_1":
      return percentiles ? "Top 1%" : "Highest spending profile";
    case "top_5":
      return percentiles ? "Next 4%" : "Profiles ranked 2–5";
    case "top_10":
      return percentiles ? "Next 5%" : "Profiles ranked 6–10";
    case "rest":
      return "Everyone else";
    default:
      return seg;
  }
}

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default async function OpenStatsPage() {
  const stats = await getOpenStatsForPage();

  const freshness = getOpenStatsFreshness(stats);
  const available = freshness.state !== "unavailable";
  const percentiles = stats.concentrationBasis === "percentiles";
  const top10Pct = stats.cumulativePct["top_10"] ?? 0;
  const topGroup = percentiles ? "top 10% of profiles" : "ten highest spending profiles";
  const topModels = stats.models.slice(0, 3);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the average estimated weekly AI coding cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Based on Straude community data, average estimated weekly usage cost is about ${fmtUsdDecimal(stats.avgWeeklySpend)} per tracked profile. The ${topGroup} account for ${top10Pct}% of total estimated usage cost.`,
        },
      },
      {
        "@type": "Question",
        name: "How do I track my Claude Code spending?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Straude tracks Claude Code spending automatically. Run npx straude@latest to sync your usage data. Straude tracks cost per session, tokens used, model breakdown, and daily streaks, with a public stats snapshot scheduled daily.",
        },
      },
      {
        "@type": "Question",
        name: "Which models account for the most estimated usage cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            topModels.length >= 3
              ? `Based on Straude data, the models with the largest estimated cost shares are ${topModels[0].name} (${topModels[0].pct}%), ${topModels[1].name} (${topModels[1].pct}%), and ${topModels[2].name} (${topModels[2].pct}%).`
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

  const updatedHuman = available ? new Date(stats.fetchedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "UTC",
  }) : "Unavailable";

  return (
    <>
      {available && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />

      <Navbar variant="light" />

      <main className="bg-background py-32 text-foreground md:py-40">
        <article className="mx-auto max-w-3xl px-6 md:px-8">
          {/* ---- Header -------------------------------------------------- */}
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            AI Coding Usage Statistics
          </h1>
          <p className="mt-2 text-[0.9375rem] text-foreground/80">
            Anonymized Claude Code and Codex usage from the Straude community.
          </p>
          <p className="mt-2 text-sm text-muted">
            Snapshots are scheduled daily. Usage cost is estimated from model
            pricing; it is not a subscription charge or an invoice.
          </p>
          <p className="mt-2 text-sm text-muted" role="status">
            {freshness.state === "unavailable"
              ? "Statistics are temporarily unavailable. No successful capture is available."
              : freshness.state === "stale"
                ? "Snapshot is stale (over 48 hours old). Showing the last successful capture."
                : "Showing the latest successful snapshot."}
          </p>

          {/* ---- Big Number Grid ----------------------------------------- */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StatCard label="Estimated Usage Cost" value={available ? fmtUsd(stats.totalSpend) : "—"} />
            <StatCard
              label="Total Tokens"
              value={available ? formatTokens(stats.totalTokens) : "—"}
            />
            <StatCard
              label="Avg Latest Streak"
              value={available ? `${stats.avgStreak}` : "—"}
              context="days"
            />
          </div>

          {/* ---- Spending Distribution ----------------------------------- */}
          <div className="mt-16 space-y-10 text-[0.9375rem] leading-relaxed text-foreground/80">
            {available && <section>
              <h2 className="text-lg font-bold text-foreground">
                What Is the Average Estimated Weekly Usage Cost?
              </h2>
              <p className="mt-3">
                Based on anonymized Straude community snapshots, average estimated
                weekly usage cost is about{" "}
                <strong className="text-foreground">
                  {fmtUsdDecimal(stats.avgWeeklySpend)}
                </strong>{" "}
                per tracked profile over the observed date range (at least one week).
              </p>
              <p className="mt-3">
                Straude users have tracked a combined{" "}
                <strong className="text-foreground">
                  {fmtUsd(stats.totalSpend)}
                </strong>{" "}
                in estimated AI coding usage cost so far.
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
                          Estimated Cost
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
                            {segmentLabel(row.segment, percentiles)}
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
            </section>}

            {/* ---- Model Popularity -------------------------------------- */}
            {stats.models.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-foreground">
                  Models by Estimated Cost
                </h2>
                <p className="mt-3">
                  Ranked by share of estimated cost in reported model breakdowns.
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
                totals above — anonymized and aggregated in scheduled snapshots.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-subtle px-4 py-3 font-mono text-[0.8125rem] leading-relaxed">
                npx straude@latest
              </pre>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">How These Metrics Are Counted</h2>
              <p className="mt-3">
                Totals combine submitted daily usage across supported agents and
                include public and private profiles. Seed accounts are excluded
                from new snapshots. A latest streak is the consecutive run ending
                on each profile’s most recent usage date, even if that date is in
                the past. It does not count currently active people.
              </p>
              <p className="mt-3">
                {percentiles
                  ? "Spending groups are disjoint percentile buckets, rounded up to whole profiles."
                  : "This historical snapshot groups profiles by spending rank: first, 2–5, 6–10, and everyone else. Older captures may use different exclusions across metrics."}
              </p>
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
              {available && <time dateTime={stats.fetchedAt}>
                Last successful capture: {updatedHuman}
              </time>}
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
