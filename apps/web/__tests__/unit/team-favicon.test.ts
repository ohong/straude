import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

import { resolveTeamFavicon } from "@/lib/team-favicon";
import { getServiceClient } from "@/lib/supabase/service";

interface MockBucket {
  getPublicUrl: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
}

function buildMockClient(publicUrl: string | null) {
  const bucket: MockBucket = {
    getPublicUrl: vi.fn().mockReturnValue({
      data: publicUrl ? { publicUrl } : null,
    }),
    upload: vi.fn().mockResolvedValue({ data: { path: "x" }, error: null }),
  };
  const client = {
    storage: {
      from: vi.fn().mockReturnValue(bucket),
    },
  };
  return { client, bucket };
}

const STORAGE_URL = "https://example.supabase.co/storage/v1/object/public/team-favicons/anthropic.com.png";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveTeamFavicon — invalid input", () => {
  it("rejects empty string", async () => {
    const { client } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);

    const result = await resolveTeamFavicon("");
    expect(result).toEqual({ ok: false, error: "invalid_url" });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only", async () => {
    const result = await resolveTeamFavicon("   ");
    expect(result).toEqual({ ok: false, error: "invalid_url" });
  });

  it("rejects non-URL strings", async () => {
    const result = await resolveTeamFavicon("not a url");
    expect(result).toEqual({ ok: false, error: "invalid_url" });
  });

  it("rejects non-http(s) schemes", async () => {
    const result = await resolveTeamFavicon("ftp://example.com");
    expect(result).toEqual({ ok: false, error: "invalid_url" });
  });

  it("rejects javascript: scheme", async () => {
    const result = await resolveTeamFavicon("javascript:alert(1)");
    expect(result).toEqual({ ok: false, error: "invalid_url" });
  });
});

describe("resolveTeamFavicon — cache hit", () => {
  it("reuses cached favicon and skips Google fetch + upload", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);

    // HEAD on the cached public URL returns 200.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD" && url === STORAGE_URL) {
        return new Response(null, { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await resolveTeamFavicon("https://anthropic.com");
    expect(result).toEqual({
      ok: true,
      teamUrl: "https://anthropic.com",
      teamFaviconUrl: STORAGE_URL,
    });
    expect(bucket.upload).not.toHaveBeenCalled();
    // Only one fetch call (the HEAD), no Google fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveTeamFavicon — cache miss, fetch + upload", () => {
  it("fetches favicon from Google and uploads to Storage on miss", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      if (url.startsWith("https://www.google.com/s2/favicons")) {
        const body = new Uint8Array([1, 2, 3, 4]);
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await resolveTeamFavicon("https://anthropic.com");
    expect(result).toEqual({
      ok: true,
      teamUrl: "https://anthropic.com",
      teamFaviconUrl: STORAGE_URL,
    });
    expect(bucket.upload).toHaveBeenCalledTimes(1);
    const [path, body, opts] = bucket.upload.mock.calls[0];
    expect(path).toBe("anthropic.com.png");
    expect(body).toBeInstanceOf(Uint8Array);
    expect(opts).toMatchObject({ contentType: "image/png", upsert: true });
  });
});

describe("resolveTeamFavicon — normalization", () => {
  it("strips path and query from the team URL (origin only)", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await resolveTeamFavicon(
      "https://anthropic.com/research?utm=foo#bar",
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.teamUrl).toBe("https://anthropic.com");
    // Cache key uses bare hostname.
    expect(bucket.getPublicUrl).toHaveBeenCalledWith("anthropic.com.png");
  });

  it("lowercases the cache-key domain", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await resolveTeamFavicon("https://Anthropic.COM");
    expect(bucket.getPublicUrl).toHaveBeenCalledWith("anthropic.com.png");
  });

  it("trims leading/trailing whitespace before parsing", async () => {
    const { client } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await resolveTeamFavicon("  https://anthropic.com  ");
    expect(result.ok).toBe(true);
  });
});

describe("resolveTeamFavicon — graceful degradation", () => {
  it("returns teamFaviconUrl: null when Google fetch fails", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      throw new Error("network down");
    });

    const result = await resolveTeamFavicon("https://anthropic.com");
    expect(result).toEqual({
      ok: true,
      teamUrl: "https://anthropic.com",
      teamFaviconUrl: null,
    });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("returns teamFaviconUrl: null when Google returns non-2xx", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    (getServiceClient as any).mockReturnValue(client);

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 503 });
    });

    const result = await resolveTeamFavicon("https://anthropic.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.teamFaviconUrl).toBeNull();
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("returns teamFaviconUrl: null when Storage upload fails", async () => {
    const { client, bucket } = buildMockClient(STORAGE_URL);
    bucket.upload.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    (getServiceClient as any).mockReturnValue(client);

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      if (url.startsWith("https://www.google.com/s2/favicons")) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await resolveTeamFavicon("https://anthropic.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.teamFaviconUrl).toBeNull();
  });
});
