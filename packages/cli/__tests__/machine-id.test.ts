import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readFileSync: readFileSyncMock,
  };
});

vi.mock("../src/config.js", () => ({
  CONFIG_DIR: "/tmp/straude-machine-id-test",
}));

import {
  _resetMachineIdForTests,
  getInstallationId,
  getMachineId,
} from "../src/lib/machine-id.js";

describe("machine identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetMachineIdForTests();
  });

  it("never lets the analytics fallback replace the durable installation id", () => {
    readFileSyncMock.mockImplementationOnce(() => {
      throw new Error("temporarily unreadable");
    });
    const analyticsId = getMachineId();
    const durableId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    readFileSyncMock.mockReturnValue(`${durableId}\n`);

    expect(getInstallationId()).toBe(durableId);
    expect(analyticsId).not.toBe(durableId);
  });

  it("keeps a process-local analytics fallback stable without caching it as installation state", () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("unreadable");
    });

    const first = getMachineId();
    expect(getMachineId()).toBe(first);
    expect(() => getInstallationId()).toThrow(/installation identity/i);
  });
});
