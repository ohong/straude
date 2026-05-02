import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Wipe `dir` (if it exists) and recreate `dir/final/` ready for fresh writes.
 *
 * Used by the OG candidate generator scripts so each invocation starts from a
 * clean slate. Returns the path to the created `final/` directory so callers
 * don't have to recompute it.
 */
export async function ensureCleanOutputDir(dir: string): Promise<string> {
  await rm(dir, { recursive: true, force: true });
  const finalDir = join(dir, "final");
  await mkdir(finalDir, { recursive: true });
  return finalDir;
}
