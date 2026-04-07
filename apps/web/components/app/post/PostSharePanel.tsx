"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Download, ImageIcon } from "lucide-react";
import { buildPostIntentUrl } from "@/lib/utils/post-share";

type ShareablePost = {
  id: string;
  title: string | null;
  images: string[];
  user?: { username: string | null } | null;
  daily_usage?: {
    cost_usd: number;
    output_tokens: number;
    models: string[];
    is_verified: boolean;
  } | null;
};

export function PostSharePanel({
  postId,
  sharePost,
  shareUrlOverride,
  imageUrlOverride,
}: {
  postId: string;
  sharePost: ShareablePost;
  shareUrlOverride?: string;
  imageUrlOverride?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"share-x" | "copy-image" | "download" | null>(null);
  const [copied, setCopied] = useState<"image" | "link" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [supportsClipboardImage, setSupportsClipboardImage] = useState(false);
  const imageUrl = useMemo(
    () => imageUrlOverride ?? `/api/posts/${postId}/share-image?theme=accent`,
    [imageUrlOverride, postId]
  );

  useEffect(() => {
    setShareUrl(
      shareUrlOverride ??
        new URL(`/post/${postId}`, window.location.origin).toString()
    );
    setSupportsClipboardImage(
      typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard?.write === "function"
    );
  }, [postId, shareUrlOverride]);

  async function copyImage() {
    setBusy("copy-image");
    setFeedback(null);

    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied("image");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback("Could not copy the post image. Try Download PNG.");
    } finally {
      setBusy(null);
    }
  }

  async function shareOnX() {
    setBusy("share-x");
    setFeedback(null);

    let imageCopied = false;

    try {
      if (supportsClipboardImage) {
        const response = await fetch(imageUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        imageCopied = true;
      }
    } catch {
      imageCopied = false;
    }

    const intentUrl = buildPostIntentUrl(
      {
        id: sharePost.id,
        title: sharePost.title,
        images: sharePost.images,
        user: sharePost.user ?? null,
        daily_usage: sharePost.daily_usage ?? null,
      },
      window.location.origin
    );

    window.open(intentUrl, "_blank", "noopener,noreferrer");

    if (imageCopied) {
      setCopied("image");
      window.setTimeout(() => setCopied(null), 2000);
    }

    setBusy(null);
  }

  async function downloadImage() {
    setBusy("download");
    setFeedback(null);

    try {
      const response = await fetch(imageUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `straude-${postId.slice(0, 8)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setFeedback("Could not generate the session card PNG.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border-b border-border px-4 py-5 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
          Share This Session
        </span>
        <ChevronDown
          size={16}
          className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-4">
          <div className="max-w-[520px] overflow-hidden rounded-[24px] border border-border bg-background shadow-sm">
            <Image
              src={imageUrl}
              alt="Generated session share card preview"
              width={1200}
              height={630}
              unoptimized
              className="block h-auto w-full"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied("link");
                  window.setTimeout(() => setCopied((c) => c === "link" ? null : c), 2000);
                } catch {
                  setFeedback("Could not copy the link.");
                }
              }}
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border px-3 py-2 text-sm hover:bg-subtle"
              aria-label="Copy permalink"
            >
              {copied === "link" ? <Check size={14} className="shrink-0 text-accent" aria-hidden /> : <Copy size={14} className="shrink-0" aria-hidden />}
              <span className="truncate text-muted">{shareUrl}</span>
            </button>
            <button
              type="button"
              onClick={shareOnX}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-border p-2.5 hover:bg-subtle disabled:opacity-60"
              aria-label="Share on X"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1200 1227" fill="currentColor" aria-hidden>
                <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {supportsClipboardImage && (
              <button
                type="button"
                onClick={copyImage}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle disabled:opacity-60"
              >
                {copied === "image" ? <Check size={16} aria-hidden /> : <ImageIcon size={16} aria-hidden />}
                {busy === "copy-image"
                  ? "Preparing..."
                  : copied === "image"
                    ? "Copied"
                    : "Copy PNG"}
              </button>
            )}

            <button
              type="button"
              onClick={downloadImage}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Download size={16} aria-hidden />
              {busy === "download" ? "Preparing..." : "Download PNG"}
            </button>
          </div>

          {feedback && (
            <p className="mt-3 text-sm text-muted">{feedback}</p>
          )}
        </div>
      )}
    </section>
  );
}
