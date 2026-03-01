"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, X, Sparkles, Upload, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionInput } from "@/components/app/shared/MentionInput";
import type { Post } from "@/types";

const MAX_DIMENSION = 2400;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — stay under Vercel's 4.5MB body limit

function createCompressionCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
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

/**
 * Compress an image client-side using Canvas API.
 * Resizes to MAX_DIMENSION on the longest side, then JPEG-compresses
 * to stay under MAX_BYTES. HEIC files on browsers that can't decode them
 * (non-Safari) are passed through as-is for server-side conversion.
 */
async function compressImage(file: File): Promise<File> {
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
  const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) {
    throw new Error("Failed to process image");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Binary search for the best quality that fits under MAX_BYTES
  let lo = 0.5, hi = 0.92;
  let blob = await canvasToJpegBlob(canvas, hi);

  if (blob.size <= MAX_BYTES) {
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
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
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function PostEditor({ post, autoEdit = false }: { post: Post; autoEdit?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(autoEdit);
  const [title, setTitle] = useState(post.title ?? "");
  const [description, setDescription] = useState(post.description ?? "");
  const [images, setImages] = useState<string[]>(post.images ?? []);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Restore draft from localStorage when entering edit mode
  useEffect(() => {
    if (!editing) return;
    const saved = localStorage.getItem(`straude_draft_${post.id}`);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.title !== undefined) setTitle(draft.title);
        if (draft.description !== undefined) setDescription(draft.description);
        if (draft.images !== undefined) setImages(draft.images);
      } catch {}
    }
  }, [editing, post.id]);

  // Debounce-save draft to localStorage while editing
  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`straude_draft_${post.id}`, JSON.stringify({ title, description, images }));
    }, 500);
    return () => clearTimeout(timer);
  }, [editing, title, description, images, post.id]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!editing) return;
    const isDirty = title !== (post.title ?? "") || description !== (post.description ?? "") || JSON.stringify(images) !== JSON.stringify(post.images ?? []);
    if (!isDirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, title, description, images, post.title, post.description, post.images]);

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      localStorage.removeItem(`straude_draft_${post.id}`);
      router.push("/feed");
    } else {
      setError("Failed to delete. Please try again.");
    }
    setDeleting(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || null,
        description: description || null,
        images,
      }),
    });
    if (res.ok) {
      localStorage.removeItem(`straude_draft_${post.id}`);
      setEditing(false);
      router.refresh();
    } else {
      setError("Failed to save. Please try again.");
    }
    setSaving(false);
  }

  async function handleGenerateCaption() {
    if (images.length === 0) return;
    setGenerating(true);
    const res = await fetch("/api/ai/generate-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        usage: post.daily_usage
          ? {
              costUSD: post.daily_usage.cost_usd,
              totalTokens: post.daily_usage.total_tokens,
              inputTokens: post.daily_usage.input_tokens,
              outputTokens: post.daily_usage.output_tokens,
              models: post.daily_usage.models,
              sessionCount: post.daily_usage.session_count,
            }
          : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setTitle(data.title);
      setDescription(data.description);
    }
    setGenerating(false);
  }

  async function uploadFiles(files: File[]) {
    const remaining = 10 - images.length - uploadingCount;
    if (remaining <= 0) return;
    const toUpload = files.slice(0, remaining);

    setError(null);
    setUploadingCount((c) => c + toUpload.length);

    await Promise.all(
      toUpload.map(async (file) => {
        try {
          const compressed = await compressImage(file);
          const form = new FormData();
          form.append("file", compressed);
          const res = await fetch("/api/upload", { method: "POST", body: form });
          if (res.ok) {
            const { url } = await res.json();
            setImages((prev) => [...prev, url]);
            return;
          }
          let message = "Image upload failed. Please try again.";
          try {
            const body = await res.json();
            if (typeof body?.error === "string" && body.error.trim().length > 0) {
              message = body.error;
            }
          } catch {}
          setError(message);
        } catch (err) {
          setError((err as Error).message || "Image upload failed. Please try again.");
        } finally {
          setUploadingCount((c) => c - 1);
        }
      })
    );
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await uploadFiles(Array.from(files));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (imageFiles.length === 0) return;
    e.preventDefault();
    await uploadFiles(imageFiles);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveImage(from: number, to: number) {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  if (!editing) {
    return (
      <div className="flex justify-end gap-2 px-4 py-3 border-b border-dashed border-muted/30 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil size={14} className="mr-1.5" />
          Edit post
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
          <Trash2 size={14} className="mr-1.5" />
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-4 py-4 sm:px-6" onPaste={handlePaste}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted">
          Edit Post
        </h3>
        <button onClick={() => setEditing(false)} className="text-muted hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Refactored the auth flow, Shipped dark mode, Debugged for 3 hours..."
          maxLength={100}
        />
        <MentionInput
          value={description}
          onChange={setDescription}
          placeholder="What did you build? Any breakthroughs, dead ends, or lessons learned? Drop screenshots above to show your work."
          maxLength={5000}
          multiline
          className="w-full border border-border px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Markdown supported — **bold**, *italic*, `code`, lists, and blockquotes
          </p>
          <p className={`text-xs tabular-nums ${description.length > 5000 ? "text-red-500 font-medium" : description.length > 4500 ? "text-amber-500" : "text-muted"}`}>
            {(5000 - description.length).toLocaleString()} chars remaining
          </p>
        </div>

        {/* Image uploads */}
        {(images.length > 0 || uploadingCount > 0) && (
          <div className="flex gap-2.5 flex-wrap">
            {images.map((url, i) => (
              <div
                key={url}
                className="relative group rounded"
                draggable
                onDragStart={(e) => {
                  dragIndexRef.current = i;
                  e.currentTarget.style.opacity = "0.4";
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => {
                  e.currentTarget.classList.add("ring-2", "ring-accent");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-2", "ring-accent");
                }}
                onDrop={(e) => {
                  e.currentTarget.classList.remove("ring-2", "ring-accent");
                  if (dragIndexRef.current !== null && dragIndexRef.current !== i) {
                    moveImage(dragIndexRef.current, i);
                  }
                  dragIndexRef.current = null;
                }}
              >
                <Image
                  src={url}
                  alt=""
                  width={112}
                  height={112}
                  className="h-28 w-28 rounded object-cover border border-border cursor-grab active:cursor-grabbing"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-xs"
                >
                  <X size={12} />
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(i, i - 1)}
                    className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronLeft size={12} />
                  </button>
                )}
                {i < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(i, i + 1)}
                    className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: uploadingCount }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-28 w-28 rounded border border-border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {images.length + uploadingCount < 10 && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingCount > 0}
              >
                {uploadingCount > 0 ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <Upload size={14} className="mr-1.5" />
                )}
                {uploadingCount > 0 ? `Uploading ${uploadingCount}...` : "Add images"}
              </Button>
              <span className="text-xs text-muted">or paste from clipboard</span>
            </>
          )}
          {images.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateCaption}
              disabled={generating}
            >
              {generating ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Sparkles size={14} className="mr-1.5" />
              )}
              {generating ? "Generating..." : "Generate caption"}
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || description.length > 5000}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
