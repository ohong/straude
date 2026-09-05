// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { SAXParser } from "parse5-sax-parser";
import { discoverWithFetch, htmlCandidates, manifestCandidates } from "@/lib/favicons/discover";
import type { FaviconResponse } from "@/lib/favicons/public-fetch";

const origin = new URL("https://example.com");
const vector = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="red"/></svg>');
const response = (body: string | Buffer, url = origin.href): FaviconResponse => ({ url: new URL(url), bytes: Buffer.from(body), contentType: "" });

function site(files: Record<string, string | Buffer>) {
  let active = 0;
  let peak = 0;
  const fetch = vi.fn(async (url: URL) => {
    active++;
    peak = Math.max(active, peak);
    await new Promise((resolve) => setTimeout(resolve, url.pathname.endsWith(".svg") ? 10 : 1));
    active--;
    const body = files[url.href] ?? files[url.pathname];
    return body === undefined ? null : response(body, url.href);
  });
  return { fetch, peak: () => peak, paths: () => fetch.mock.calls.map(([url]) => url.href) };
}

describe("favicon discovery", () => {
  it("uses real HTML parsing, redirected document URL, base, rel tokens, metadata and deduplication", () => {
    const result = htmlCandidates(response('<base href="../assets/"><link REL="SHORTCUT ICON" href="mark.png" sizes="32x32"><link rel="ICON" href="mark.png"><link rel="apple-touch-icon" href="large.png" sizes="192x192"><link rel="icon" href="vector" type="image/svg+xml"><link rel="manifest" href="app.json"><meta property="og:image" content="banner.png">', "https://cdn.example.com/docs/page"));
    expect(result.icons.map((icon) => icon.url.href)).toEqual(["https://cdn.example.com/assets/vector", "https://cdn.example.com/assets/large.png", "https://cdn.example.com/assets/mark.png"]);
    expect(result.manifests[0]?.href).toBe("https://cdn.example.com/assets/app.json");
  });

  it("extracts early links without building a deeply nested body DOM", () => {
    const html = '<link rel="icon" href="/early.svg">' + '<div>'.repeat(10_000)
      + '<link rel="icon" href="/late.svg">' + '</div>'.repeat(10_000);
    const result = htmlCandidates(response(html));
    expect(result.icons.map((icon) => icon.url.pathname)).toEqual(["/early.svg"]);
  }, 10_000);

  it("ignores inert markup and resolves links against the first non-template base", () => {
    const html = '<script>"<link rel=icon href=/script.svg>"</script>'
      + '<style>/* <link rel=icon href=/style.svg> */</style>'
      + '<!-- <link rel=icon href=/comment.svg> -->'
      + '<template><base href="https://wrong.example/"><link rel=icon href=/template.svg></template>'
      + '<textarea><link rel=icon href=/textarea.svg></textarea>'
      + '<link rel="icon" href="logo.svg?a=1&amp;b=2"><base href="/assets/"><base href="/ignored/">';
    expect(htmlCandidates(response(html)).icons.map((icon) => icon.url.href))
      .toEqual(["https://example.com/assets/logo.svg?a=1&b=2"]);
  });

  it("still tries Google when direct HTML parsing throws", async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
    const fixture = site({ "/": "<html></html>", "https://www.google.com/s2/favicons?domain=example.com&sz=128": png });
    const parser = vi.spyOn(SAXParser.prototype, "write").mockImplementationOnce(() => { throw new Error("Parser failure"); });
    try {
      expect((await discoverWithFetch(origin, fixture.fetch))?.format).toBe("png");
      expect(fixture.paths().at(-1)).toContain("www.google.com/s2/favicons");
    } finally {
      parser.mockRestore();
    }
  });

  it("resolves manifest icons relative to the final manifest URL and prefers any purpose", () => {
    const result = manifestCandidates(response(JSON.stringify({ icons: [{ src: "mask.svg", purpose: "maskable" }, { src: "any.svg", purpose: "any maskable" }, { src: "mono.svg", purpose: "monochrome" }, { src: "bad.svg", purpose: "unknown" }] }), "https://cdn.example.com/apps/manifest.json"));
    expect(result.map((icon) => icon.url.href)).toEqual(["https://cdn.example.com/apps/any.svg", "https://cdn.example.com/apps/mask.svg", "https://cdn.example.com/apps/mono.svg"]);
  });

  it("returns a usable conventional SVG early and cancels other work", async () => {
    const fixture = site({ "/favicon.svg": vector });
    const cancel = vi.fn();
    const result = await discoverWithFetch(origin, fixture.fetch, cancel);
    expect(result?.format).toBe("svg");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
    expect(fixture.peak()).toBe(2);
  });

  it("returns a declared SVG without waiting for a stalled manifest", async () => {
    const fetch = vi.fn(async (url: URL): Promise<FaviconResponse | null> => {
      if (url.pathname === "/") return response('<link rel="icon" href="/brand.svg"><link rel="manifest" href="/stalled.json">');
      if (url.pathname === "/brand.svg") return response(vector, url.href);
      if (url.pathname === "/stalled.json") return new Promise(() => {});
      return null;
    });
    const cancel = vi.fn();

    const result = await discoverWithFetch(origin, fetch, cancel);

    expect(result?.format).toBe("svg");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.map(([url]) => url.pathname)).toEqual(["/favicon.svg", "/", "/brand.svg"]);
  }, 1000);

  it("keeps a mislabeled SVG's PNG result while looking for a real manifest SVG", async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
    const fixture = site({
      "/": '<link rel="icon" href="/actually-png.svg"><link rel="manifest" href="/app.json">',
      "/actually-png.svg": png,
      "/app.json": JSON.stringify({ icons: [{ src: "/real.svg" }] }),
      "/real.svg": vector,
    });

    expect((await discoverWithFetch(origin, fixture.fetch))?.format).toBe("svg");
    expect(fixture.paths().filter((url) => url.endsWith("/actually-png.svg"))).toHaveLength(1);
    expect(fixture.peak()).toBeLessThanOrEqual(2);
  });

  it("prefers a delayed declared manifest SVG over a fast declared PNG", async () => {
    const png = await sharp({ create: { width: 256, height: 256, channels: 4, background: "red" } }).png().toBuffer();
    const fixture = site({ "/": '<link rel="icon" href="fast.png"><link rel="manifest" href="/app/manifest.json">', "/fast.png": png,
      "/app/manifest.json": JSON.stringify({ icons: [{ src: "icon.svg", purpose: "any" }] }), "/app/icon.svg": vector });
    expect((await discoverWithFetch(origin, fixture.fetch))?.format).toBe("svg");
    expect(fixture.paths()).not.toContain("https://example.com/favicon.png");
    expect(fixture.paths().some((url) => url.startsWith("https://www.google.com/"))).toBe(false);
    expect(fixture.peak()).toBeLessThanOrEqual(2);
  });

  it("keeps the raster fallback when SVG reads fail and uses deterministic quality ranking", async () => {
    const small = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
    const large = await sharp({ create: { width: 512, height: 256, channels: 4, background: "blue" } }).png().toBuffer();
    const fixture = site({ "/": '<link rel="icon" href="bad.svg"><link rel="icon" href="small.png"><link rel="icon" href="large.png">', "/small.png": small, "/large.png": large, "/bad.svg": "invalid" });
    expect(await discoverWithFetch(origin, fixture.fetch)).toMatchObject({ format: "png", width: 128, height: 64 });
  });

  it("checks conventional manifests before accepting favicon.png and uses Google last", async () => {
    const fixture = site({ "/manifest.webmanifest": JSON.stringify({ icons: [{ src: "/brand.svg" }] }), "/brand.svg": vector });
    expect((await discoverWithFetch(origin, fixture.fetch))?.format).toBe("svg");
    expect(fixture.paths()).not.toContain("https://example.com/favicon.ico");
    const empty = site({});
    expect(await discoverWithFetch(origin, empty.fetch)).toBeNull();
    expect(empty.paths().at(-1)).toBe("https://www.google.com/s2/favicons?domain=example.com&sz=128");
    expect(empty.paths()).not.toContain("https://example.com/favicon.ico");
  });

  it("skips ICO links and normalizes a Google fallback after direct discovery fails", async () => {
    const png = await sharp({ create: { width: 256, height: 128, channels: 4, background: "blue" } }).png().toBuffer();
    const fixture = site({
      "/": '<link rel="icon" href="/favicon.ico"><link rel="icon" href="/opaque" type="image/x-icon"><link rel="manifest" href="/app.json">',
      "/app.json": JSON.stringify({ icons: [{ src: "/manifest.ico" }, { src: "/opaque-icon", type: "image/vnd.microsoft.icon" }] }),
      "https://www.google.com/s2/favicons?domain=example.com&sz=128": png,
    });

    const result = await discoverWithFetch(origin, fixture.fetch);

    expect(result).toMatchObject({ format: "png", width: 128, height: 64 });
    expect((await sharp(result!.bytes).metadata()).format).toBe("png");
    expect(fixture.paths().at(-1)).toBe("https://www.google.com/s2/favicons?domain=example.com&sz=128");
    expect(fixture.paths().some((url) => /\.ico$|\/opaque/.test(url))).toBe(false);
  });

  it("does not call Google when a direct PNG is usable", async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
    const fixture = site({ "/favicon.png": png });

    expect((await discoverWithFetch(origin, fixture.fetch))?.format).toBe("png");
    expect(fixture.paths().some((url) => url.startsWith("https://www.google.com/"))).toBe(false);
  });

  it("can use an independent fallback transport after direct requests abort", async () => {
    const direct = vi.fn(async () => { throw new DOMException("Timed out", "AbortError"); });
    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
    const fallback = vi.fn(async () => response(png));

    const result = await discoverWithFetch(origin, direct, () => {}, fallback);

    expect(result?.format).toBe("png");
    expect(fallback).toHaveBeenCalledExactlyOnceWith(new URL("https://www.google.com/s2/favicons?domain=example.com&sz=128"), 4 * 1024 * 1024);
  });

  it.each([Buffer.from("not an image"), vector, Buffer.alloc(4 * 1024 * 1024 + 1)])("rejects invalid Google image responses", async (bytes) => {
    const fixture = site({ "https://www.google.com/s2/favicons?domain=example.com&sz=128": bytes });
    expect(await discoverWithFetch(origin, fixture.fetch)).toBeNull();
  });

  it("returns no icon if both discovery and Google fail", async () => {
    const fixture = site({});
    const fallback = vi.fn(async () => { throw new Error("Google unavailable"); });
    expect(await discoverWithFetch(origin, fixture.fetch, () => {}, fallback)).toBeNull();
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("bounds declared candidates, deduplicates requests and ignores Open Graph images", async () => {
    const fixture = site({ "/": '<meta property="og:image" content="og.svg">' + Array.from({ length: 100 }, (_, i) => `<link rel="icon" href="${i}.svg"><link rel="icon" href="${i}.svg">`).join("") });
    await discoverWithFetch(origin, fixture.fetch);
    expect(new Set(fixture.paths()).size).toBe(fixture.paths().length);
    expect(fixture.paths().filter((path) => /\d+\.svg$/.test(path))).toHaveLength(12);
    expect(fixture.paths()).not.toContain("https://example.com/og.svg");
  });

  it("applies the document byte cap when reusing an earlier image response", async () => {
    const fixture = site({
      "/": '<link rel="manifest" href="/favicon.svg">',
      "/favicon.svg": JSON.stringify({ padding: "x".repeat(524_288), icons: [{ src: "/from-manifest.svg" }] }),
      "/from-manifest.svg": vector,
    });
    expect(await discoverWithFetch(origin, fixture.fetch)).toBeNull();
    expect(fixture.paths()).not.toContain("https://example.com/from-manifest.svg");
  });
});
