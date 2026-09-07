// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http, { request as interceptedHttp } from "node:http";
import { request as interceptedHttps } from "node:https";
import { once } from "node:events";
import { lookup } from "node:dns/promises";
import { createPublicFetch, isPublicAddress, publicHttpUrl } from "@/lib/favicons/public-fetch";

vi.mock("node:http", async (original) => ({ ...await original<typeof import("node:http")>(), request: vi.fn() }));
vi.mock("node:https", async (original) => ({ ...await original<typeof import("node:https")>(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
const realRequest = http.request;
let server: http.Server;
let port = 0;
const paths: string[] = [];
let connectionOptions: http.RequestOptions[] = [];

beforeEach(async () => {
  paths.length = 0;
  connectionOptions = [];
  vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  server = http.createServer((req, res) => {
    paths.push(req.url ?? "");
    if (req.url === "/private") res.writeHead(302, { location: "http://127.0.0.1/secrets" }).end();
    else if (req.url === "/cdn") res.writeHead(302, { location: "https://cdn.example.com/icon" }).end();
    else if (req.url === "/loop") res.writeHead(302, { location: "/loop" }).end();
    else if (req.url === "/large") { res.write("12345"); res.end("67890"); }
    else if (req.url === "/declared-large") res.writeHead(200, { "content-length": "100000" }).end();
    else if (req.url === "/compressed") res.writeHead(200, { "content-encoding": "gzip" }).end("bytes");
    else if (req.url === "/slow") { res.write("partial"); }
    else res.writeHead(200, { "content-type": "image/png" }).end("icon");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test listener");
  port = address.port;
  // Only the socket transport is redirected to a local fixture; production URL/DNS checks run unchanged.
  const transport = (url: URL, options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => {
    connectionOptions.push(options);
    return realRequest(`http://127.0.0.1:${port}${url.pathname}`, { ...options, family: 4 }, callback);
  };
  vi.mocked(interceptedHttp).mockImplementation(transport);
  vi.mocked(interceptedHttps).mockImplementation(transport);
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.restoreAllMocks();
});

describe("public favicon transport", () => {
  it.each(["127.0.0.1", "0.0.0.0", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "168.63.129.16", "100.64.0.1", "192.0.2.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1", "4000::1"])("blocks %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it("accepts global v4/v6 and rejects credentials, non-default ports and non-HTTP URLs", () => {
    for (const address of ["93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) expect(isPublicAddress(address)).toBe(true);
    for (const url of ["file:///etc/passwd", "ftp://example.com", "https://user:pass@example.com", "http://example.com:8080"]) expect(publicHttpUrl(url)).toBeNull();
  });

  it("pins the checked address without a second DNS lookup and preserves TLS hostname", async () => {
    const result = await createPublicFetch(AbortSignal.timeout(1000))(new URL("https://example.com/icon"), 100);
    expect(result?.bytes.toString()).toBe("icon");
    expect(lookup).toHaveBeenCalledTimes(1);
    const callback = vi.fn();
    const pinnedLookup = connectionOptions[0]?.lookup;
    if (!pinnedLookup) throw new Error("Missing pinned lookup");
    pinnedLookup("example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(connectionOptions[0]?.agent).toBe(false);
    expect(connectionOptions[0]?.headers).not.toHaveProperty("Cookie");
  });

  it("rejects mixed DNS results and numeric loopback forms before connecting", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    const fetch = createPublicFetch(AbortSignal.timeout(1000));
    for (const url of ["https://example.com", "http://2130706433", "http://0x7f000001", "http://[::ffff:127.0.0.1]"]) expect(await fetch(new URL(url), 100)).toBeNull();
    expect(paths).toEqual([]);
  });

  it("validates every redirect and follows a safe cross-origin CDN", async () => {
    const fetch = createPublicFetch(AbortSignal.timeout(1000));
    expect(await fetch(new URL("https://example.com/private"), 100)).toBeNull();
    expect(paths).toEqual(["/private"]);
    expect((await fetch(new URL("https://example.com/cdn"), 100))?.url.href).toBe("https://cdn.example.com/icon");
    expect(lookup).toHaveBeenCalledWith("cdn.example.com", { all: true, verbatim: true });
  });

  it("bounds redirect count and aggregate network requests", async () => {
    const fetch = createPublicFetch(AbortSignal.timeout(2000));
    expect(await fetch(new URL("https://example.com/loop"), 100)).toBeNull();
    expect(paths).toHaveLength(4);
    for (let i = 0; i < 30; i++) await fetch(new URL("https://example.com/icon"), 100);
    expect(paths).toHaveLength(24);
  });

  it("caps declared and chunked bodies and rejects compressed responses", async () => {
    const fetch = createPublicFetch(AbortSignal.timeout(1000));
    for (const path of ["/large", "/declared-large", "/compressed"]) expect(await fetch(new URL(path, "https://example.com"), 8)).toBeNull();
  });

  it("shares a cumulative byte budget across concurrent downloads", async () => {
    const fetch = createPublicFetch(AbortSignal.timeout(1000), 6);
    const results = await Promise.all([fetch(new URL("https://example.com/icon"), 100), fetch(new URL("https://example.com/icon"), 100)]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await fetch(new URL("https://example.com/icon"), 100)).toBeNull();
  });

  it("charges streamed bytes even when a resource exceeds its individual limit", async () => {
    const fetch = createPublicFetch(AbortSignal.timeout(1000), 5);

    expect(await fetch(new URL("https://example.com/large"), 4)).toBeNull();
    expect(await fetch(new URL("https://example.com/icon"), 100)).toBeNull();
    expect(paths).toEqual(["/large"]);
  });

  it("aborts stalled body reads and stalled DNS within the same deadline", async () => {
    expect(await createPublicFetch(AbortSignal.timeout(30))(new URL("https://example.com/slow"), 100)).toBeNull();
    vi.mocked(lookup).mockImplementation(() => new Promise(() => {}));
    expect(await createPublicFetch(AbortSignal.timeout(30))(new URL("https://example.com/icon"), 100)).toBeNull();
  });
});
