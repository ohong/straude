/**
 * Client-side image compression utility.
 *
 * Resizes to MAX_DIMENSION on the longest side, then JPEG-compresses
 * via binary search to stay under MAX_BYTES. HEIC files are converted
 * to JPEG client-side via heic2any (WASM) so they can be compressed
 * before uploading, avoiding Vercel's 4.5MB body limit.
 */

const MAX_DIMENSION = 2400;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — stay under Vercel's 4.5MB body limit

const HEIC_MIME_TYPES = ["image/heic", "image/heif"];
const HEIC_EXTENSIONS = ["heic", "heif"];

function isHeicFile(file: File): boolean {
  if (HEIC_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return !!ext && HEIC_EXTENSIONS.includes(ext);
}

function createCompressionCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToJpegBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to process image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Convert a HEIC/HEIF file to a JPEG Blob using heic2any (WASM). */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(result) ? result[0] : result;
}

async function compressBitmap(bitmap: ImageBitmap, fileName: string): Promise<File> {
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = createCompressionCanvas(width, height);
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) {
    throw new Error("Failed to process image");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Binary search for the best quality that fits under MAX_BYTES
  let lo = 0.5,
    hi = 0.92;
  let blob = await canvasToJpegBlob(canvas, hi);

  if (blob.size <= MAX_BYTES) {
    return new File([blob], fileName, { type: "image/jpeg" });
  }

  for (let i = 0; i < 4 && hi - lo > 0.05; i++) {
    const mid = (lo + hi) / 2;
    blob = await canvasToJpegBlob(canvas, mid);
    if (blob.size <= MAX_BYTES) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  blob = await canvasToJpegBlob(canvas, lo);
  return new File([blob], fileName, { type: "image/jpeg" });
}

export async function compressImage(file: File): Promise<File> {
  // Skip compression for small files and GIFs (preserve animation)
  if (file.size <= MAX_BYTES || file.type === "image/gif") return file;

  const jpgName = file.name.replace(/\.[^.]+$/, ".jpg");

  // Try native decoding first (works for most formats, including HEIC on Safari)
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (bitmap) {
    return compressBitmap(bitmap, jpgName);
  }

  // Native decode failed — for HEIC files, use heic2any WASM fallback
  if (isHeicFile(file)) {
    const jpegBlob = await convertHeicToJpeg(file);
    const fallbackBitmap = await createImageBitmap(jpegBlob);
    return compressBitmap(fallbackBitmap, jpgName);
  }

  // Unknown format the browser can't decode — send as-is
  return file;
}
