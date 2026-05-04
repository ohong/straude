import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  statSync,
  chmodSync,
  mkdirSync,
} from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import {
  isFirstRun,
  markFirstRun,
  FIRST_RUN_MARKER_FILENAME,
} from "../src/lib/first-run.js";

/**
 * Real-fs unit tests. The previous version of this file mocked node:fs
 * entirely, which only verified the *shape* of our calls (e.g. that we
 * asked existsSync about the marker path). It would not have caught: a
 * wrong filename, missing-parent-dir behavior, file-mode bits, or a real
 * permission-denied path. These tests use a real temp directory so all of
 * that is exercised end-to-end.
 */

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "straude-first-run-"));
});

afterEach(() => {
  // Restore writability before cleanup in case a test made the dir read-only.
  try {
    chmodSync(tmp, 0o700);
  } catch {
    // best effort
  }
  rmSync(tmp, { recursive: true, force: true });
});

describe("isFirstRun (real fs)", () => {
  it("returns true when the marker file does not exist", () => {
    expect(isFirstRun(tmp)).toBe(true);
  });

  it("returns true when the config dir itself does not exist", () => {
    const ghostDir = join(tmp, "does-not-exist");
    expect(isFirstRun(ghostDir)).toBe(true);
  });

  it("returns false once the marker exists", () => {
    markFirstRun(tmp);
    expect(isFirstRun(tmp)).toBe(false);
  });
});

describe("markFirstRun (real fs)", () => {
  it("creates the config dir and writes the marker file", () => {
    const child = join(tmp, "nested", ".straude");
    markFirstRun(child);
    expect(existsSync(child)).toBe(true);
    expect(existsSync(join(child, FIRST_RUN_MARKER_FILENAME))).toBe(true);
  });

  it("writes the marker contents as a parseable ISO timestamp", () => {
    markFirstRun(tmp);
    const contents = readFileSync(join(tmp, FIRST_RUN_MARKER_FILENAME), "utf-8");
    expect(() => new Date(contents.trim())).not.toThrow();
    expect(new Date(contents.trim()).toString()).not.toBe("Invalid Date");
  });

  it("writes the marker with mode 0o600 (owner read/write only)", () => {
    if (platform() === "win32") return; // POSIX-only
    markFirstRun(tmp);
    const mode = statSync(join(tmp, FIRST_RUN_MARKER_FILENAME)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("creates the config dir with mode 0o700", () => {
    if (platform() === "win32") return;
    const child = join(tmp, "fresh");
    markFirstRun(child);
    const mode = statSync(child).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  it("is idempotent on re-invocation (does not throw, marker still present)", () => {
    markFirstRun(tmp);
    const firstMtime = statSync(join(tmp, FIRST_RUN_MARKER_FILENAME)).mtimeMs;
    expect(() => markFirstRun(tmp)).not.toThrow();
    const secondMtime = statSync(join(tmp, FIRST_RUN_MARKER_FILENAME)).mtimeMs;
    expect(secondMtime).toBeGreaterThanOrEqual(firstMtime);
  });

  it("swallows errors when the config dir is unwritable", () => {
    if (platform() === "win32") return;
    if (process.getuid?.() === 0) return; // root bypasses mode bits
    const child = join(tmp, "ro");
    mkdirSync(child, { recursive: true, mode: 0o700 });
    chmodSync(child, 0o500); // r-x: cannot write
    expect(() => markFirstRun(child)).not.toThrow();
    expect(existsSync(join(child, FIRST_RUN_MARKER_FILENAME))).toBe(false);
  });
});

describe("isFirstRun + markFirstRun (real fs round-trip)", () => {
  it("first call sees first-run, mark, second call does not", () => {
    expect(isFirstRun(tmp)).toBe(true);
    markFirstRun(tmp);
    expect(isFirstRun(tmp)).toBe(false);
  });
});
