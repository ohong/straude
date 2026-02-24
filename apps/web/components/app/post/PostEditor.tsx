"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, X, Sparkles, Upload, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MentionInput } from "@/components/app/shared/MentionInput";
import type { Post } from "@/types";

export function PostEditor({ post }: { post: Post }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title ?? "");
  const [description, setDescription] = useState(post.description ?? "");
  const [images, setImages] = useState<string[]>(post.images ?? []);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/feed");
    }
    setDeleting(false);
  }

  async function handleSave() {
    setSaving(true);
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
      setEditing(false);
      window.location.reload();
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const remaining = 10 - images.length - uploadingCount;
    if (remaining <= 0) return;
    const toUpload = Array.from(files).slice(0, remaining);

    setUploadingCount((c) => c + toUpload.length);

    await Promise.all(
      toUpload.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: form });
          if (res.ok) {
            const { url } = await res.json();
            setImages((prev) => [...prev, url]);
          }
        } finally {
          setUploadingCount((c) => c - 1);
        }
      })
    );

    if (fileRef.current) fileRef.current.value = "";
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
    <div className="border-b border-border px-4 py-4 sm:px-6">
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
          placeholder="Post title (optional)"
          maxLength={100}
        />
        <MentionInput
          value={description}
          onChange={setDescription}
          placeholder="Describe what you built, @ to mention"
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
