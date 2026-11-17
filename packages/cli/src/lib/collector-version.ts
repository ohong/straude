import { compareStableSemver, parseStableSemver } from "@straude/shared/usage-protocol";

/** A missing or unparseable stored version counts as older. */
export function isNewerCollectorVersion(
  current: string | undefined,
  stored: string | undefined,
): boolean {
  const next = current ? parseStableSemver(current) : undefined;
  if (!next) return false;
  const previous = stored ? parseStableSemver(stored) : undefined;
  return !previous || compareStableSemver(next, previous) > 0;
}
