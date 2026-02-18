"use client";

import { useInView } from "@/lib/hooks/useInView";

/* ── Fake Feed Card ── */
function FeedCard({
  name,
  handle,
  cost,
  tokens,
  models,
  time,
  kudos,
}: {
  name: string;
  handle: string;
  cost: string;
  tokens: string;
  models: string;
  time: string;
  kudos: number;
}) {
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
      {/* User row */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0EBE4] text-xs font-bold text-[#0A0A0A]">
          {name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-bold">{name}</span>
          <span className="ml-1.5 text-xs text-[#999]">{handle}</span>
        </div>
        <span className="text-xs text-[#999]">{time}</span>
      </div>
      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#FAFAFA] p-3">
          <span className="block font-[family-name:var(--font-mono)] text-lg font-bold tracking-tight">
            {cost}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#999]">
            Cost
          </span>
        </div>
        <div className="rounded-lg bg-[#FAFAFA] p-3">
          <span className="block font-[family-name:var(--font-mono)] text-lg font-bold tracking-tight">
            {tokens}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#999]">
            Tokens
          </span>
        </div>
        <div className="rounded-lg bg-[#FAFAFA] p-3">
          <span className="block font-[family-name:var(--font-mono)] text-lg font-bold tracking-tight">
            {models}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#999]">
            Models
          </span>
        </div>
      </div>
      {/* Footer */}
      <div className="mt-3 flex items-center gap-4 text-xs text-[#999]">
        <span className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {kudos}
        </span>
        <span>2 comments</span>
      </div>
    </div>
  );
}

/* ── Fake Leaderboard ── */
function LeaderboardMockup() {
  const rows = [
    { rank: 1, name: "sarah_codes", cost: "$12.47", tokens: "312K", flag: "US" },
    { rank: 2, name: "mxtnr", cost: "$9.82", tokens: "245K", flag: "DE" },
    { rank: 3, name: "0xkai", cost: "$8.15", tokens: "203K", flag: "JP" },
    { rank: 4, name: "luna.dev", cost: "$7.63", tokens: "190K", flag: "BR" },
    { rank: 5, name: "codeotter", cost: "$6.91", tokens: "172K", flag: "UK" },
  ];

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Global Leaderboard</span>
          <div className="flex gap-1">
            <span className="rounded-md bg-[#0A0A0A] px-2.5 py-1 text-[10px] font-bold text-white">
              Daily
            </span>
            <span className="rounded-md px-2.5 py-1 text-[10px] font-medium text-[#999]">
              Weekly
            </span>
            <span className="rounded-md px-2.5 py-1 text-[10px] font-medium text-[#999]">
              Monthly
            </span>
          </div>
        </div>
      </div>
      {/* Rows */}
      <div>
        {rows.map((r) => (
          <div
            key={r.rank}
            className={`flex items-center gap-3 border-b border-[#F0F0F0] px-5 py-3 last:border-0 ${
              r.rank <= 3 ? "bg-[rgba(223,86,31,0.03)]" : ""
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${
                r.rank === 1
                  ? "bg-accent text-white"
                  : r.rank <= 3
                    ? "bg-accent/10 text-accent"
                    : "text-[#999]"
              }`}
            >
              {r.rank}
            </span>
            <span className="text-sm">{r.flag}</span>
            <span className="flex-1 text-sm font-medium">{r.name}</span>
            <span className="font-[family-name:var(--font-mono)] text-sm font-bold">
              {r.cost}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[#999]">
              {r.tokens}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Fake Profile / Contribution Graph ── */
// Deterministic contribution data to avoid SSR/client hydration mismatch
const CONTRIBUTION_CELLS: number[][] = [
  [3, 0, 2, 1, 4, 2, 0],
  [1, 3, 0, 2, 1, 0, 3],
  [2, 0, 4, 3, 1, 2, 1],
  [0, 2, 1, 4, 0, 3, 2],
  [3, 1, 0, 2, 4, 1, 0],
  [1, 4, 2, 0, 3, 0, 2],
  [0, 2, 3, 1, 0, 4, 1],
];

function ProfileMockup() {
  const cells = CONTRIBUTION_CELLS;

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
      {/* Profile header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
          O
        </div>
        <div>
          <span className="block text-sm font-bold">Oscar Hong</span>
          <span className="text-xs text-[#999]">@oscar</span>
        </div>
        <div className="ml-auto flex gap-4 text-center">
          <div>
            <span className="block font-[family-name:var(--font-mono)] text-lg font-bold">23</span>
            <span className="text-[10px] text-[#999]">day streak</span>
          </div>
          <div>
            <span className="block font-[family-name:var(--font-mono)] text-lg font-bold">$142</span>
            <span className="text-[10px] text-[#999]">this month</span>
          </div>
        </div>
      </div>

      {/* Contribution graph */}
      <div className="flex gap-1 justify-center">
        {cells.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((level, di) => (
              <div
                key={di}
                className="h-3 w-3 rounded-[2px]"
                style={{
                  backgroundColor:
                    level === 0
                      ? "#F0F0F0"
                      : level === 1
                        ? "rgba(223,86,31,0.2)"
                        : level === 2
                          ? "rgba(223,86,31,0.4)"
                          : level === 3
                            ? "rgba(223,86,31,0.7)"
                            : "#DF561F",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductShowcase() {
  const { ref, inView } = useInView(0.1);

  return (
    <section className="bg-[#F7F5F0] py-24 md:py-32 overflow-hidden">
      <div ref={ref} className="mx-auto max-w-[1400px] px-6 md:px-8">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] leading-tight max-w-2xl">
            Your sessions, visualized
          </h2>
          <p className="mt-4 text-lg text-muted max-w-lg">
            Every log generates a post with your daily output —
            cost, tokens, models, and your position on the board.
          </p>
        </div>

        {/* Dashboard showcase — layered like superpower.com */}
        <div className="relative">
          {/* Main center: Feed */}
          <div
            className={`relative z-20 mx-auto max-w-md transition-all duration-1000 ${
              inView
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-12 scale-95"
            }`}
          >
            {/* Browser chrome */}
            <div className="rounded-t-xl border border-b-0 border-[#D5D5D5] bg-[#F5F5F5] px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex-1 mx-8 rounded-md bg-white border border-[#E0E0E0] px-3 py-1 text-[10px] text-[#999] text-center">
                straude.com/feed
              </div>
            </div>
            <div className="rounded-b-xl border border-[#D5D5D5] bg-[#FAFAFA] p-4 space-y-4 shadow-2xl shadow-black/10">
              <FeedCard
                name="Sarah"
                handle="@sarah_codes"
                cost="$12.47"
                tokens="312K"
                models="3"
                time="2h ago"
                kudos={14}
              />
              <FeedCard
                name="Max"
                handle="@mxtnr"
                cost="$9.82"
                tokens="245K"
                models="2"
                time="5h ago"
                kudos={8}
              />
            </div>
          </div>

          {/* Left: Leaderboard */}
          <div
            className={`hidden lg:block absolute -left-4 top-12 w-[380px] z-10 transition-all duration-1000 delay-200 ${
              inView
                ? "opacity-100 translate-x-0 -rotate-2"
                : "opacity-0 -translate-x-12 -rotate-6"
            }`}
          >
            <div className="shadow-xl shadow-black/5 rounded-xl">
              <LeaderboardMockup />
            </div>
          </div>

          {/* Right: Profile */}
          <div
            className={`hidden lg:block absolute -right-4 top-8 w-[340px] z-10 transition-all duration-1000 delay-300 ${
              inView
                ? "opacity-100 translate-x-0 rotate-2"
                : "opacity-0 translate-x-12 rotate-6"
            }`}
          >
            <div className="shadow-xl shadow-black/5 rounded-xl">
              <ProfileMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
