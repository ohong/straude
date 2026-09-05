import { SAXParser } from "parse5-sax-parser";
import { createPublicFetch, publicHttpUrl, type FaviconFetch, type FaviconResponse } from "./public-fetch";
import { MAX_ICON_BYTES, prepareFavicon, type PreparedFavicon } from "./image";

const DOCUMENT_BYTES = 524_288;
const MAX_CANDIDATES = 12;
type Candidate = { url: URL; svg: boolean; size: number; purpose: number; media: number };

function candidate({ raw, base, type = "", sizes = "", purpose = 0, media = 0 }: {
  raw: string; base: URL; type?: string; sizes?: string; purpose?: number; media?: number;
}): Candidate | null {
  const url = publicHttpUrl(raw, base);
  if (!url || url.pathname.toLowerCase().endsWith(".ico")) return null;
  if (["image/x-icon", "image/vnd.microsoft.icon"].includes(type.toLowerCase().split(";")[0].trim())) return null;
  const dimensions = sizes.toLowerCase().split(/\s+/).slice(0, 32).map((size) => {
    const match = /^(\d+)x(\d+)$/.exec(size);
    return match ? Math.min(Number(match[1]), Number(match[2])) : 0;
  });
  return { url, svg: type.toLowerCase().split(";")[0] === "image/svg+xml" || url.pathname.toLowerCase().endsWith(".svg"), size: Math.max(0, ...dimensions), purpose, media };
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return Number(b.svg) - Number(a.svg) || a.purpose - b.purpose || a.media - b.media || b.size - a.size;
}

function rank(candidates: Candidate[]): Candidate[] {
  const unique = new Map<string, Candidate>();
  for (const item of candidates) {
    const existing = unique.get(item.url.href);
    unique.set(item.url.href, existing ? {
      ...existing, svg: existing.svg || item.svg, size: Math.max(existing.size, item.size),
      purpose: Math.min(existing.purpose, item.purpose), media: Math.min(existing.media, item.media),
    } : item);
  }
  return [...unique.values()].sort(compareCandidates);
}

export function htmlCandidates(response: FaviconResponse): { icons: Candidate[]; manifests: URL[] } {
  if (response.bytes.length > DOCUMENT_BYTES) return { icons: [], manifests: [] };
  const parser = new SAXParser();
  const links: Record<string, string>[] = [];
  let baseHref: string | undefined;
  let tokens = 0;
  let stopped = false;
  let templates = 0;
  const withinBudget = () => {
    if (++tokens <= 2048) return true;
    stopped = true;
    parser.stop();
    return false;
  };
  parser.on("startTag", ({ tagName, attrs }) => {
    if (!withinBudget()) return;
    if (tagName === "template") templates++;
    if (templates || !["link", "base"].includes(tagName)) return;
    const attributes = Object.fromEntries(attrs.map(({ name, value }) => [name, value]));
    if (attributes.href === undefined) return;
    if (tagName === "base" && baseHref === undefined) baseHref = attributes.href;
    if (tagName === "link" && links.length < 64) links.push(attributes);
  });
  parser.on("endTag", ({ tagName }) => {
    if (!withinBudget()) return;
    if (tagName === "template" && templates) templates--;
  });
  try {
    const source = response.bytes.toString("utf8");
    const deadline = performance.now() + 100;
    // Chunking permits deadline checks even inside a large unfinished tag.
    for (let offset = 0; offset < source.length && !stopped; offset += 1024) {
      if (performance.now() >= deadline) { parser.stop(); break; }
      parser.write(source.slice(offset, offset + 1024));
    }
    parser.end();
  } finally {
    parser.destroy();
  }
  const base = baseHref ? publicHttpUrl(baseHref, response.url) ?? response.url : response.url;
  const icons: Candidate[] = [];
  const manifests: URL[] = [];
  for (const link of links) {
    const rel = (link.rel ?? "").toLowerCase().split(/\s+/);
    const media = (link.media ?? "").trim().toLowerCase();
    // Prefer the default/light icon for the shared, theme-independent cache.
    const item = candidate({
      raw: link.href, base, type: link.type ?? "", sizes: link.sizes ?? "",
      media: !media || media === "all" || media === "screen" ? 0 : media === "(prefers-color-scheme: light)" ? 1 : 2,
    });
    if (!item) continue;
    if (rel.includes("icon") || rel.includes("apple-touch-icon")) icons.push(item);
    if (rel.includes("manifest") && !manifests.some((url) => url.href === item.url.href) && manifests.length < 2) manifests.push(item.url);
  }
  return { icons: rank(icons).slice(0, MAX_CANDIDATES), manifests };
}

export function manifestCandidates(response: FaviconResponse): Candidate[] {
  try {
    const manifest: unknown = JSON.parse(response.bytes.toString("utf8"));
    if (!manifest || typeof manifest !== "object" || !("icons" in manifest) || !Array.isArray(manifest.icons)) return [];
    const icons: Candidate[] = [];
    const rawIcons: unknown[] = manifest.icons;
    for (const icon of rawIcons.slice(0, 64)) {
      if (!icon || typeof icon !== "object" || !("src" in icon) || typeof icon.src !== "string") continue;
      const purposes = "purpose" in icon && typeof icon.purpose === "string" ? icon.purpose.toLowerCase().split(/\s+/) : ["any"];
      if (!purposes.some((purpose: string) => ["any", "maskable", "monochrome"].includes(purpose))) continue;
      const item = candidate({
        raw: icon.src, base: response.url,
        type: "type" in icon && typeof icon.type === "string" ? icon.type : "",
        sizes: "sizes" in icon && typeof icon.sizes === "string" ? icon.sizes : "",
        purpose: purposes.includes("any") ? 0 : purposes.includes("maskable") ? 1 : 2,
      });
      if (item) icons.push(item);
    }
    return rank(icons).slice(0, MAX_CANDIDATES);
  } catch {
    return [];
  }
}

