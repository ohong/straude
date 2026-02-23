"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { UserAchievement } from "@/types";

export function AchievementBadges({
  earned,
  showLocked = false,
}: {
  earned: UserAchievement[];
  showLocked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const earnedSlugs = new Set(earned.map((a) => a.achievement_slug));
  const badges = showLocked
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => earnedSlugs.has(a.slug));

  if (badges.length === 0) return null;

  const earnedBadges = badges.filter((a) => earnedSlugs.has(a.slug));

  return (
    <div>
      {/* Collapsed: compact emoji row with toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-sm hover:bg-subtle transition-colors"
      >
        <span className="flex gap-1">
          {earnedBadges.map((a) => (
            <span key={a.slug} title={a.title}>
              {a.emoji}
            </span>
          ))}
          {earnedBadges.length === 0 && (
            <span className="text-muted text-xs">No badges yet</span>
          )}
        </span>
        <span className="text-muted text-xs">
          {earnedBadges.length}/{ACHIEVEMENTS.length}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-muted" />
        ) : (
          <ChevronDown size={14} className="text-muted" />
        )}
      </button>

      {/* Expanded: detail grid */}
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((a) => {
            const isEarned = earnedSlugs.has(a.slug);
            return (
              <div
                key={a.slug}
                className={`flex items-start gap-2 rounded border px-3 py-2 ${
                  isEarned
                    ? "border-border bg-subtle"
                    : "border-border/50 bg-background text-muted opacity-40"
                }`}
              >
                <span className="text-lg leading-none mt-0.5">{a.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{a.title}</p>
                  <p className="text-[0.65rem] leading-tight text-muted">
                    {a.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
