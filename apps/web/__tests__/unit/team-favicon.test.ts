// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";
import { discoverFavicon } from "@/lib/favicons/discover";
import { resolveTeamFavicon } from "@/lib/team-favicon";

vi.mock("@/lib/supabase/service", () => ({ getServiceClient: vi.fn() }));
vi.mock("@/lib/favicons/discover", () => ({ discoverFavicon: vi.fn() }));

type CacheEntry = { domain: string; object_path: string | null; retry_after: string | null };
let cache: CacheEntry | null;
let legacy = false;
let storageFailure = false;
let uploads: { url: string; type: string | null; bytes: ArrayBuffer }[];
let requests: string[];
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16"/></svg>');

beforeEach(() => {
  vi.clearAllMocks();
  cache = null;
  legacy = false;
  storageFailure = false;
  uploads = [];
  requests = [];
  vi.mocked(discoverFavicon).mockResolvedValue({ format: "svg", bytes: svg, width: 0, height: 0 });
  const client = createClient("https://storage.example.com", "test-secret", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const req = new Request(input, init);
      requests.push(`${req.method} ${req.url}`);
      if (req.url.includes("/rest/v1/team_favicon_cache")) {
        if (req.method === "GET") return Response.json(cache ? [cache] : []);
        const body = await req.json();
        if (req.method === "PATCH") {
          if (cache?.object_path === null) cache = { ...cache, ...body };
        } else if (!cache || !req.headers.get("prefer")?.includes("ignore-duplicates")) cache = body;
        return new Response(null, { status: 201 });
      }
      if (req.method === "HEAD") return new Response(null, { status: legacy ? 200 : 404 });
      uploads.push({ url: req.url, type: req.headers.get("content-type"), bytes: await req.arrayBuffer() });
      return storageFailure ? Response.json({ error: "unavailable" }, { status: 503 }) : Response.json({ Key: "team-favicons/example.com.svg" });
    } },
  });
  vi.mocked(getServiceClient).mockReturnValue(client);
});

describe("team favicon cache", () => {
  it.each(["", "example.com", "ftp://example.com", "https://user:secret@example.com", "https://example.com:1234"])("rejects invalid or unsupported URLs: %s", async (url) => {
    expect(await resolveTeamFavicon(url)).toEqual({ ok: false, error: "invalid_url" });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  it("normalizes the origin and stores sanitized SVG with its real format", async () => {
    const result = await resolveTeamFavicon("  https://EXAMPLE.com/about?q=1#top  ");
    expect(result).toEqual({ ok: true, teamUrl: "https://example.com", teamFaviconUrl: "https://storage.example.com/storage/v1/object/public/team-favicons/example.com.svg" });
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.type).toBe("image/svg+xml");
    expect(Buffer.from(uploads[0]!.bytes)).toEqual(svg);
    expect(cache).toEqual({ domain: "example.com", object_path: "example.com.svg", retry_after: null });
  });

  it("uses persisted metadata on subsequent requests without a Storage HEAD or discovery", async () => {
    await resolveTeamFavicon("https://example.com");
    requests = [];
    const result = await resolveTeamFavicon("https://EXAMPLE.com");
    expect(result.ok && result.teamFaviconUrl).toContain("example.com.svg");
    expect(discoverFavicon).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);
  });

  it("preserves legacy PNGs and backfills metadata without external discovery", async () => {
    legacy = true;
    const result = await resolveTeamFavicon("https://example.com");
    expect(result.ok && result.teamFaviconUrl).toContain("example.com.png");
    expect(cache?.object_path).toBe("example.com.png");
    expect(discoverFavicon).not.toHaveBeenCalled();
    expect(uploads).toEqual([]);
  });

  it("persists short-lived misses and retries once they expire", async () => {
    vi.mocked(discoverFavicon).mockResolvedValue(null);
    await resolveTeamFavicon("https://example.com");
    expect(Date.parse(cache!.retry_after!) - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    await resolveTeamFavicon("https://example.com");
    expect(discoverFavicon).toHaveBeenCalledOnce();
    cache!.retry_after = new Date(0).toISOString();
    await resolveTeamFavicon("https://example.com");
    expect(discoverFavicon).toHaveBeenCalledTimes(2);
  });

  it("keeps a valid team URL when discovery, storage or client setup fails", async () => {
    const fallback = { ok: true, teamUrl: "https://example.com", teamFaviconUrl: null };
    storageFailure = true;
    expect(await resolveTeamFavicon("https://example.com")).toEqual(fallback);
    expect(cache).toBeNull();
    vi.mocked(discoverFavicon).mockRejectedValueOnce(new Error("offline"));
    expect(await resolveTeamFavicon("https://example.com")).toEqual(fallback);
    vi.mocked(getServiceClient).mockImplementationOnce(() => { throw new Error("unavailable"); });
    expect(await resolveTeamFavicon("https://example.com")).toEqual(fallback);
  });
});
