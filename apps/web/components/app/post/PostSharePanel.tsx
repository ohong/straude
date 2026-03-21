"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, ExternalLink, ImageIcon } from "lucide-react";
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
  const [busy, setBusy] = useState<"share-x" | "copy-image" | "download" | null>(null);
  const [copied, setCopied] = useState<"image" | null>(null);
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
      setFeedback("Session card copied. Paste it directly into your post.");
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
      setFeedback("Opened X and copied the image. Paste it into the composer.");
      window.setTimeout(() => setCopied(null), 2000);
    } else {
      setFeedback("Opened X with the text and link. Add the image manually if needed.");
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
      setFeedback("Session card downloaded.");
    } catch {
      setFeedback("Could not generate the session card PNG.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border-b border-border px-4 py-5 sm:px-6">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
          Share This Session
        </p>

        <div className="mt-4 max-w-[520px] overflow-hidden rounded-[24px] border border-border bg-background shadow-sm">
          <Image
            src={imageUrl}
            alt="Generated session share card preview"
            width={1200}
            height={630}
            unoptimized
            className="block h-auto w-full"
          />
        </div>

        <div className="mt-4 inline-flex max-w-full flex-col gap-2 px-1 py-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
            Permalink
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="max-w-full overflow-x-auto whitespace-nowrap rounded-xl bg-subtle px-3 py-2 text-sm text-foreground">
              {shareUrl}
            </code>
            <button
              type="button"
              onClick={shareOnX}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle"
            >
              <ExternalLink size={16} aria-hidden />
              {busy === "share-x" ? "Preparing..." : "Share on X"}
            </button>
          </div>
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
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            <Download size={16} aria-hidden />
            {busy === "download" ? "Preparing..." : "Download PNG"}
          </button>
        </div>

        {feedback && (
          <p className="mt-3 text-sm text-muted">{feedback}</p>
        )}
      </div>
    </section>
  );
}
