import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { resolveTeamFavicon } from "@/lib/team-favicon";
import { PATCH } from "@/app/api/users/me/route";
import type { FaviconResponse } from "@/lib/favicons/public-fetch";

const remote = vi.hoisted(() => ({ fetch: vi.fn<(url: URL) => Promise<FaviconResponse | null>>() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/utils/after", () => ({ after: vi.fn() }));
vi.mock("@/lib/favicons/public-fetch", async (original) => ({
  ...await original<typeof import("@/lib/favicons/public-fetch")>(),
  createPublicFetch: () => remote.fetch,
}));

const id = crypto.randomUUID();
const domains = [0, 1, 2, 3, 4, 5].map((index) => `favicon-${id}-${index}.example`);
const paths = domains.flatMap((domain) => [`${domain}.svg`, `${domain}.png`]);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="red" onclick="alert(1)"/></svg>');
let db: ReturnType<typeof getServiceClient>;

beforeAll(async () => {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Favicon integration tests require local Supabase");
  db = getServiceClient();
  const email = `favicon-${id}@example.test`;
  const password = crypto.randomUUID();
  const { error } = await db.auth.admin.createUser({ id, email, password, email_confirm: true });
  expect(error).toBeNull();
  const profile = await db.from("users").upsert({ id, username: `fav_${id.slice(0, 8)}`, timezone: "UTC", is_public: true, onboarding_completed: true });
  expect(profile.error).toBeNull();
  const member = createSupabaseClient(url.href, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await member.auth.signInWithPassword({ email, password })).error).toBeNull();
  vi.mocked(createClient).mockResolvedValue(member);
  expect((await member.from("team_favicon_cache").select("*")).error).not.toBeNull();
});

beforeEach(() => {
  remote.fetch.mockReset();
  remote.fetch.mockImplementation(async (url) => url.pathname === "/favicon.svg" ? { url, bytes: svg, contentType: "image/svg+xml" } : null);
});

afterAll(async () => {
  await db.storage.from("team-favicons").remove(paths);
  await db.from("team_favicon_cache").delete().in("domain", domains);
  await db.auth.admin.deleteUser(id);
});

const patch = (body: Record<string, unknown>) => PATCH(new NextRequest("http://localhost/api/users/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("team favicon save with real database and Storage", () => {
  it("discovers, sanitizes, uploads and serves SVG through the authenticated save route", async () => {
    const result = await patch({ team_url: `https://${domains[0]}/about` });
    expect(result.status).toBe(200);
    const profile = await result.json();
    expect(profile.team_url).toBe(`https://${domains[0]}`);
    expect(profile.team_favicon_url).toContain(`${domains[0]}.svg`);
    const stored = await fetch(profile.team_favicon_url);
    expect(stored.status).toBe(200);
    expect(stored.headers.get("content-type")).toContain("image/svg+xml");
    const bytes = await stored.text();
    expect(bytes).toContain('viewBox="0 0 200 100"');
    expect(bytes).not.toContain("onclick");
    const { data, error } = await db.from("team_favicon_cache").select("*").eq("domain", domains[0]).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ object_path: `${domains[0]}.svg` });

    remote.fetch.mockClear();
    await db.from("team_favicon_cache").delete().eq("domain", domains[0]);
    expect((await patch({ team_url: `https://${domains[0]}`, display_name: "Unrelated edit" })).status).toBe(200);
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it("normalizes rectangular PNGs and preserves a legacy cache entry", async () => {
    const png = await sharp({ create: { width: 512, height: 256, channels: 4, background: "blue" } }).png().toBuffer();
    remote.fetch.mockImplementation(async (url) => url.pathname === "/favicon.png" ? { url, bytes: png, contentType: "image/png" } : null);
    const result = await patch({ team_url: `https://${domains[1]}` });
    expect(result.status).toBe(200);
    const profile = await result.json();
    const stored = await fetch(profile.team_favicon_url);
    expect(await sharp(Buffer.from(await stored.arrayBuffer())).metadata()).toMatchObject({ width: 128, height: 64, hasAlpha: true, isPalette: false });

    await db.storage.from("team-favicons").upload(`${domains[2]}.png`, png, { contentType: "image/png" });
    remote.fetch.mockClear();
    const legacy = await patch({ team_url: `https://${domains[2]}` });
    expect((await legacy.json()).team_favicon_url).toContain(`${domains[2]}.png`);
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it("stores Google's fallback as PNG and reuses it without external requests", async () => {
    const png = await sharp({ create: { width: 256, height: 128, channels: 4, background: "blue" } }).png().toBuffer();
    remote.fetch.mockImplementation(async (url) => url.hostname === "www.google.com"
      ? { url, bytes: png, contentType: "image/png" } : null);

    const result = await patch({ team_url: `https://${domains[5]}` });

    expect(result.status).toBe(200);
    const profile = await result.json();
    expect(profile.team_favicon_url).toContain(`/team-favicons/${domains[5]}.png`);
    const stored = await fetch(profile.team_favicon_url);
    expect(stored.headers.get("content-type")).toContain("image/png");
    expect(await sharp(Buffer.from(await stored.arrayBuffer())).metadata()).toMatchObject({ width: 128, height: 64 });
    expect(remote.fetch.mock.calls.at(-1)?.[0].href).toBe(`https://www.google.com/s2/favicons?domain=${domains[5]}&sz=128`);
    expect((await db.from("team_favicon_cache").select("object_path,retry_after").eq("domain", domains[5]).single()).data)
      .toEqual({ object_path: `${domains[5]}.png`, retry_after: null });

    remote.fetch.mockClear();
    expect(await resolveTeamFavicon(`https://${domains[5]}`)).toMatchObject({ teamFaviconUrl: profile.team_favicon_url });
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it("persists a miss across requests and keeps the valid team URL", async () => {
    remote.fetch.mockResolvedValue(null);
    const result = await patch({ team_url: `https://${domains[3]}` });
    expect(result.status).toBe(200);
    expect((await result.json()).team_favicon_url).toBeNull();
    expect(remote.fetch).toHaveBeenCalled();
    remote.fetch.mockClear();
    expect((await patch({ team_url: `https://${domains[3]}` })).status).toBe(200);
    expect(remote.fetch).not.toHaveBeenCalled();
  });
  it("does not let a delayed miss replace a concurrent successful cache entry", async () => {
    let finishLookup = () => {};
    let started = () => {};
    const lookupStarted = new Promise<void>((resolve) => { started = resolve; });
    remote.fetch.mockImplementation(async (url) => url.pathname === "/favicon.svg"
      ? new Promise<null>((resolve) => { finishLookup = () => resolve(null); started(); })
      : null);
    const pending = resolveTeamFavicon(`https://${domains[4]}`);
    await lookupStarted;
    expect((await db.from("team_favicon_cache").upsert({ domain: domains[4], object_path: `${domains[4]}.svg`, retry_after: null })).error).toBeNull();
    finishLookup();
    await pending;
    const { data, error } = await db.from("team_favicon_cache").select("object_path,retry_after").eq("domain", domains[4]).single();
    expect(error).toBeNull();
    expect(data).toEqual({ object_path: `${domains[4]}.svg`, retry_after: null });
  });

});
