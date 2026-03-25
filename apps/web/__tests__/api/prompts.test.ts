import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: vi.fn(),
}));

import { GET as getPrompts, POST as postPrompt } from "@/app/api/prompts/route";
import { GET as getAdminPrompts } from "@/app/api/admin/prompts/route";
import { PATCH as patchAdminPrompt } from "@/app/api/admin/prompts/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

function makeRequest(method: string, url: string, body?: Record<string, unknown>) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/prompts", () => {
  it("rejects unauthenticated users", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const res = await postPrompt(
      makeRequest("POST", "/api/prompts", { prompt: "Please add CSV export to admin charts." }),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("creates a prompt when under the 24h limit", async () => {
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 3, error: null }),
    };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "prompt-1", status: "new", created_at: "2026-03-01T10:00:00.000Z" },
        error: null,
      }),
    };

    let call = 0;
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn().mockImplementation(() => {
        call += 1;
        return call === 1 ? countChain : insertChain;
      }),
    };
    (createClient as any).mockResolvedValue(supabase);

    const res = await postPrompt(
      makeRequest("POST", "/api/prompts", {
        prompt: "Add keyboard shortcuts in the post editor for save and image upload.",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("prompt-1");
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        status: "new",
        is_anonymous: false,
      }),
    );
  });

  it("stores anonymous submissions when requested", async () => {
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
    };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "prompt-2",
          status: "new",
          is_anonymous: true,
          created_at: "2026-03-01T10:00:00.000Z",
        },
        error: null,
      }),
    };
    let call = 0;
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn().mockImplementation(() => {
        call += 1;
        return call === 1 ? countChain : insertChain;
      }),
    });

    const res = await postPrompt(
      makeRequest("POST", "/api/prompts", {
        prompt: "Add one-click copy for CLI commands in onboarding.",
        anonymous: true,
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.is_anonymous).toBe(true);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_anonymous: true }),
    );
  });

  it("enforces 10 submissions per 24h", async () => {
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 10, error: null }),
    };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn().mockReturnValue(countChain),
    };
    (createClient as any).mockResolvedValue(supabase);

    const res = await postPrompt(
      makeRequest("POST", "/api/prompts", {
        prompt: "Please add an option to pin prompts.",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toContain("Daily limit reached");
  });
});

describe("GET /api/prompts", () => {
  it("returns public prompt feed for authenticated users", async () => {
    const listChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: "prompt-1",
            prompt: "Ship a profile completion checklist.",
            is_anonymous: true,
            created_at: "2026-03-01T08:00:00.000Z",
            user: { username: "alice" },
          },
        ],
        error: null,
      }),
    };
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn().mockReturnValue(listChain),
    });

    const res = await getPrompts(makeRequest("GET", "/api/prompts?limit=20&offset=0"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.prompts).toHaveLength(1);
    expect(json.prompts[0].user.username).toBe("alice");
    expect(json.prompts[0].is_anonymous).toBe(true);
  });
});

describe("GET /api/admin/prompts", () => {
  it("rejects non-admin users", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    (isAdmin as any).mockReturnValue(false);

    const res = await getAdminPrompts(makeRequest("GET", "/api/admin/prompts"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns prompt rows with status counters for admins", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
    });
    (isAdmin as any).mockReturnValue(true);

    let call = 0;
    const db = {
      from: vi.fn().mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [{ id: "prompt-1", status: "new", is_hidden: false }],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { status: "new", is_hidden: false },
              { status: "accepted", is_hidden: false },
              { status: "shipped", is_hidden: true },
            ],
            error: null,
          }),
        };
      }),
    };
    (getServiceClient as any).mockReturnValue(db);

    const res = await getAdminPrompts(makeRequest("GET", "/api/admin/prompts"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.prompts).toHaveLength(1);
    expect(json.counts.new).toBe(1);
    expect(json.counts.accepted).toBe(1);
    expect(json.counts.hidden).toBe(1);
  });
});

describe("PATCH /api/admin/prompts/[id]", () => {
  it("updates prompt status and hidden flag", async () => {
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
    });
    (isAdmin as any).mockReturnValue(true);

    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({
      data: { id: "prompt-1", status: "accepted", is_hidden: true },
      error: null,
    });

    (getServiceClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update,
        eq,
        select,
        single,
      }),
    });

    const res = await patchAdminPrompt(
      makeRequest("PATCH", "/api/admin/prompts/prompt-1", {
        status: "accepted",
        is_hidden: true,
      }),
      { params: Promise.resolve({ id: "prompt-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.prompt.status).toBe("accepted");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        is_hidden: true,
      }),
    );
  });
});
