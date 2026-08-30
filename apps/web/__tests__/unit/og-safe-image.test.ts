import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSafeOgAvatar, loadSafeOgPostImage } from "@/lib/og-safe-image";

const STORAGE_ORIGIN = "https://test.supabase.co";
const AVATAR_URL = `${STORAGE_ORIGIN}/storage/v1/object/public/avatars/user-1/avatar.jpg`;
const POST_IMAGE_URL = `${STORAGE_ORIGIN}/storage/v1/object/public/post-images/user-1/hero.jpg`;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
  Buffer.alloc(16),
]);

function imageResponse(body: Buffer, init: ResponseInit = {}): Response {
  return new Response(new Uint8Array(body), init);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", STORAGE_ORIGIN);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loadSafeOgAvatar / loadSafeOgPostImage", () => {
  it("returns a data URI for a satori-decodable first-party image", async () => {
    fetchMock.mockResolvedValue(imageResponse(PNG));

    await expect(loadSafeOgAvatar(AVATAR_URL)).resolves.toBe(
      `data:image/png;base64,${PNG.toString("base64")}`,
    );
  });

  it("returns null for a webp stored under a .jpg extension", async () => {
    // The exact production failure: satori throws "Unsupported image type:
    // image/webp" and takes the whole card render down with it.
    fetchMock.mockResolvedValue(imageResponse(WEBP));

    await expect(loadSafeOgPostImage(POST_IMAGE_URL)).resolves.toBeNull();
  });

  it("never fetches a URL outside the storage allowlist", async () => {
    // avatar_url is written verbatim by PATCH /api/users/me, so an attacker
    // controls it end to end. Fetching it server-side would be an SSRF probe.
    await expect(
      loadSafeOgAvatar("http://169.254.169.254/latest/meta-data/"),
    ).resolves.toBeNull();
    await expect(
      loadSafeOgAvatar("https://attacker.example.com/pixel.png"),
    ).resolves.toBeNull();
    await expect(
      loadSafeOgPostImage(
        `${STORAGE_ORIGIN}/storage/v1/object/public/dm-attachments/user-1/x.png`,
      ),
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the avatar CDN hosts the profile flow accepts", async () => {
    fetchMock.mockResolvedValue(imageResponse(PNG));

    await expect(
      loadSafeOgAvatar("https://avatars.githubusercontent.com/u/1?v=4"),
    ).resolves.toContain("data:image/png;base64,");
  });

  it("rejects a post hero image served from an avatar CDN host", async () => {
    await expect(
      loadSafeOgPostImage("https://avatars.githubusercontent.com/u/1?v=4"),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a non-ok response", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));

    await expect(loadSafeOgAvatar(AVATAR_URL)).resolves.toBeNull();
  });

  it("returns null when the fetch rejects (timeout, DNS, reset)", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(loadSafeOgAvatar(AVATAR_URL)).resolves.toBeNull();
  });

  it("aborts the fetch on a deadline instead of holding the render open", async () => {
    fetchMock.mockResolvedValue(imageResponse(PNG));

    await loadSafeOgAvatar(AVATAR_URL);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses an oversized image declared by content-length without buffering it", async () => {
    fetchMock.mockResolvedValue(
      imageResponse(PNG, {
        headers: { "content-length": String(50 * 1024 * 1024) },
      }),
    );

    await expect(loadSafeOgAvatar(AVATAR_URL)).resolves.toBeNull();
  });

  it("refuses an oversized image that lied about (or omitted) content-length", async () => {
    const huge = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    fetchMock.mockResolvedValue(imageResponse(huge));

    await expect(loadSafeOgAvatar(AVATAR_URL)).resolves.toBeNull();
  });

  it("returns null for empty input without fetching", async () => {
    await expect(loadSafeOgAvatar(null)).resolves.toBeNull();
    await expect(loadSafeOgAvatar(undefined)).resolves.toBeNull();
    await expect(loadSafeOgPostImage("")).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
