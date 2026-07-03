import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn().mockResolvedValue(true),
  identifyServerActivationUser: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/analytics/activation/route";
import { ACTIVATION_ANONYMOUS_COOKIE } from "@/lib/analytics/activation";
import { captureServerActivationEvent, identifyServerActivationUser } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

function mockAuthUser(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  } as any);
}

function request(body: unknown, cookie?: string) {
  return new Request("http://localhost/api/analytics/activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analytics/activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser(null);
  });

  it("captures anonymous lifecycle events with a short-lived activation id cookie", async () => {
    const res = await POST(request({
      event: "signup_started",
      properties: {
        surface: "signup",
        signup_method: "magic_link",
        email: "private@example.com",
      },
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${ACTIVATION_ANONYMOUS_COOKIE}=`);
    expect(captureServerActivationEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: "signup_started",
      distinctId: expect.any(String),
      properties: expect.objectContaining({
        surface: "signup",
        signup_method: "magic_link",
        is_authenticated: false,
        activation_state: "anonymous",
      }),
    }));
    expect(captureServerActivationEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({ email: expect.anything() }),
    }));
  });

  it("identifies authenticated users against the anonymous activation id", async () => {
    mockAuthUser("user-1");

    const res = await POST(request(
      {
        event: "sync_command_copied",
        properties: {
          surface: "onboarding",
          command: "npx straude@latest",
        },
      },
      `${ACTIVATION_ANONYMOUS_COOKIE}=anon-1`,
    ));

    expect(res.status).toBe(200);
    expect(identifyServerActivationUser).toHaveBeenCalledWith({
      distinctId: "user-1",
      anonymousDistinctId: "anon-1",
      properties: {
        is_authenticated: true,
        activation_state: "sync_command_copied",
      },
    });
    expect(captureServerActivationEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: "sync_command_copied",
      distinctId: "user-1",
      properties: expect.objectContaining({
        is_authenticated: true,
        activation_state: "sync_command_copied",
      }),
    }));
  });

  it("rejects events that are not in the client lifecycle allowlist", async () => {
    const res = await POST(request({ event: "usage_submit_succeeded" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid activation event");
    expect(captureServerActivationEvent).not.toHaveBeenCalled();
  });
});
