import { ACHIEVEMENTS } from "@/lib/achievements";
import type { UserAchievement } from "@/types";

export function AchievementBadges({
  earned,
  showLocked = false,
}: {
  earned: UserAchievement[];
  showLocked?: boolean;
}) {
  const earnedSlugs = new Set(earned.map((a) => a.achievement_slug));
  const badges = showLocked
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => earnedSlugs.has(a.slug));

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((a) => {
        const isEarned = earnedSlugs.has(a.slug);
        return (
          <span
            key={a.slug}
            title={`${a.title} — ${a.description}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              isEarned
                ? "border-border bg-subtle"
                : "border-border/50 bg-background text-muted opacity-40"
            }`}
          >
            <span>{a.emoji}</span>
            {a.title}
          </span>
        );
      })}
    </div>
  );
}
