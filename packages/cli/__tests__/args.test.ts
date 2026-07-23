import { describe, expect, it } from "vitest";
import {
  assertSupportedNodeRuntime,
  CliArgumentError,
  parseCliArgs,
} from "../src/lib/args.js";

describe("strict CLI arguments", () => {
  it("parses bounded push values", () => {
    expect(parseCliArgs([
      "push",
      "--days",
      "7",
      "--timeout",
      "240",
      "--non-interactive",
    ])).toEqual({
      command: "push",
      subcommand: null,
      operand: null,
      options: {
        days: 7,
        timeoutMs: 240_000,
        nonInteractive: true,
      },
    });
  });

  it.each([
    [["--wat"], /Unknown option/],
    [["--days"], /requires a value/],
    [["--days", "3x"], /positive integer/],
    [["--days", "31"], /between 1 and 30/],
    [["--date", "2026-02-29"], /real calendar date/],
    [["--date", "2026-07-22", "--days", "2"], /cannot be used together/],
    [["status", "--dry-run"], /Push options/],
    [["auto", "wat"], /Unsupported auto subcommand/],
    [["push", "extra"], /Unexpected argument/],
  ])("rejects invalid input %j", (args, expected) => {
    expect(() => parseCliArgs(args as string[])).toThrow(expected as RegExp);
  });

  it("parses hook scheduling without treating hooks as a command", () => {
    expect(parseCliArgs(["--auto", "hooks"]).options.autoMechanism).toBe("hooks");
  });

  it("parses device reconciliation commands", () => {
    expect(parseCliArgs([
      "devices",
      "merge",
      "11111111-1111-4111-8111-111111111111",
    ])).toMatchObject({
      command: "devices",
      subcommand: "merge",
      operand: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects Node 18 with a clear startup error", () => {
    expect(() => assertSupportedNodeRuntime("18.20.8")).toThrow(CliArgumentError);
    expect(() => assertSupportedNodeRuntime("18.20.8")).toThrow(/Node\.js 20 or newer/);
    expect(() => assertSupportedNodeRuntime("20.0.0")).not.toThrow();
  });
});
