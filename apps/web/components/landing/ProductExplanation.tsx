import Link from "next/link";

export function ProductExplanation() {
  return (
    <section
      aria-labelledby="product-explanation-heading"
      className="grid grid-cols-1 border-t border-landing-border lg:grid-cols-12"
    >
      <div className="flex flex-col justify-end border-b border-landing-border bg-landing-bg p-8 lg:col-span-4 lg:border-r lg:p-16">
        <h2
          id="product-explanation-heading"
          className="text-balance text-xl font-medium leading-tight text-landing-text"
        >
          Your training log,
          <br />
          not your work.
        </h2>
        <p className="mt-3 font-mono text-sm uppercase text-landing-muted">
          How Straude works
        </p>
      </div>

      <div className="grid border-b border-landing-border lg:col-span-8 lg:grid-cols-3">
        <article className="border-b border-landing-border p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="font-mono text-sm text-accent">01 / Aggregate locally</p>
          <h3 className="mt-5 text-balance text-lg font-medium text-landing-text">
            Start with totals you can inspect.
          </h3>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            The open-source CLI uses ccusage to read supported coding-agent logs
            on your machine, including Claude Code, Codex, Gemini CLI, and Qwen.
            It groups activity into daily totals. Before a
            sync, you can run a dry run to collect usage without submitting it.
            Straude is designed to measure the shape of your practice without
            needing the substance of the work that produced it.
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            That makes setup intentionally small: one command after a session,
            no project instrumentation, no repository access, and no browser
            extension watching how you work.
          </p>
        </article>

        <article className="border-b border-landing-border p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="font-mono text-sm text-accent">02 / Log the session</p>
          <h3 className="mt-5 text-balance text-lg font-medium text-landing-text">
            Keep the metrics that help you train.
          </h3>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            A Straude day can include token volume, estimated cost, model names,
            and session count. Those aggregates become a consistent record you
            can review across days instead of a pile of disconnected provider
            logs. Streaks make consistency visible, while profiles and activity
            posts give you a durable record of showing up.
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            Cost figures are estimates for reflection and comparison. Provider
            invoices remain the authority for billing, and community statistics
            represent participating Straude users rather than every developer.
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            Over time, the log helps answer practical questions: whether your
            usage is rising, which models shape your workload, how often you
            return to the tools, and which weeks produced your strongest pace.
            The point is a clearer feedback loop, not a single score that decides
            whether a session was worthwhile.
          </p>
        </article>

        <article className="p-8 lg:p-10">
          <p className="font-mono text-sm text-accent">03 / Protect the boundary</p>
          <h3 className="mt-5 text-balance text-lg font-medium text-landing-text">
            Leave prompts and code where they belong.
          </h3>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            Prompts, conversations, source code, project names, and file contents
            are outside Straude&apos;s collection boundary. They remain on your
            machine. Straude does not analyze code quality, reconstruct what you
            asked an agent, or monitor employees. It receives the aggregate usage
            totals you choose to send.
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-landing-muted">
            Read the{" "}
            <Link
              href="/privacy"
              className="text-accent underline underline-offset-2 hover:no-underline"
            >
              privacy policy
            </Link>{" "}
            for the full data boundary, or explore the{" "}
            <Link
              href="/cli"
              className="text-accent underline underline-offset-2 hover:no-underline"
            >
              CLI reference
            </Link>{" "}
            before your first sync.
          </p>
        </article>
      </div>
    </section>
  );
}
