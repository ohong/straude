import { describe, it, expect } from "vitest";
import { pickInstallCommand } from "../src/lib/ccusage.js";

describe("pickInstallCommand", () => {
  it("uses bun when bun is available", () => {
    expect(pickInstallCommand({ hasBun: true })).toEqual({
      cmd: "bun",
      args: ["add", "-g", "ccusage"],
      manager: "bun",
    });
  });

  it("falls back to npm when bun is missing", () => {
    expect(pickInstallCommand({ hasBun: false })).toEqual({
      cmd: "npm",
      args: ["install", "-g", "ccusage"],
      manager: "npm",
    });
  });

  it("hardcodes the package name (no string interpolation)", () => {
    // Regression guard: a refactor that lets a caller pass the package name
    // would let an attacker who controls config inject `--config-set` etc.
    // The signature only accepts boolean env state, so this stays sealed.
    const npm = pickInstallCommand({ hasBun: false });
    expect(npm.args).toContain("ccusage");
    expect(npm.args).not.toContain("");
  });
});
