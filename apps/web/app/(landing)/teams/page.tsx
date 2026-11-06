import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Private team usage reports — Straude",
  description: "Review Claude Code and Codex usage in a private workspace. Understand weekly changes, source coverage, and estimated value at API prices.",
  alternates: { canonical: "/teams" },
  openGraph: { title: "Private team usage reports — Straude", description: "A shared weekly review for work-only Claude Code and Codex usage.", url: "/teams" },
};

const linkStyle = "text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4";

export default function TeamsPage() {
  return <>
    <Navbar variant="light" />
    <main id="main-content" className="bg-background text-foreground">
      <div className="mx-auto max-w-6xl space-y-16 px-5 py-12 sm:px-8 sm:py-20">
        <header className="max-w-3xl">
          <p className="font-mono text-sm uppercase tracking-widest text-muted">Straude for teams</p>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Log the work.<br />Review the week together.</h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted">Give your team one private view of Claude Code and Codex usage. See what changed, understand missing data, and take the same figures into a CSV.</p>
          <div className="mt-8 flex flex-wrap gap-4"><Link href="/workspaces" className="rounded bg-accent px-5 py-3 font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Open private workspaces</Link><a href="#sample-report" className="rounded border border-border px-5 py-3 font-semibold hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">See a sample week</a></div>
          <p className="mt-4 text-sm text-muted">Personal use stays free. Public profiles are optional.</p>
        </header>

        <section id="sample-report" aria-labelledby="sample-heading" className="scroll-mt-8 border border-border">
          <div className="border-b border-border bg-subtle p-5 sm:p-8"><p className="font-mono text-xs uppercase tracking-widest text-muted">Fictional example · completed week</p><h2 id="sample-heading" className="mt-2 text-2xl font-semibold">Harbor Workshop — weekly review</h2><p className="mt-2 text-sm text-muted">October 19–25, 2026 · Monday–Sunday, UTC. All names and figures in this sample are invented.</p></div>
          <dl className="grid gap-6 p-5 sm:grid-cols-3 sm:p-8">
            <div><dt className="text-sm text-muted">People contributing data</dt><dd className="mt-2 font-mono text-3xl tabular-nums">8 <span className="text-sm text-muted">of 10 members</span></dd><p className="mt-2 text-sm text-muted">7 contributed in the previous week.</p></div>
            <div><dt className="text-sm text-muted">Estimated value at API prices</dt><dd className="mt-2 font-mono text-3xl tabular-nums">$240</dd><p className="mt-2 text-sm text-muted">+$60 from the previous week’s $180.</p></div>
            <div><dt className="text-sm text-muted">Same 7 contributors</dt><dd className="mt-2 font-mono text-3xl tabular-nums">+$20</dd><p className="mt-2 text-sm text-muted">The new contributor accounts for the other $40.</p></div>
          </dl>
          <div className="grid gap-6 border-t border-border p-5 sm:grid-cols-2 sm:p-8">
            <div><h3 className="font-semibold">What changed by tool</h3><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>Claude Code</dt><dd className="font-mono tabular-nums">$120 → $150 (+$30)</dd></div><div className="flex justify-between gap-3"><dt>Codex</dt><dd className="font-mono tabular-nums">$60 → $90 (+$30)</dd></div></dl><p className="mt-4 text-sm text-muted">Model contributions: Claude Sonnet +$30; GPT-5.3-Codex +$30.</p></div>
            <div><h3 className="font-semibold">How complete is the week?</h3><p className="mt-3 text-sm leading-relaxed text-muted">45 of 56 possible contributor-days received. One connected source has not synced for more than 48 hours. Two members have no data received. Missing days are unknown; a received day with zero tokens is recorded zero usage.</p></div>
          </div>
          <p className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted sm:px-8">Dollar figures are estimated value at API prices. Actual billed charges are unknown without a billing source. Tokens and spending are usage measures, not employee productivity scores.</p>
        </section>

        <section aria-labelledby="setup-heading" className="grid gap-8 md:grid-cols-[1fr_2fr]"><div><p className="font-mono text-xs uppercase tracking-widest text-muted">Get on the same page</p><h2 id="setup-heading" className="mt-3 text-3xl font-semibold">Three steps to a shared week.</h2></div><ol className="space-y-6"><li><h3 className="text-lg font-semibold">1. Review your own week</h3><p className="mt-2 leading-relaxed text-muted">Start with your personal recap, then create a private workspace. Existing personal usage does not move into it.</p></li><li><h3 className="text-lg font-semibold">2. Invite colleagues deliberately</h3><p className="mt-2 leading-relaxed text-muted">Create invitation links for specific email addresses. Each person reviews what will be shared and connects a work-only device or operating-system account. Collection starts the next UTC day.</p></li><li><h3 className="text-lg font-semibold">3. Confirm sync, then review together</h3><p className="mt-2 leading-relaxed text-muted">Use the Straude CLI to sync Claude Code and Codex. Check who has joined, whose first sync arrived, and when data was last received. Review weekly totals, changes in participation, tools, models, and gaps; export the same report as CSV.</p></li></ol></section>

        <section aria-labelledby="privacy-heading" className="border-y border-border py-8"><h2 id="privacy-heading" className="text-2xl font-semibold">A private workspace with clear boundaries.</h2><div className="mt-5 grid gap-6 text-sm leading-relaxed text-muted sm:grid-cols-2"><p>Members see combined usage reports, the roster, and source sync status. The owner manages invitations and access. Prompts and code are not uploaded. Workspace contributions stay off public feeds, profiles, recaps, and leaderboards.</p><p>Daily aggregates cannot distinguish work and personal accounts on a mixed device. Connect only a work-only device or OS account. Earlier dates are excluded even on retries. Removing someone stops access and future sharing; their prior contributions remain in the totals.</p></div></section>

        <section aria-labelledby="proposal-heading" className="grid gap-8 md:grid-cols-[1fr_2fr]"><div><h2 id="proposal-heading" className="text-3xl font-semibold">Bring a clear proposal.</h2><p className="mt-3 text-muted">Copy this note to start a conversation with your team.</p></div><div className="rounded border border-border bg-subtle p-6"><h3 className="font-semibold">Proposal: a private weekly usage review</h3><p className="mt-4 text-sm leading-relaxed">Let’s try a private Straude workspace for our team’s Claude Code and Codex usage. Each engineer chooses a work-only source. We’ll review the weekly tool and model mix, compare changes without confusing new contributors with changed behavior, and check gaps before exporting the figures.</p><p className="mt-3 text-sm leading-relaxed">We will use the report to understand usage, not rank employee productivity. It contains no prompts or code, and estimated API value is separate from actual bills. After a few weekly reviews, we can decide whether it saves enough reporting work to continue.</p><p className="mt-4 text-sm"><Link href="/contact" className={linkStyle}>Discuss team setup with Straude</Link> · <Link href="/cli" className={linkStyle}>Read the CLI guide</Link></p></div></section>
      </div>
    </main>
    <div className="bg-landing-bg"><Footer /></div>
  </>;
}
