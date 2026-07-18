// Satori (next/og) only decodes PNG, JPEG, and GIF. User-uploaded images can
// be webp/avif regardless of file extension, which makes the whole OG image
// render throw. Fetch the image, sniff its real format from magic bytes, and
// return a data URI satori can decode — or null so callers fall back to their
// no-image layout.
export async function loadSafeOgImage(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = sniffMime(buf);
    if (!mime) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
    return "image/gif";
  return null;
}
