import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { parse, walk, type CssNode } from "css-tree";
import { SaxesParser } from "saxes";
import sharp from "sharp";

export const MAX_ICON_BYTES = 4 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 524_288;
const MAX_PIXELS = 16_777_216;
export type PreparedFavicon = {
  format: "svg" | "png";
  bytes: Buffer;
  width: number;
  height: number;
};

const STYLE_PROPERTIES = new Set([
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
  "opacity", "color", "clip-path", "clip-rule", "mask", "stop-color", "stop-opacity",
  "display", "visibility", "transform", "transform-origin", "vector-effect", "paint-order",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
]);
const PAINT_ATTRIBUTES = new Set(["fill", "stroke", "filter", "clip-path", "mask", "cursor", "marker", "marker-start", "marker-mid", "marker-end"]);

function checkCss(source: string, context: "stylesheet" | "declarationList" | "value") {
  const tree = parse(source, { context });
  walk(tree, (node: CssNode) => {
    if (node.type === "Raw"
      || (node.type === "Declaration" && !STYLE_PROPERTIES.has(node.property.toLowerCase()))
      || (node.type === "Url" && !/^#[\w-]+$/.test(node.value))
      || (node.type === "Atrule" && node.name.toLowerCase() !== "media")) {
      throw new Error("SVG requires external or unsupported CSS");
    }
  });
}

function sanitizeSvg(bytes: Buffer): PreparedFavicon | null {
  if (bytes.length > MAX_OUTPUT_BYTES) return null;
  const source = bytes.toString("utf8");
  let nodes = 0;
  let depth = 0;
  const parser = new SaxesParser({ xmlns: true });
  parser.on("doctype", () => { throw new Error("SVG document types are not allowed"); });
  parser.on("processinginstruction", ({ target }) => {
    if (target !== "xml") throw new Error("SVG processing instructions are not allowed");
  });
  parser.on("opentag", (tag) => {
    if (++nodes > 2048 || ++depth > 32 || Object.keys(tag.attributes).length > 64) throw new Error("SVG is too complex");
  });
  parser.on("closetag", () => { depth--; });
  parser.write(source).close();

  const dom = new JSDOM("", { contentType: "text/html" });
  try {
    const document = new dom.window.DOMParser().parseFromString(source, "image/svg+xml");
    if (document.documentElement.localName !== "svg"
      || document.documentElement.namespaceURI !== "http://www.w3.org/2000/svg"
      || document.querySelector("parsererror")) return null;
    const purifier = createDOMPurify(dom.window);
    purifier.addHook("uponSanitizeAttribute", (_node, data) => {
      if (data.attrName === "href" || data.attrName === "xlink:href") {
        if (!/^#[\w-]+$/.test(data.attrValue)) throw new Error("SVG requires an external resource");
      }
      if (data.attrName === "style") checkCss(data.attrValue, "declarationList");
      if (PAINT_ATTRIBUTES.has(data.attrName)) checkCss(data.attrValue, "value");
    });
    purifier.addHook("uponSanitizeElement", (node, data) => {
      if (data.tagName === "style") checkCss(node.textContent ?? "", "stylesheet");
    });
    const clean = purifier.sanitize(document.documentElement, {
      USE_PROFILES: { svg: true },
      FORBID_TAGS: ["foreignObject", "image", "animate", "animateMotion", "animateTransform", "set", "filter"],
      FORBID_ATTR: ["xml:base"],
      ALLOW_DATA_ATTR: false,
      RETURN_DOM: true,
    });
    if (!(clean instanceof dom.window.Element)) return null;
    const svg = clean.localName === "svg" ? clean : clean.querySelector("svg");
    if (!svg || !svg.querySelector("path,rect,circle,ellipse,polygon,polyline,line,text,use")) return null;
    const output = Buffer.from(new dom.window.XMLSerializer().serializeToString(svg));
    return output.length <= MAX_OUTPUT_BYTES ? { format: "svg", bytes: output, width: 0, height: 0 } : null;
  } finally {
    dom.window.close();
  }
}

async function normalizeRaster(input: sharp.Sharp): Promise<PreparedFavicon> {
  const { data, info } = await input
    .timeout({ seconds: 1 })
    .autoOrient()
    .resize({ width: 128, height: 128, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .png({ compressionLevel: 6, palette: false })
    .toBuffer({ resolveWithObject: true });
  if (data.length > MAX_OUTPUT_BYTES) throw new Error("Favicon output is too large");
  return { format: "png", bytes: data, width: info.width, height: info.height };
}

export async function prepareFavicon(bytes: Buffer): Promise<PreparedFavicon | null> {
  if (!bytes.length || bytes.length > MAX_ICON_BYTES) return null;
  try {
    if (bytes.toString("utf8", 0, 256).trimStart().startsWith("<")) return sanitizeSvg(bytes);
    const signature = bytes.subarray(0, 12);
    const raster = signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || signature.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      || ["GIF87a", "GIF89a"].includes(signature.toString("ascii", 0, 6))
      || (signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP")
      || signature.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0]))
      || signature.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42]))
      || (signature.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(signature.toString("ascii", 8, 12)));
    if (!raster) return null;
    const input = sharp(bytes, { limitInputPixels: MAX_PIXELS });
    const metadata = await input.metadata();
    if (!["png", "jpeg", "webp", "gif", "avif", "tiff"].includes(metadata.format ?? "")) return null;
    return await normalizeRaster(input);
  } catch {
    return null;
  }
}
