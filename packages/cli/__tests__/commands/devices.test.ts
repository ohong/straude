import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, loadConfigMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  loadConfigMock: vi.fn(),
}));

vi.mock("../../src/lib/api.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../src/lib/api.js")>(),
  apiRequest: apiRequestMock,
}));
vi.mock("../../src/lib/auth.js", () => ({ loadConfig: loadConfigMock }));

import { devicesCommand } from "../../src/commands/devices.js";

const config = { token: "tok", username: "alice", api_url: "https://straude.com" };
const candidateId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  loadConfigMock.mockReturnValue(config);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("devicesCommand", () => {
  it("lists proof candidates with explicit resolution commands", async () => {
    apiRequestMock.mockResolvedValue({
      candidates: [{
        id: candidateId,
        device_id_a: "22222222-2222-4222-8222-222222222222",
        device_id_b: "33333333-3333-4333-8333-333333333333",
        normalized_hostname: "work-laptop",
        overlap_dates: ["2026-07-21", "2026-07-22"],
        status: "pending",
        created_at: "2026-07-23T00:00:00.000Z",
      }],
    });

    expect(await devicesCommand(null, null)).toBe(0);
    expect(apiRequestMock).toHaveBeenCalledWith(
      config,
      "/api/usage/devices",
      expect.objectContaining({ timeoutMs: 15_000 }),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`devices merge ${candidateId}`));
  });

  it("submits an explicit keep-separate decision", async () => {
    apiRequestMock.mockResolvedValue({
      candidate: {
        id: candidateId,
        status: "resolved",
        decision: "keep_separate",
      },
    });

    expect(await devicesCommand("keep-separate", candidateId)).toBe(0);
    const request = apiRequestMock.mock.calls[0]![2];
    expect(JSON.parse(request.body)).toEqual({
      candidate_id: candidateId,
      decision: "keep_separate",
    });
  });

  it("returns AUTH_REQUIRED without making a request", async () => {
    loadConfigMock.mockReturnValue(null);
    expect(await devicesCommand(null, null)).toBe(2);
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
