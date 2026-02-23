import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export type OGFont = {
  name: string;
  data: ArrayBuffer;
  style: "normal";
  weight: 700 | 500;
};

// new URL() tells Next.js file tracing to bundle these into the serverless function.
const interBoldUrl = new URL("../assets/Inter-Bold.ttf", import.meta.url);
const interMediumUrl = new URL("../assets/Inter-Medium.ttf", import.meta.url);

async function loadFile(url: URL): Promise<ArrayBuffer> {
  // file:// URLs (local dev) — use readFile since fetch doesn't support file://
  if (url.protocol === "file:") {
    const buf = await readFile(fileURLToPath(url));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  // http(s):// URLs (production / Vercel) — use fetch
  return fetch(url).then((r) => r.arrayBuffer());
}

let cached: OGFont[] | null = null;

export async function loadFonts(): Promise<OGFont[]> {
  if (cached) return cached;

  const [bold, medium] = await Promise.all([
    loadFile(interBoldUrl),
    loadFile(interMediumUrl),
  ]);

  cached = [
    { name: "Inter", data: bold, style: "normal", weight: 700 },
    { name: "Inter", data: medium, style: "normal", weight: 500 },
  ];

  return cached;
}
