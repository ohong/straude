import { formatPercent } from "@/lib/utils/format";

export interface UsageShareSegment {
  label: string;
  value: number;
  color: string;
}

export function UsageShareBar({
  label,
  segments,
  format,
}: {
  label: string;
  segments: readonly UsageShareSegment[];
  format: (value: number) => string;
}) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      <div aria-hidden className="flex h-2 gap-0.5">
        {visible.map((segment) => (
          <div
            key={segment.label}
            className="h-full min-w-1 rounded-xs first:rounded-l-full last:rounded-r-full"
            style={{
              flex: `${segment.value} 1 0`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      <ul aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {visible.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-xs"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-muted">{segment.label}</span>{" "}
            <span className="text-foreground tabular-nums">
              {format(segment.value)}
            </span>
            <span className="sr-only">, {formatPercent(segment.value / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
