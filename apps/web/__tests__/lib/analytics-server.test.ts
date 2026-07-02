import { afterEach, describe, expect, it, vi } from "vitest";
import { captureServerActivationEvent } from "@/lib/analytics/server";

describe("server PostHog activation capture", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts sanitized activation events to PostHog capture", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await captureServerActivationEvent({
      event: "activation_completed",
      distinctId: "user-1",
      properties: {
        surface: "onboarding",
        activation_state: "activated",
        is_authenticated: true,
        total_tokens: 5000,
        prompt: "do not send",
      } as any,
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us.i.posthog.com/capture/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "activation_completed",
      distinct_id: "user-1",
      properties: {
        surface: "onboarding",
        activation_state: "activated",
        is_authenticated: true,
        total_tokens: 5000,
      },
    });
    expect(body.properties.prompt).toBeUndefined();
  });

  it("skips capture when no PostHog project key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(captureServerActivationEvent({
      event: "signup_completed",
      distinctId: "user-1",
    })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
