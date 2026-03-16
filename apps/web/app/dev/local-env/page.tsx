import Link from "next/link";

const commands = [
  "bun run local:up",
  "bun run local:env",
  "bun run local:seed",
  "bun run dev:local",
];

export default function LocalEnvSetupPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-border bg-subtle/30 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Local Dev Setup
        </p>
        <h1
          className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl"
          style={{ letterSpacing: "-0.04em" }}
        >
          Supabase env is missing for this app
        </h1>
        <p className="mt-3 text-sm text-muted sm:text-base">
          Straude can run entirely against a local Supabase stack. You do not
          need production credentials for day-to-day development.
        </p>

        <div className="mt-6 rounded-[20px] border border-border bg-background p-4">
          <p className="text-sm font-semibold">Recommended flow</p>
          <ol className="mt-3 space-y-3 text-sm text-muted">
            {commands.map((command, index) => (
              <li key={command} className="flex gap-3">
                <span className="font-mono text-foreground">{index + 1}.</span>
                <code className="rounded-md bg-subtle px-2 py-1 text-foreground">
                  {command}
                </code>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 rounded-[20px] border border-border bg-background p-4">
          <p className="text-sm font-semibold">What these commands do</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <code>bun run local:up</code> starts the local Supabase stack via
              Docker.
            </li>
            <li>
              <code>bun run local:env</code> writes
              <code> apps/web/.env.local</code> using the local URL and keys.
            </li>
            <li>
              <code>bun run local:seed</code> creates demo users, demo usage,
              and demo posts.
            </li>
            <li>
              <code>bun run dev:local</code> runs the app against the local
              stack without requiring Portless.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Back to app
          </Link>
          <a
            href="https://supabase.com/docs/guides/local-development"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-subtle"
          >
            Supabase local docs
          </a>
          <a
            href="https://github.com/ohong/straude/blob/main/docs/LOCAL_DEV.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-subtle"
          >
            Repo local-dev doc
          </a>
        </div>
      </div>
    </main>
  );
}
