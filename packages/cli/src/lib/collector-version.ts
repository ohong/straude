const STABLE_SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/;

function parse(version: string | undefined): [number, number, number] | undefined {
  const match = version ? STABLE_SEMVER.exec(version) : null;
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/**
 * True when `current` is a stable semver strictly newer than `stored`. A missing
 * or unparseable stored version counts as older, matching the server's rule for
 * which stored rows a newer collector may replace.
 */
export function isNewerCollectorVersion(
  current: string | undefined,
  stored: string | undefined,
): boolean {
  const next = parse(current);
  if (!next) return false;
  const previous = parse(stored);
  if (!previous) return true;
  for (let i = 0; i < 3; i += 1) {
    if (next[i]! !== previous[i]!) return next[i]! > previous[i]!;
  }
  return false;
}