async function pairs<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += 2) {
    results.push(...await Promise.all(items.slice(index, index + 2).map(run)));
  }
  return results;
}

export async function discoverFavicon(origin: URL, signal?: AbortSignal): Promise<PreparedFavicon | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await discoverWithFetch(
      origin,
      createPublicFetch(signal ? AbortSignal.any([signal, controller.signal]) : controller.signal),
      () => controller.abort(),
      (url, limit) => {
        const deadline = AbortSignal.timeout(2000);
        return createPublicFetch(signal ? AbortSignal.any([signal, deadline]) : deadline, MAX_ICON_BYTES)(url, limit);
      },
    );
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

export async function discoverWithFetch(
  origin: URL,
  fetch: FaviconFetch,
  cancel: () => void = () => {},
  fallbackFetch: FaviconFetch = fetch,
): Promise<PreparedFavicon | null> {
  const direct = await discoverDirect(origin, fetch, cancel).catch(() => null);
  if (direct) return direct;
  const google = new URL("https://www.google.com/s2/favicons");
  google.searchParams.set("domain", origin.hostname.toLowerCase());
  google.searchParams.set("sz", "128");
  const response = await fallbackFetch(google, MAX_ICON_BYTES).catch(() => null);
  const icon = response ? await prepareFavicon(response.bytes) : null;
  return icon?.format === "png" ? icon : null;
}

async function discoverDirect(origin: URL, fetch: FaviconFetch, cancel: () => void): Promise<PreparedFavicon | null> {
  type Resource =
    | { kind: "image"; icon: PreparedFavicon; sourceBytes: number }
    | { kind: "document"; html: ReturnType<typeof htmlCandidates>; manifest: Candidate[]; sourceBytes: number };
  const fetched = new Map<string, Promise<Resource | null>>();
  const get = (url: URL, limit: number) => {
    let pending = fetched.get(url.href);
    if (!pending) {
      pending = (async (): Promise<Resource | null> => {
        const response = await fetch(url, limit);
        if (!response || response.bytes.length > limit) return null;
        const sourceBytes = response.bytes.length;
        const icon = await prepareFavicon(response.bytes);
        if (icon) return { kind: "image", icon, sourceBytes };
        if (sourceBytes > DOCUMENT_BYTES) return null;
        return { kind: "document", html: htmlCandidates(response), manifest: manifestCandidates(response), sourceBytes };
      })().catch(() => null);
      fetched.set(url.href, pending);
    }
    return pending.then((resource) => resource && resource.sourceBytes <= limit ? resource : null);
  };
  const image = async (url: URL) => {
    const resource = await get(url, MAX_ICON_BYTES);
    return resource?.kind === "image" ? resource.icon : null;
  };
  const [rootIcon, html] = await Promise.all([
    image(new URL("/favicon.svg", origin)).then((icon) => {
      if (icon?.format === "svg") cancel();
      return icon;
    }),
    get(origin, DOCUMENT_BYTES),
  ]);
  if (rootIcon?.format === "svg") return rootIcon;

  const declared = html?.kind === "document" ? html.html : { icons: [], manifests: [] };
  const choose = async (items: Candidate[]) => {
    let raster: { icon: PreparedFavicon; candidate: Candidate } | null = null;
    const ranked = rank(items).slice(0, MAX_CANDIDATES);
    for (let index = 0; index < ranked.length; index += 2) {
      const pending = ranked.slice(index, index + 2).map(async (item) => ({ item, icon: await image(item.url) }));
      for (const result of pending) {
        const { icon, item } = await result;
        if (icon?.format === "svg") {
          cancel();
          return icon;
        }
        if (icon) {
          const decoded = { ...item, svg: false, size: Math.min(icon.width, icon.height) };
          if (!raster || compareCandidates(decoded, raster.candidate) < 0) raster = { icon, candidate: decoded };
        }
      }
    }
    return raster?.icon ?? null;
  };
  const declaredSvg = await choose(declared.icons.filter((icon) => icon.svg));
  if (declaredSvg?.format === "svg") return declaredSvg;

  const manifests = await pairs(declared.manifests, async (url) => {
    const response = await get(url, DOCUMENT_BYTES);
    return response?.kind === "document" ? response.manifest : [];
  });
  const declaredIcon = await choose([...declared.icons, ...manifests.flat()]);
  if (declaredIcon) return declaredIcon;
  if (rootIcon) return rootIcon;

  // Probe conventional manifests before accepting their competing PNG fallback.
  const conventional = await pairs(["/favicon.png", "/manifest.webmanifest", "/manifest.json", "/app.webmanifest"], async (path) => {
    const response = await get(new URL(path, origin), path === "/favicon.png" ? MAX_ICON_BYTES : DOCUMENT_BYTES);
    return { path, response };
  });
  const conventionalIcon = await choose(conventional.flatMap(({ path, response }) => path !== "/favicon.png" && response?.kind === "document" ? response.manifest : []));
  if (conventionalIcon) return conventionalIcon;
  const png = conventional.find(({ path }) => path === "/favicon.png")?.response;
  const prepared = png?.kind === "image" ? png.icon : null;
  return prepared;
}
