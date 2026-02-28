export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Color scale for contribution graph cells */
export function getCellColor(cost: number): string {
  if (cost <= 0) return "#E5E5E5";
  if (cost <= 10) return "#FDD0B1";
  if (cost <= 50) return "#F4945E";
  if (cost <= 100) return "#DF561F";
  return "#B8441A";
}
