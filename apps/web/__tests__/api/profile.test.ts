import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

vi.mock("@/lib/email/send-welcome-email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/referral", () => ({
  attributeReferral: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/constants/regions", () => ({
  COUNTRY_TO_REGION: {
    US: "north_america",
    GB: "europe",
    JP: "asia",
  },
}));

import { GET as getPublicProfile } from "@/app/api/users/[username]/route";
import { GET as getOwnProfile, PATCH } from "@/app/api/users/me/route";
import { captureServerActivationEvent } from "@/lib/analytics/server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";

function makeContext(username: string) {
  return { params: Promise.resolve({ username }) };
}

function makeRequest(method: string, url: string, body?: any) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users/[username]", () => {
  it("returns profile with stats", async () => {
    const profile = {
      id: "u-1",
      username: "alice",
      is_public: true,
      region: "north_america",
      streak_freezes: 2,
    };

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "viewer-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: profile,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "follows") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "daily_usage") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ total_cost: 15 }],
                error: null,
              }),
            }),
          };
        }
        if (table === "user_levels") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { level: 4 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "posts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          };
        }
        if (table === "leaderboard_weekly") {
          return {
            select: vi.fn().mockImplementation((sel: string, opts?: any) => {
              if (opts?.count) {
                return {
                  gt: vi.fn().mockResolvedValue({ count: 2 }),
                  eq: vi.fn().mockReturnValue({
                    gt: vi.fn().mockResolvedValue({ count: 0 }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { total_cost: 15 },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, data: [] }),
          }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: 7, error: null }),
    };
    (createClient as any).mockResolvedValue({
      auth: client.auth,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    (getServiceClient as any).mockReturnValue(client);

    const res = await getPublicProfile(
      makeRequest("GET", "/api/users/alice"),
      makeContext("alice")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe("alice");
    expect(json.streak).toBe(7);
    expect(json.total_cost).toBe(15);
    expect(json.level).toBe(4);
    expect(json.streak_freezes).toBeUndefined();
    expect(json.referred_by).toBeUndefined();
    expect(json.created_at).toBeUndefined();
  });

  it("returns 404 for non-existent username", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue({
      auth: client.auth,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    (getServiceClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      }),
    });

    const res = await getPublicProfile(
      makeRequest("GET", "/api/users/nobody"),
      makeContext("nobody")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("User not found");
  });
});

describe("GET /api/users/me", () => {
  it("returns the authenticated profile with crew count", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    };

    const db = {
      from: vi
        .fn()
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "u-1", username: "alice", github_username: "alicegh" },
                error: null,
              }),
            }),
          }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          }),
        })),
    };

    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    const res = await getOwnProfile();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe("alice");
    expect(json.crew_count).toBe(3);
  });
});

describe("PATCH /api/users/me", () => {
  function mockAuthenticatedProfileUpdate(resultData: Record<string, unknown> = { id: "u-1" }) {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: resultData,
            error: null,
          }),
        }),
      }),
    });

    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    };
    const db = {
      from: vi.fn().mockReturnValue({ update: updateMock }),
    };
    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    return { updateMock };
  }

  it("updates profile fields", async () => {
    const updatedProfile = {
      id: "u-1",
      username: "new_name",
      bio: "New bio",
      heard_about: "A friend mentioned it",
    };

    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    };
    const db = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedProfile,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", {
        username: "new_name",
        bio: "New bio",
        heard_about: "A friend mentioned it",
        email_dm_notifications: false,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe("new_name");
  });

  it("does not complete onboarding before first sync is present", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "u1@example.com" } },
          error: null,
        }),
      },
    };
    const updateMock = vi.fn();
    const dailyUsageChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };
    const db = {
      from: vi.fn((table: string) => {
        if (table === "daily_usage") return dailyUsageChain;
        if (table === "users") return { update: updateMock };
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { onboarding_completed: true })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Sync your first session before completing onboarding");
    expect(updateMock).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(captureServerActivationEvent).not.toHaveBeenCalled();
  });

  it("completes onboarding after first sync and captures activation", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1", email: "u1@example.com" } },
          error: null,
        }),
      },
    };
    const usageRow = {
      id: "usage-1",
      session_count: 2,
      total_tokens: 2500,
    };
    const updatedProfile = {
      id: "u-1",
      username: "alice",
      onboarding_completed: true,
    };
    const dailyUsageChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: usageRow,
        error: null,
      }),
    };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedProfile,
            error: null,
          }),
        }),
      }),
    });
    const leaderboardChain = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const db = {
      from: vi.fn((table: string) => {
        if (table === "daily_usage") return dailyUsageChain;
        if (table === "users") return { update: updateMock };
        if (table === "leaderboard_weekly") return leaderboardChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { onboarding_completed: true })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.onboarding_completed).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ onboarding_completed: true });
    expect(sendWelcomeEmail).toHaveBeenCalledWith({
      userId: "u-1",
      email: "u1@example.com",
      username: "alice",
    });
    expect(captureServerActivationEvent).toHaveBeenCalledWith({
      event: "activation_completed",
      distinctId: "u-1",
      properties: expect.objectContaining({
        surface: "onboarding",
        activation_state: "activated",
        is_authenticated: true,
        session_count: 2,
        total_tokens: 2500,
        "$insert_id": "activation_completed:usage-1",
      }),
    });
  });

  it("validates username format", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    // Too short
    let res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { username: "ab" })
    );
    let json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain("3-20 alphanumeric");

    // Invalid chars
    res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { username: "bad user!" })
    );
    json = await res.json();
    expect(res.status).toBe(400);

    // Too long
    res = await PATCH(
      makeRequest("PATCH", "/api/users/me", {
        username: "a".repeat(21),
      })
    );
    json = await res.json();
    expect(res.status).toBe(400);
  });

  it("validates bio length (max 160)", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { bio: "x".repeat(161) })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("160 characters");
  });

  it("validates how you heard about Straude length (max 500)", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { heard_about: "x".repeat(501) })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("500 characters");
  });

  it("accepts valid http and https profile links", async () => {
    const { updateMock } = mockAuthenticatedProfileUpdate();

    let res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { link: " https://example.com/me " })
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenLastCalledWith({ link: "https://example.com/me" });

    res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { link: "http://example.com/me" })
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenLastCalledWith({ link: "http://example.com/me" });
  });

  it("clears blank or null profile links", async () => {
    const { updateMock } = mockAuthenticatedProfileUpdate();

    let res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { link: "" })
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenLastCalledWith({ link: null });

    res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { link: null })
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenLastCalledWith({ link: null });
  });

  it("rejects unsafe or malformed profile links", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    for (const link of ["javascript:alert(1)", "data:text/html,<p>x</p>", "not a url"]) {
      const res = await PATCH(
        makeRequest("PATCH", "/api/users/me", { link })
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Profile link");
    }
  });

  it("auto-derives region from country", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "u-1", country: "US", region: "north_america" },
            error: null,
          }),
        }),
      }),
    });

    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    };
    const db = {
      from: vi.fn().mockReturnValue({ update: updateMock }),
    };
    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    await PATCH(
      makeRequest("PATCH", "/api/users/me", { country: "US" })
    );

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "US",
        region: "north_america",
      })
    );
  });

  it("rejects duplicate username (409)", async () => {
    const authClient: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
    };
    const db = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "23505", message: "unique violation" },
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(authClient);
    (getServiceClient as any).mockReturnValue(db);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { username: "taken_name" })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Username already taken");
  });

  it("rejects unauthenticated request", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { bio: "hi" })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("rejects empty update", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { nonexistent_field: "value" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("No fields to update");
  });
});
