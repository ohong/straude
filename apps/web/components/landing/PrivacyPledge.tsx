import Link from "next/link";

const ITEMS = [
  {
    label: "Token counts",
    detail: "Input, output, and cache tokens per day.",
  },
  {
    label: "Cost",
    detail: "Daily spend in USD, straight from your local logs.",
  },
  {
    label: "Model names",
    detail: "Which models you used — Opus, Sonnet, GPT, etc.",
  },
  {
    label: "Session count",
    detail: "How many sessions you ran that day. That's it.",
  },
];

export function PrivacyPledge() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 border-t border-landing-border">
      {/* Section title block */}
      <div className="lg:col-span-4 border-b border-r-0 lg:border-r border-landing-border p-8 lg:p-16 flex flex-col justify-end bg-landing-bg">
        <h2 className="text-landing-text text-xl font-medium tracking-[-0.03em] leading-tight text-balance mb-2">
          Privacy-first
          <br />
          design.
        </h2>
        <p className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-landing-muted">
          WHAT YOU SHARE
        </p>
      </div>

      {/* Content */}
      <div className="lg:col-span-8 border-b border-landing-border flex flex-col">
        {ITEMS.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-6 border-b border-landing-border px-8 py-6"
          >
            <span className="font-[family-name:var(--font-mono)] text-sm text-accent shrink-0 w-8">
              [&bull;]
            </span>
            <div>
              <p className="font-medium text-landing-text">{item.label}</p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-landing-muted mt-0.5">
                {item.detail}
              </p>
            </div>
          </div>
        ))}

        <div className="px-8 py-6 space-y-3 flex-1">
          <p className="text-sm text-landing-muted leading-relaxed">
            That&apos;s the complete list. Your prompts, code,
            conversations, and file contents never leave your machine. The
            CLI runs{" "}
            <a
              href="https://deepwiki.com/ryoppippi/ccusage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2 hover:no-underline"
            >
              ccusage
            </a>{" "}
            locally to aggregate daily totals from Claude Code&apos;s log
            files — only those totals are sent.
          </p>
          <div className="pt-1">
            <Link
              href="/privacy"
              className="font-[family-name:var(--font-mono)] text-sm text-landing-muted hover:text-landing-text transition-colors"
            >
              &gt; READ_FULL_POLICY
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
