// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { resolveTeamFavicon } from "@/lib/team-favicon";
import { PATCH } from "@/app/api/users/me/route";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/team-favicon", async (original) => ({ ...await original<typeof import("@/lib/team-favicon")>(), resolveTeamFavicon: vi.fn() }));
let profile: { id: string; team_url: string | null; team_favicon_url: string | null };
let reads: string[];
let saved: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  profile = { id: "test-user", team_url: "https://example.com", team_favicon_url: "https://storage.example.com/example.com.svg" };
  reads = [];
  saved = {};
  const client = createSupabaseClient("https://storage.example.com", "test-secret", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const req = new Request(input, init);
      if (req.method === "GET") { reads.push(req.url); return Response.json([profile]); }
      saved = await req.json();
      return Response.json({ ...profile, ...saved });
    } },
  });
  vi.spyOn(client.auth, "getUser").mockResolvedValue({ data: { user: { id: "test-user", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01" } }, error: null });
  vi.mocked(createClient).mockResolvedValue(client);
  vi.mocked(getServiceClient).mockReturnValue(client);
  vi.mocked(resolveTeamFavicon).mockResolvedValue({ ok: true, teamUrl: "https://new.example.com", teamFaviconUrl: null });
});

const patch = (body: Record<string, unknown>) => PATCH(new NextRequest("https://straude.com/api/users/me", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

describe("team settings save", () => {
  it("skips resolution when an unrelated edit retains the normalized team and resolved icon", async () => {
    const result = await patch({ display_name: "Updated name", team_url: "https://EXAMPLE.com/path", team_favicon_url: "https://attacker.example/icon" });
    expect(result.status).toBe(200);
    expect(resolveTeamFavicon).not.toHaveBeenCalled();
    expect(reads).toHaveLength(1);
    expect(new URL(reads[0]!).searchParams.get("select")).toBe("team_url,team_favicon_url");
    expect(saved).toEqual({ display_name: "Updated name", team_url: "https://example.com", team_favicon_url: profile.team_favicon_url });
  });

  it("does not add a profile read when no team URL is supplied", async () => {
    expect((await patch({ display_name: "Updated name" })).status).toBe(200);
    expect(reads).toEqual([]);
    expect(resolveTeamFavicon).not.toHaveBeenCalled();
  });

  it("resolves a changed team and saves it even when no icon is found", async () => {
    expect((await patch({ team_url: "https://new.example.com" })).status).toBe(200);
    expect(resolveTeamFavicon).toHaveBeenCalledWith("https://new.example.com");
    expect(saved).toEqual({ team_url: "https://new.example.com", team_favicon_url: null });
  });

  it("retries an unchanged team with no resolved icon", async () => {
    profile.team_favicon_url = null;
    expect((await patch({ team_url: "https://example.com" })).status).toBe(200);
    expect(resolveTeamFavicon).toHaveBeenCalledWith("https://example.com");
  });

  it("clears both fields without discovery and rejects invalid URLs", async () => {
    expect((await patch({ team_url: null })).status).toBe(200);
    expect(saved).toEqual({ team_url: null, team_favicon_url: null });
    expect((await patch({ team_url: "javascript:alert(1)" })).status).toBe(400);
    expect(resolveTeamFavicon).not.toHaveBeenCalled();
  });
});
