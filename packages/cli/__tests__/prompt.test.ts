import { afterEach, describe, expect, it } from "vitest";
import {
  isInteractive,
  setInteractiveOverride,
} from "../src/lib/prompt.js";

afterEach(() => {
  setInteractiveOverride(null);
});

describe("interactive override", () => {
  it("forces noninteractive behavior for the current process", () => {
    setInteractiveOverride(false);
    expect(isInteractive()).toBe(false);
  });

  it("can force interactive behavior for callers with an explicit UI", () => {
    setInteractiveOverride(true);
    expect(isInteractive()).toBe(true);
  });

  it("returns to terminal detection when cleared", () => {
    setInteractiveOverride(false);
    setInteractiveOverride(null);
    expect(isInteractive()).toBe(
      Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY),
    );
  });
});
