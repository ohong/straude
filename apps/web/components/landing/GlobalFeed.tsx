import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatTokens } from "@/lib/utils/format";

/** ISO date string for N days ago */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function getInitials(name: string | null): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Current ISO week number */
function isoWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86_400_000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

export async function GlobalFeed() {
  let feedItems: Array<{
    id: string;
    initials: string;
    title: string;
    model: string;
    tokens: string;
    time: string;
  }> = [];

  let leaderboard: Array<{
    rank: string;
    handle: string;
    score: string;
  }> = [];

  try {
    const supabase = await createClient();

    const [{ data: posts }, { data: leaders }] = await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, title, created_at, user:users!posts_user_id_fkey!inner(display_name, username, is_public), daily_usage:daily_usage!posts_daily_usage_id_fkey(models, total_tokens, cost_usd)"
        )
        .eq("user.is_public", true)
        .gte("created_at", daysAgo(7))
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("leaderboard_weekly")
        .select("username, total_output_tokens")
        .order("total_cost", { ascending: false })
        .limit(5),
    ]);

    if (posts) {
      // Top 3 by spend, then display newest-first
      const top3 = [...posts]
        .sort(
          (a: any, b: any) =>
            (b.daily_usage?.cost_usd ?? 0) - (a.daily_usage?.cost_usd ?? 0)
        )
        .slice(0, 3)
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      feedItems = top3.map((p: any) => ({
        id: p.id,
        initials: getInitials(p.user?.display_name ?? p.user?.username),
        title: p.title || "Untitled session",
        model: p.daily_usage?.models?.[0] ?? "Unknown",
        tokens: formatTokens(p.daily_usage?.total_tokens ?? 0),
        time: timeAgo(p.created_at),
      }));
    }

    if (leaders) {
      leaderboard = leaders.map((l: any, i: number) => ({
        rank: String(i + 1).padStart(2, "0"),
        handle: `@${l.username}`,
        score: formatTokens(l.total_output_tokens ?? 0),
      }));
    }
  } catch {
    // Supabase unavailable at build time — render empty
  }

  const weekNum = isoWeek();

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 border-t border-[#222]">
      {/* Feed column */}
      <div className="lg:col-span-8 border-b lg:border-r border-[#222]">
        <div className="px-8 py-6 border-b border-[#222] flex justify-between items-center bg-[#050505]">
          <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-[#F0F0F0]">
            GLOBAL_FEED.LOG
          </h3>
          <span className="font-[family-name:var(--font-mono)] text-sm uppercase text-accent">
            LIVE
          </span>
        </div>

        {feedItems.map((item) => (
          <Link
            key={item.id}
            href={`/post/${item.id}`}
            className="px-8 py-6 border-b border-[#222] grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-8 hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-10 h-10 bg-[#222] flex items-center justify-center font-[family-name:var(--font-mono)] text-sm text-[#F0F0F0]">
              {item.initials}
            </div>
            <div>
              <div className="font-medium text-[#F0F0F0] mb-1">
                {item.title}
              </div>
              <div className="flex gap-6 font-[family-name:var(--font-mono)] text-xs text-[#888]">
                <span>
                  Model: <span className="text-[#F0F0F0]">{item.model}</span>
                </span>
                <span>
                  Tokens: <span className="text-[#F0F0F0]">{item.tokens}</span>
                </span>
              </div>
            </div>
            <div className="font-[family-name:var(--font-mono)] text-sm text-[#888] text-right">
              {item.time}
            </div>
          </Link>
        ))}

        <Link
          href="/feed"
          className="block px-8 py-6 text-center border-t border-[#222] font-[family-name:var(--font-mono)] text-sm text-[#888] hover:text-[#F0F0F0] transition-colors"
        >
          &gt; LOAD_MORE
        </Link>
      </div>

      {/* Leaderboard column */}
      <div className="lg:col-span-4 border-b border-[#222] bg-[#050505] flex flex-col">
        <div className="px-8 py-6 border-b border-[#222]">
          <h3 className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-[#F0F0F0]">
            TOP_CODERS // WK_{weekNum}
          </h3>
        </div>

        <div className="flex-1">
          {leaderboard.map((row) => (
            <Link
              key={row.rank}
              href="/leaderboard"
              className="flex justify-between px-8 py-4 border-b border-[#222] font-[family-name:var(--font-mono)] text-sm hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex gap-4">
                <span className="text-[#888] w-6">{row.rank}</span>
                <span className="text-[#F0F0F0]">{row.handle}</span>
              </div>
              <span className="text-accent">{row.score}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
