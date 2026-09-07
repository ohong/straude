import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export type FaviconResponse = { url: URL; bytes: Buffer; contentType: string };
export type FaviconFetch = (url: URL, maxBytes: number) => Promise<FaviconResponse | null>;

export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  const ip = ipaddr.process(address);
  if (ip.toString() === "168.63.129.16") return false;
  if (ip.range() !== "unicast") return false;
  // IPv6 destinations must be globally allocated, excluding transition ranges.
  return ip.kind() === "ipv4" || ip.match(ipaddr.parse("2000::"), 3);
}

export function publicHttpUrl(raw: string, base?: URL): URL | null {
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export function createPublicFetch(signal: AbortSignal, maxTotalBytes = 12 * 1024 * 1024): FaviconFetch {
  let requests = 0;
  let remainingBytes = maxTotalBytes;
  return async (initialUrl, maxBytes) => {
    try {
      let url = initialUrl;
      for (let redirect = 0; redirect <= 3; redirect++) {
        signal.throwIfAborted();
        if (remainingBytes <= 0 || !publicHttpUrl(url.href) || ++requests > 24) return null;
        const hostname = url.hostname.replace(/^\[|\]$/g, "");
        const addresses = isIP(hostname)
          ? [{ address: hostname, family: isIP(hostname) }]
          : await untilAborted(lookup(hostname, { all: true, verbatim: true }), signal);
        if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) return null;
        const address = addresses[0];
        if (!address) return null;
        signal.throwIfAborted();

        const response = await new Promise<FaviconResponse | URL | null>((resolve, reject) => {
          const request = url.protocol === "https:" ? httpsRequest : httpRequest;
          const req = request(url, {
            method: "GET",
            agent: false,
            signal,
            family: address.family,
            // Keep Host and TLS SNI on the URL hostname; DNS cannot change the connection target.
            lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
            maxHeaderSize: 16_384,
            headers: { Accept: "*/*", "Accept-Encoding": "identity", "User-Agent": "Straude-Favicon/1.0" },
          }, (res) => {
            const status = res.statusCode ?? 0;
            if ([301, 302, 303, 307, 308].includes(status)) {
              const next = res.headers.location ? publicHttpUrl(res.headers.location, url) : null;
              res.destroy();
              resolve(next);
              return;
            }
            if (status < 200 || status >= 300
              || Number(res.headers["content-length"]) > Math.min(maxBytes, remainingBytes)
              || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
              res.destroy();
              resolve(null);
              return;
            }
            const chunks: Buffer[] = [];
            let length = 0;
            res.on("data", (chunk: Buffer) => {
              length += chunk.length;
              remainingBytes -= chunk.length;
              if (length > maxBytes || remainingBytes < 0) {
                res.destroy();
                resolve(null);
              } else chunks.push(chunk);
            });
            res.on("error", reject);
            res.on("aborted", () => resolve(null));
            res.on("end", () => resolve({ url, bytes: Buffer.concat(chunks), contentType: res.headers["content-type"] ?? "" }));
          });
          req.on("error", reject);
          req.end();
        });
        if (!(response instanceof URL)) return response;
        url = response;
      }
      return null;
    } catch {
      return null;
    }
  };
}
