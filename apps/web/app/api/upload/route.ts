import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
import convert from "heic-convert";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/octet-stream", // iOS sometimes sends HEIC with this MIME type
  "", // Some browsers may omit MIME for HEIC files
];
const HEIC_MIME_TYPES = ["image/heic", "image/heif"];

const DM_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
];

const VALID_BUCKETS = ["post-images", "dm-attachments"] as const;
type BucketId = (typeof VALID_BUCKETS)[number];

const BUCKET_CONFIG: Record<BucketId, { maxSize: number; allowedTypes: string[] }> = {
  "post-images": {
    maxSize: 20 * 1024 * 1024,
    allowedTypes: IMAGE_TYPES,
  },
  "dm-attachments": {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: [...IMAGE_TYPES, ...DM_FILE_TYPES],
  },
};

// HEIC/HEIF files contain an "ftyp" box at offset 4 with one of these brands
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];
type HeicConverter = (opts: {
  buffer: Uint8Array;
  format: "JPEG";
  quality: number;
}) => Promise<ArrayBuffer | Uint8Array>;

/** Detect HEIC/HEIF by magic bytes — more reliable than MIME type. */
function isHeicByMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ftyp = buf.toString("ascii", 4, 8);
  if (ftyp !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return HEIC_BRANDS.includes(brand);
}

function isImageType(mime: string): boolean {
  return mime.startsWith("image/") || mime === "application/octet-stream" || mime === "";
}

const EXT_MAP: Record<string, string> = {
  jpeg: "jpg",
  "x-zip-compressed": "zip",
  "vnd.ms-excel": "csv",
};

/** Map file extensions to MIME types for when the browser reports a generic type. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
};

/** Infer MIME type from file extension (case-insensitive). */
function mimeFromExtension(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? (EXT_TO_MIME[ext] ?? null) : null;
}

function getExtension(mimeType: string, fileName: string): string {
  // Try to get extension from the original filename
  const fileExt = fileName.split(".").pop()?.toLowerCase();
  if (fileExt && fileExt.length <= 5 && fileExt !== fileName.toLowerCase()) {
    return fileExt;
  }
  // Fall back to MIME type
  const rawExt = mimeType.split("/")[1] ?? "bin";
  return EXT_MAP[rawExt] ?? rawExt;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit("upload", user.id, { limit: 10 });
  if (limited) return limited;

  const bucketParam = request.nextUrl.searchParams.get("bucket") ?? "post-images";
  if (!VALID_BUCKETS.includes(bucketParam as BucketId)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  const bucket = bucketParam as BucketId;
  const config = BUCKET_CONFIG[bucket];

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > config.maxSize) {
    const maxMB = Math.round(config.maxSize / (1024 * 1024));
    return NextResponse.json(
      { error: `File too large. Maximum size is ${maxMB}MB` },
      { status: 400 }
    );
  }

  const browserMime = (file.type ?? "").toLowerCase();
  // When the browser reports a generic or empty MIME (common with uppercase
  // extensions like .HEIC, .PNG, etc.), infer the real type from the extension.
  const mimeType =
    !browserMime || browserMime === "application/octet-stream"
      ? (mimeFromExtension(file.name) ?? browserMime)
      : browserMime;
  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = mimeType;
  let ext: string;

  // Detect HEIC by magic bytes OR MIME type — iOS sometimes mislabels HEIC files
  const isHeic = HEIC_MIME_TYPES.includes(mimeType) || isHeicByMagicBytes(buffer);

  if (!config.allowedTypes.includes(mimeType) && !isHeic) {
    return NextResponse.json(
      { error: "File type not allowed" },
      { status: 400 }
    );
  }

  if (isHeic) {
    try {
      const jpegBuf = await (convert as unknown as HeicConverter)({ buffer, format: "JPEG", quality: 0.9 });
      buffer = ArrayBuffer.isView(jpegBuf)
        ? Buffer.from(jpegBuf.buffer, jpegBuf.byteOffset, jpegBuf.byteLength)
        : Buffer.from(jpegBuf);
    } catch {
      return NextResponse.json(
        { error: "Unable to process HEIC/HEIF image. Try re-exporting as JPEG and upload again." },
        { status: 400 }
      );
    }
    contentType = "image/jpeg";
    ext = "jpg";
  } else if (isImageType(mimeType)) {
    if (mimeType === "application/octet-stream" || mimeType === "") {
      // octet-stream that isn't HEIC — reject
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }
    const rawExt = mimeType.split("/")[1];
    ext = EXT_MAP[rawExt] ?? rawExt;
  } else {
    // Non-image file (only allowed for dm-attachments bucket)
    ext = getExtension(mimeType, file.name);
  }

  const fileName = `${user.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
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
  } = supabase.storage.from(bucket).getPublicUrl(fileName);

  if (bucket === "dm-attachments") {
    return NextResponse.json({
      bucket,
      path: fileName,
      name: file.name,
      type: contentType,
      size: buffer.length,
    });
  }

  return NextResponse.json({
    url: publicUrl,
    name: file.name,
    type: contentType,
    size: buffer.length,
  });
}
