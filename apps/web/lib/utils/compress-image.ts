/**
 * Client-side image compression utility.
 *
 * Resizes to MAX_DIMENSION on the longest side, then JPEG-compresses
 * via binary search to stay under MAX_BYTES. HEIC files on browsers
 * that can't decode them (non-Safari) are passed through as-is for
 * server-side conversion.
 */

const MAX_DIMENSION = 2400;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — stay under Vercel's 4.5MB body limit

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

export async function compressImage(file: File): Promise<File> {
  // Skip compression for small files and GIFs (preserve animation)
  if (file.size <= MAX_BYTES || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Browser can't decode (likely HEIC on Chrome) — send to server as-is
    return file;
  }

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
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
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
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
