// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { discoverFavicon } from "@/lib/favicons/discover";
import { createPublicFetch } from "@/lib/favicons/public-fetch";

vi.mock("@/lib/favicons/public-fetch", async (original) => ({
  ...await original<typeof import("@/lib/favicons/public-fetch")>(),
  createPublicFetch: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

describe("Google fallback deadlines", () => {
  it("starts a fresh fallback deadline after the direct network deadline expires", async () => {
    const png = await sharp({ create: { width: 32, height: 16, channels: 4, background: "red" } }).png().toBuffer();
    const requests: URL[] = [];
    const signals: AbortSignal[] = [];
    vi.mocked(createPublicFetch).mockImplementation((signal) => {
      signals.push(signal);
      return async (url) => {
        requests.push(url);
        if (signal.aborted) return null;
        if (url.hostname === "www.google.com") return { url, bytes: png, contentType: "image/png" };
        return new Promise<null>((resolve) => signal.addEventListener("abort", () => resolve(null), { once: true }));
      };
    });

    const result = await discoverFavicon(new URL("https://example.com"));

    expect(result).toMatchObject({ format: "png", width: 32, height: 16 });
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(requests.at(-1)?.hostname).toBe("www.google.com");
  }, 10_000);

  it("stops a stalled Google request at its own deadline", async () => {
    let fallbackSignal: AbortSignal | undefined;
    vi.mocked(createPublicFetch).mockImplementation((signal) => async (url) => {
      if (url.hostname !== "www.google.com") return null;
      fallbackSignal = signal;
      return new Promise<null>((resolve) => signal.addEventListener("abort", () => resolve(null), { once: true }));
    });

    const result = await discoverFavicon(new URL("https://example.com"));

    expect(result).toBeNull();
    expect(fallbackSignal?.aborted).toBe(true);
  });

  it("keeps the caller's cancellation active during the Google fallback", async () => {
    const controller = new AbortController();
    let fallbackSignal: AbortSignal | undefined;
    vi.mocked(createPublicFetch).mockImplementation((signal) => async (url) => {
      if (url.hostname !== "www.google.com") return null;
      fallbackSignal = signal;
      controller.abort();
      return signal.aborted ? null : { url, bytes: Buffer.from("unexpected"), contentType: "" };
    });

    expect(await discoverFavicon(new URL("https://example.com"), controller.signal)).toBeNull();
    expect(fallbackSignal?.aborted).toBe(true);
  });
});
