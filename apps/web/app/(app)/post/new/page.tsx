import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";
import { CopyCommand } from "./CopyCommand";

export const metadata: Metadata = { title: "Upload Activity" };

export default async function NewPostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch recent unedited posts (no title, no description, no images)
  const { data: posts } = await supabase
    .from("posts")
    .select(
      `
      id,
      created_at,
      daily_usage:daily_usage!posts_daily_usage_id_fkey(date, cost_usd, models)
    `
    )
    .eq("user_id", user!.id)
    .is("title", null)
    .is("description", null)
    .or("images.is.null,images.eq.[]")
    .order("created_at", { ascending: false })
    .limit(10);

  const unedited = posts ?? [];

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Upload Activity</h3>
      </header>

      <div className="mx-auto max-w-xl space-y-10 px-6 py-8">
        {/* Section 1: Recent unedited posts */}
        {unedited.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Your recent posts
            </h4>
            <ul className="mt-3 divide-y divide-border rounded border border-border">
              {unedited.map((post: any) => {
                const usage = post.daily_usage;
                return (
                  <li key={post.id}>
                    <Link
                      href={`/post/${post.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-subtle"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          {usage?.date ?? "Unknown date"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {usage?.cost_usd != null
                            ? `$${Number(usage.cost_usd).toFixed(2)}`
                            : ""}
                          {usage?.models?.length
                            ? ` \u00b7 ${usage.models.join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-accent">
                        Edit
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {unedited.length === 0 && (
          <section>
            <p className="text-sm text-muted">
              No unedited posts &mdash; you&rsquo;re all caught up.
            </p>
          </section>
        )}

        {/* Section 2: Sync new data */}
        <section>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Sync new data
          </h4>
          <p className="mt-2 text-sm text-muted">
            One command to sync your latest stats. CLI posts are verified and
            count towards the leaderboard.
          </p>
          <div className="mt-3">
            <CopyCommand command="npx straude@latest" />
          </div>
        </section>

        {/* Section 3: Manual import */}
        <section>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Or import manually
          </h4>
          <p className="mt-2 text-sm text-muted">
            Paste ccusage JSON output. Manual imports are unverified.
          </p>
          <Link
            href="/settings/import"
            className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
          >
            Go to import page
          </Link>
        </section>
      </div>
    </>
  );
}
