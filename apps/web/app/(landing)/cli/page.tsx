import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CLI Reference — Straude",
  description:
    "Complete reference for the Straude CLI — commands, flags, auto-push setup, and configuration.",
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[0.8125rem]">
      {children}
    </code>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg bg-subtle p-4 font-mono text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  );
}

function Flag({
  name,
  type,
  description,
  defaultValue,
}: {
  name: string;
  type?: string;
  description: string;
  defaultValue?: string;
}) {
  return (
    <li className="pb-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Code>{name}</Code>
        {type && <span className="text-xs text-muted">{type}</span>}
      </div>
      <p className="mt-0.5 text-foreground/70">
        {description}
        {defaultValue && (
          <span className="text-muted"> Default: {defaultValue}.</span>
        )}
      </p>
    </li>
  );
}

export default function CliReferencePage() {
  return (
    <>
      <Navbar variant="light" />
      <main className="bg-background py-32 text-foreground md:py-40">
        <article className="mx-auto max-w-2xl px-6 md:px-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            CLI Reference
          </h1>
          <p className="mt-2 text-[0.9375rem] text-foreground/80">
            Push your Claude Code and Codex usage stats to Straude.
          </p>
          <Pre>npx straude@latest</Pre>

          <div className="mt-12 space-y-10 text-[0.9375rem] leading-relaxed text-foreground/80">
            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">Quick Start</h2>
              <ol className="mt-3 list-decimal pl-6 space-y-2">
                <li>
                  Run <Code>npx straude@latest</Code> — this logs you in and
                  pushes today&apos;s stats in one step.
                </li>
                <li>
                  Your profile is live at{" "}
                  <Code>straude.com/u/your-username</Code>.
                </li>
                <li>
                  Enable daily auto-push:{" "}
                  <Code>straude --auto</Code>
                </li>
              </ol>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">Commands</h2>
              <div className="mt-3 space-y-6">
                <div>
                  <h3 className="font-bold text-foreground">
                    <Code>straude</Code> or{" "}
                    <Code>straude push</Code>
                  </h3>
                  <p className="mt-1">
                    Sync your usage data. If you&apos;re not logged in, opens a
                    browser to authenticate first. This is the default command —
                    running <Code>straude</Code> with no arguments does the same
                    thing.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-foreground">
                    <Code>straude login</Code>
                  </h3>
                  <p className="mt-1">
                    Authenticate with Straude via browser. Opens an OAuth flow
                    and polls for completion (times out after 5 minutes).
                    Credentials are saved to{" "}
                    <Code>~/.straude/config.json</Code>.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-foreground">
                    <Code>straude status</Code>
                  </h3>
                  <p className="mt-1">
                    Show your current streak, weekly spend, leaderboard rank,
                    and shareable profile URL.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-foreground">
                    <Code>straude auto</Code>
                  </h3>
                  <p className="mt-1">
                    Show auto-push status — whether it&apos;s enabled, the
                    scheduled time, and which scheduler is active.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-foreground">
                    <Code>straude auto logs</Code>
                  </h3>
                  <p className="mt-1">
                    Print the last 50 lines of the auto-push log. Useful for
                    checking if scheduled pushes are running.
                  </p>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">Push Options</h2>
              <ul className="mt-3 space-y-3">
                <Flag
                  name="--date YYYY-MM-DD"
                  type="string"
                  description="Push a specific date. Must be within the last 7 days and not in the future."
                />
                <Flag
                  name="--days N"
                  type="number"
                  description="Push the last N days. Capped at 7."
                />
                <Flag
                  name="--dry-run"
                  description="Preview what would be pushed without sending anything to the server."
                />
                <Flag
                  name="--timeout N"
                  type="seconds"
                  description="Subprocess timeout for data collection."
                  defaultValue="240"
                />
                <Flag
                  name="--auto"
                  description="Enable daily auto-push via OS scheduler (launchd on macOS, cron on Linux)."
                />
                <Flag
                  name="--auto hooks"
                  description="Enable auto-push via Claude Code SessionEnd hook. Pushes after every coding session instead of on a schedule."
                />
                <Flag
                  name="--time HH:MM"
                  type="string"
                  description="Set the auto-push time. Use with --auto (scheduler only)."
                  defaultValue="21:00"
                />
                <Flag
                  name="--no-auto"
                  description="Disable auto-push and remove the scheduler entry."
                />
                <Flag
                  name="--api-url URL"
                  type="string"
                  description="Override the API endpoint. For development use."
                  defaultValue="https://straude.com"
                />
              </ul>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">Auto-Push</h2>
              <p className="mt-2">
                Auto-push keeps your stats in sync without manual runs. There
                are two mechanisms:
              </p>

              <h3 className="mt-6 font-bold text-foreground">
                OS Scheduler (default)
              </h3>
              <p className="mt-1">
                Installs a system scheduler (launchd on macOS, cron on Linux)
                that runs <Code>straude push</Code> once per day at a set time.
                Survives reboots and terminal closures.
              </p>
              <Pre>{`# Enable at the default time (9 PM)
straude --auto

# Enable at a custom time
straude --auto --time 14:30`}</Pre>
              <p className="mt-3">
                A wrapper script at{" "}
                <Code>~/.straude/auto-push.sh</Code> captures your PATH at
                enable-time and falls back through <Code>straude</Code> &rarr;{" "}
                <Code>bunx</Code> &rarr; <Code>npx</Code> to find the CLI.
                Logs are written to{" "}
                <Code>~/.straude/auto-push.log</Code> and rotated at 1 MB.
                Windows is not supported.
              </p>

              <h3 className="mt-6 font-bold text-foreground">
                Claude Code Hook
              </h3>
              <p className="mt-1">
                Adds a <Code>SessionEnd</Code> hook to{" "}
                <Code>~/.claude/settings.json</Code> that runs{" "}
                <Code>straude push</Code> after every Claude Code session. No
                background process, no crontab — just a JSON entry.
              </p>
              <Pre>{`# Enable hooks-based auto-push
straude --auto hooks`}</Pre>
              <p className="mt-3 text-muted">
                Codex hook support is planned. The Codex CLI currently only
                offers a per-turn <Code>Stop</Code> hook, not a session-end
                event. We&apos;ll add Codex support once they ship their
                equivalent of <Code>SessionEnd</Code>.
              </p>

              <h3 className="mt-6 font-bold text-foreground">
                Managing auto-push
              </h3>
              <Pre>{`# Disable (works for both mechanisms)
straude --no-auto

# Check which mechanism is active
straude auto

# View scheduler logs (scheduler only)
straude auto logs`}</Pre>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">Smart Sync</h2>
              <p className="mt-2">
                When you run <Code>straude</Code> with no date flags, it figures
                out what to sync automatically:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>
                  <strong>First run:</strong> backfills the last 3 days.
                </li>
                <li>
                  <strong>Already pushed today:</strong> re-syncs today only
                  (picks up new sessions).
                </li>
                <li>
                  <strong>Gap &le; 7 days:</strong> syncs from your last push
                  date through today.
                </li>
                <li>
                  <strong>Gap &gt; 7 days:</strong> backfills the most recent 7
                  days (the max window).
                </li>
              </ul>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">
                Data Sources
              </h2>
              <p className="mt-2">
                The CLI collects data from two sources in parallel:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>
                  <strong>ccusage</strong> — Claude Code session data (cost,
                  tokens, models).
                </li>
                <li>
                  <strong>@ccusage/codex</strong> — Codex usage data (same
                  schema).
                </li>
              </ul>
              <p className="mt-2">
                Entries are merged by date. If one source is unavailable, the
                other is used alone. The server deduplicates — pushing the same
                date twice is safe.
              </p>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">
                Configuration
              </h2>
              <p className="mt-2">
                All state lives in <Code>~/.straude/</Code>:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>
                  <Code>config.json</Code> — auth token, username, device ID,
                  auto-push settings. Permissions are set to owner-only
                  (0600).
                </li>
                <li>
                  <Code>auto-push.sh</Code> — generated wrapper script for the
                  scheduler.
                </li>
                <li>
                  <Code>auto-push.log</Code> — output from scheduled runs.
                </li>
              </ul>
              <p className="mt-3">
                On macOS, the launchd plist is written to{" "}
                <Code>
                  ~/Library/LaunchAgents/com.straude.auto-push.plist
                </Code>
                . On Linux, a tagged entry is added to your crontab.
              </p>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">Examples</h2>
              <Pre>{`# First-time setup — login, push, and enable auto-push
npx straude@latest --auto

# Use Claude Code hooks instead of a scheduler
straude --auto hooks

# Push last 3 days
straude --days 3

# Preview without posting
straude --dry-run

# Push a specific date
straude --date 2026-03-20

# Check your stats
straude status

# Change auto-push time to 2 PM
straude --auto --time 14:00`}</Pre>
            </section>

            {/* ---------------------------------------------------------- */}
            <section>
              <h2 className="text-lg font-bold text-foreground">
                Global Flags
              </h2>
              <ul className="mt-3 space-y-3">
                <Flag
                  name="--help, -h"
                  description="Show the help text."
                />
                <Flag
                  name="--version, -v"
                  description="Print the CLI version."
                />
              </ul>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
