import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Check if a binary exists on PATH without spawning a subprocess. */
export function isBinaryOnPath(binary: string): boolean {
  const dirs = (process.env.PATH || "").split(delimiter).filter(Boolean);
  const suffixes = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  return dirs.some((dir) =>
    suffixes.some((ext) => existsSync(join(dir, binary + ext))),
  );
}
