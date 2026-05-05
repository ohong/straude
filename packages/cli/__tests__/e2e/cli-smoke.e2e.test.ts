import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnCli, rmDir, CLI_DIST_ENTRY } from "./spawn";

/**
 * Real-binary e2e smoke tests. The previous CLI tests all import functions
 * from src/ and exercise them in-process. These tests do something none of
 * those can: they spawn the *built* `dist/index.js` as a separate Node
 * process with a controlled HOME, capture stdout/stderr/exit, and assert
 * on the observable behavior a user actually sees.
 *
 * What this catches that in-process tests cannot:
 *  - Build pipeline regressions (tsc emits broken JS, missing imports).
 *  - argv parsing breakage that doesn't surface when calling main() directly.
 *  - Real exit codes for help/version/error paths.
 *  - Real stdout output the user reads.
 *  - Future regressions to the CLI's startup-time behavior under real Node.
 *
 * Out of scope for this exemplar suite (tracked as follow-ups):
 *  - Full `straude push` flow — needs ccusage on PATH or a stub binary.
 *  - `straude login` — needs an HTTP listener mocking the auth poll.
 *  - Auto-push / hooks — needs Claude Code's settings.json scaffold.
 */

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

beforeAll(() => {
  // The CLI binary is what we're testing, so make sure it exists. If the
  // suite is run cold (no `bun run build` first), build it now. tsc takes
  // ~3s; the alternative is a confusing "ENOENT dist/index.js" failure.
  if (!existsSync(CLI_DIST_ENTRY)) {
    const built = spawnSync("bun", ["run", "build"], { cwd: PKG_DIR, stdio: "inherit" });
    if (built.status !== 0) {
      throw new Error(`failed to build CLI before e2e suite (exit ${built.status})`);
    }
  }
});

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "straude-e2e-"));
});
afterEach(() => {
  rmDir(home);
});

describe("straude binary — smoke", () => {
  it("--help prints usage and exits 0", async () => {
    const r = await spawnCli({ args: ["--help"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toMatch(/Usage:/);
    expect(r.stdout).toMatch(/straude\s*<command>/);
  });

  it("-h is an alias for --help", async () => {
    const r = await spawnCli({ args: ["-h"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Usage:/);
  });

  it("--version prints the package version and exits 0", async () => {
    // Read the pinned version straight from package.json — no source-of-truth
    // drift between this assertion and what the build embeds.
    const pkg = await import(join(PKG_DIR, "package.json"), { with: { type: "json" } });
    const version = (pkg as unknown as { default: { version: string } }).default.version;

    const r = await spawnCli({ args: ["--version"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe(`straude v${version}`);
  });

  it("-v is an alias for --version", async () => {
    const r = await spawnCli({ args: ["-v"], home });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^straude v/);
  });

  it("unknown command prints the help and exits non-zero", async () => {
    const r = await spawnCli({ args: ["nonsense"], home });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/Unknown command/);
  });

  it("--version is a side-effect-free read (no ~/.straude written)", async () => {
    // Sanity that the version path doesn't accidentally trigger config
    // creation or machine_id generation. Independent of any first-run
    // telemetry that may land in other PRs.
    const r = await spawnCli({ args: ["--version"], home });
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".straude"))).toBe(false);
  });
});
