import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const HEIC_TYPES = ["image/heic", "image/heif"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

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

  // Convert HEIC/HEIF to JPEG since browsers can't render them
  if (HEIC_TYPES.includes(file.type)) {
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    contentType = "image/jpeg";
    ext = "jpg";
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
