import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn().mockResolvedValue(true),
  identifyServerActivationUser: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { POST } from "@/app/api/analytics/activation/route";
import { ACTIVATION_ANONYMOUS_COOKIE } from "@/lib/analytics/activation";
import { captureServerActivationEvent, identifyServerActivationUser } from "@/lib/analytics/server";
import { rateLimit } from "@/lib/rate-limit";
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

function request(
  body: unknown,
  options?: string | { cookie?: string; headers?: Record<string, string> },
) {
  const cookie = typeof options === "string" ? options : options?.cookie;
  const extraHeaders = typeof options === "string" ? {} : (options?.headers ?? {});

  return new Request("http://localhost/api/analytics/activation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analytics/activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue(null);
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
    expect(rateLimit).not.toHaveBeenCalled();
    expect(captureServerActivationEvent).not.toHaveBeenCalled();
  });

  it("returns 429 for rate-limited requests without capturing", async () => {
    mockAuthUser("user-1");
    vi.mocked(rateLimit).mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }) as any,
    );

    const res = await POST(request({
      event: "sync_command_copied",
      properties: { surface: "onboarding" },
    }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("Too many requests");
    expect(rateLimit).toHaveBeenCalledWith(
      "activation-analytics",
      "user-1",
      { limit: 20, windowSeconds: 60 },
    );
    expect(captureServerActivationEvent).not.toHaveBeenCalled();
  });

  it("rate limits authenticated requests by user id", async () => {
    mockAuthUser("user-1");

    const res = await POST(request({
      event: "sync_command_copied",
      properties: { surface: "onboarding" },
    }));

    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith(
      "activation-analytics",
      "user-1",
      { limit: 20, windowSeconds: 60 },
    );
    expect(captureServerActivationEvent).toHaveBeenCalled();
  });

  it("rate limits anonymous requests by the first forwarded IP", async () => {
    const res = await POST(request(
      {
        event: "signup_started",
        properties: { surface: "signup" },
      },
      { headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.4" } },
    ));

    expect(res.status).toBe(200);
    expect(rateLimit).toHaveBeenCalledWith(
      "activation-analytics",
      "203.0.113.7",
      { limit: 20, windowSeconds: 60 },
    );
    expect(captureServerActivationEvent).toHaveBeenCalled();
  });
});
