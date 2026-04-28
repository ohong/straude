/**
 * Debug mode for the CLI.
 *
 * Enabled by `--debug` (set via `setDebug(true)` in the args parser) or by
 * exporting `STRAUDE_DEBUG=1` (or `=true`/`=yes`). When enabled, the CLI
 * surfaces extra context about what's happening internally: per-row
 * normalization anomalies, payload sizes, etc. When disabled, those details
 * stay quiet so normal users aren't bothered by warnings that don't affect
 * their data.
 */

let flagFromArgs = false;

export function setDebug(value: boolean): void {
  flagFromArgs = value;
}

export function isDebug(): boolean {
  if (flagFromArgs) return true;
  const env = process.env.STRAUDE_DEBUG?.trim().toLowerCase();
  return env === "1" || env === "true" || env === "yes";
}

/**
 * Print a debug-only line to stderr, prefixed with `[debug]`. Stderr keeps
 * the CLI's stdout output clean for piping while still surfacing detail when
 * the user asks for it.
 */
export function debugLog(...parts: unknown[]): void {
  if (!isDebug()) return;
  const text = parts
    .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
    .join(" ");
  process.stderr.write(`[debug] ${text}\n`);
}
