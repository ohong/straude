import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDebug, setDebug, debugLog } from "../src/lib/debug.js";

describe("debug mode", () => {
  const originalEnv = process.env.STRAUDE_DEBUG;

  beforeEach(() => {
    setDebug(false);
    delete process.env.STRAUDE_DEBUG;
  });

  afterEach(() => {
    setDebug(false);
    if (originalEnv === undefined) {
      delete process.env.STRAUDE_DEBUG;
    } else {
      process.env.STRAUDE_DEBUG = originalEnv;
    }
  });

  it("is off by default", () => {
    expect(isDebug()).toBe(false);
  });

  it("is on when --debug was passed (setDebug)", () => {
    setDebug(true);
    expect(isDebug()).toBe(true);
  });

  it.each([["1"], ["true"], ["yes"], ["TRUE"]])(
    "is on when STRAUDE_DEBUG=%s",
    (value) => {
      process.env.STRAUDE_DEBUG = value;
      expect(isDebug()).toBe(true);
    },
  );

  it.each([["0"], ["false"], ["no"], [""], ["off"]])(
    "is off when STRAUDE_DEBUG=%s",
    (value) => {
      process.env.STRAUDE_DEBUG = value;
      expect(isDebug()).toBe(false);
    },
  );

  it("debugLog writes to stderr only when enabled", () => {
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    debugLog("invisible");
    expect(writeSpy).not.toHaveBeenCalled();

    setDebug(true);
    debugLog("hello", { foo: 1 });
    expect(writeSpy).toHaveBeenCalledWith('[debug] hello {"foo":1}\n');

    writeSpy.mockRestore();
  });
});
