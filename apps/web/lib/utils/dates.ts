/**
 * Local-time date helpers shared across web-only callers.
 *
 * - `formatDateMonDay` matches the admin chart axis/tooltip format: "Mon DD"
 *   (e.g. "Apr 12"). When given a `YYYY-MM-DD` string it parses as local
 *   midnight (`+ "T00:00:00"`) so the displayed day matches the date key.
 * - `formatDateKey` returns a `YYYY-MM-DD` string in the **local** timezone.
 *   This is the same format used by the contribution graph, recap, heatmap,
 *   and the share-asset card data builders.
 */

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // Strings like "2025-04-12" are intentionally parsed as local midnight to
  // avoid the off-by-one that `new Date("2025-04-12")` (UTC) would cause when
  // rendered in a negative offset timezone.
  return new Date(input + "T00:00:00");
}

export function formatDateMonDay(input: string | Date): string {
  const d = toDate(input);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateKey(input: string | Date): string {
  const d = input instanceof Date ? input : toDate(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
