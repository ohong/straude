"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { formatTokens } from "@/lib/utils/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { LeaderboardEntry } from "@/types";

const PERIODS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all_time", label: "All Time" },
];

const REGIONS = [
  { value: "", label: "Global" },
  { value: "north_america", label: "N. America" },
  { value: "south_america", label: "S. America" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "africa", label: "Africa" },
  { value: "oceania", label: "Oceania" },
];

function rankVariant(rank: number): "rank-1" | "rank-2" | "rank-3" | "rank-top10" | "default" {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  if (rank <= 10) return "rank-top10";
  return "default";
}

export function LeaderboardTable({
  entries,
  currentUserId,
  currentPeriod,
  currentRegion,
  userCountry,
}: {
  entries: LeaderboardEntry[];
  currentUserId: string;
  currentPeriod: string;
  currentRegion: string | null;
  userCountry: string | null;
}) {
  const router = useRouter();

  function navigate(period: string, region: string) {
    const params = new URLSearchParams();
    params.set("period", period);
    if (region) params.set("region", region);
    router.push(`/leaderboard?${params.toString()}`);
  }

  return (
    <div>
      {/* Period tabs */}
      <div className="flex border-b border-border">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => navigate(value, currentRegion ?? "")}
            className={cn(
              "border-b-2 border-transparent px-5 py-3 text-sm font-semibold text-muted",
              currentPeriod === value && "border-b-accent text-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Region filter */}
      {userCountry && (
        <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {REGIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => navigate(currentPeriod, value)}
              className={cn(
                "shrink-0 rounded-[4px] px-3 py-1 text-xs font-semibold",
                (currentRegion ?? "") === value
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-widest text-muted">
              <th className="px-6 py-3 font-semibold">Rank</th>
              <th className="px-6 py-3 font-semibold">User</th>
              <th className="px-6 py-3 text-right font-semibold">Cost</th>
              <th className="px-6 py-3 text-right font-semibold">Output</th>
              <th className="px-6 py-3 text-right font-semibold">Streak</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.user_id}
                className={cn(
                  "border-b border-border hover:bg-subtle",
                  entry.user_id === currentUserId &&
                    "border-l-4 border-l-accent bg-highlight-row",
                )}
              >
                <td className="px-6 py-3">
                  <Badge variant={rankVariant(entry.rank)}>{entry.rank}</Badge>
                </td>
                <td className="px-6 py-3">
                  <Link
                    href={`/u/${entry.username}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <Avatar
                      src={entry.avatar_url}
                      alt={entry.username}
                      fallback={entry.username}
                      size="sm"
                    />
                    <span className="font-medium">{entry.username}</span>
                    {entry.country && (
                      <span className="text-xs text-muted">{entry.country}</span>
                    )}
                  </Link>
                </td>
                <td className="px-6 py-3 text-right font-mono font-medium tabular-nums text-accent">
                  ${entry.total_cost.toFixed(2)}
                </td>
                <td className="px-6 py-3 text-right font-mono tabular-nums">
                  {formatTokens(entry.total_output_tokens)}
                </td>
                <td className="px-6 py-3 text-right font-mono tabular-nums">
                  {entry.streak > 0 ? `${entry.streak}d` : "-"}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden">
        {entries.map((entry) => (
          <Link
            key={entry.user_id}
            href={`/u/${entry.username}`}
            className={cn(
              "flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-subtle",
              entry.user_id === currentUserId &&
                "border-l-4 border-l-accent bg-highlight-row",
            )}
          >
            <Badge variant={rankVariant(entry.rank)}>{entry.rank}</Badge>
            <Avatar
              src={entry.avatar_url}
              alt={entry.username}
              fallback={entry.username}
              size="sm"
            />
            <div className="flex-1 overflow-hidden">
              <p className="truncate font-medium">{entry.username}</p>
              {entry.country && (
                <p className="text-xs text-muted">{entry.country}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-medium tabular-nums text-accent">
                ${entry.total_cost.toFixed(2)}
              </p>
              <p className="font-mono text-xs tabular-nums text-muted">
                {formatTokens(entry.total_output_tokens)}
              </p>
            </div>
          </Link>
        ))}
        {entries.length === 0 && (
          <p className="px-6 py-12 text-center text-muted">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
