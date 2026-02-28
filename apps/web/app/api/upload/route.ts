import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import convert from "heic-convert";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/octet-stream", // iOS sometimes sends HEIC with this MIME type
];
const HEIC_MIME_TYPES = ["image/heic", "image/heif"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

// HEIC/HEIF files contain an "ftyp" box at offset 4 with one of these brands
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

/** Detect HEIC/HEIF by magic bytes — more reliable than MIME type. */
function isHeicByMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ftyp = buf.toString("ascii", 4, 8);
  if (ftyp !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return HEIC_BRANDS.includes(brand);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error:
          "File type not allowed. Accepted: JPEG, PNG, WebP, GIF, HEIC, HEIF",
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 20MB" },
      { status: 400 }
    );
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let ext: string;

  // Detect HEIC by magic bytes OR MIME type — iOS sometimes mislabels HEIC files
  const isHeic = HEIC_MIME_TYPES.includes(file.type) || isHeicByMagicBytes(buffer);

  if (isHeic) {
    // Use heic-convert (pure JS, no native deps) for reliable HEIC→JPEG conversion
    const jpegBuf = await convert({ buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), format: "JPEG", quality: 0.9 });
    buffer = Buffer.from(jpegBuf);
    contentType = "image/jpeg";
    ext = "jpg";
  } else if (file.type === "application/octet-stream") {
    // octet-stream that isn't HEIC — reject
    return NextResponse.json(
      { error: "File type not allowed. Accepted: JPEG, PNG, WebP, GIF, HEIC, HEIF" },
      { status: 400 }
    );
  } else {
    const EXT_MAP: Record<string, string> = { jpeg: "jpg" };
    const rawExt = file.type.split("/")[1];
    ext = EXT_MAP[rawExt] ?? rawExt;
  }

  const fileName = `${user.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(fileName, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-images").getPublicUrl(fileName);

  return NextResponse.json({ url: publicUrl });
}
