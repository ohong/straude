"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Sparkles, Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
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
  const fileRef = useRef<HTMLInputElement>(null);

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

    const remaining = 4 - images.length;
    const toUpload = Array.from(files).slice(0, remaining);

    for (const file of toUpload) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        const { url } = await res.json();
        setImages((prev) => [...prev, url]);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  if (!editing) {
    return (
      <div className="flex justify-end gap-2 px-6 py-3 border-b border-dashed border-muted/30">
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
    <div className="border-b border-border px-6 py-4">
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
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you built..."
          maxLength={500}
        />

        {/* Image uploads */}
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={i} className="relative">
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded object-cover border border-border"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-xs"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {images.length < 4 && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} className="mr-1.5" />
                Add images
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
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
