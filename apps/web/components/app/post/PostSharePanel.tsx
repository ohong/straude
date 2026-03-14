"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, ImageIcon, Link2 } from "lucide-react";

export function PostSharePanel({
  postId,
  shareUrlOverride,
  imageUrlOverride,
}: {
  postId: string;
  shareUrlOverride?: string;
  imageUrlOverride?: string;
}) {
  const [busy, setBusy] = useState<"copy-image" | "download" | null>(null);
  const [copied, setCopied] = useState<"link" | "image" | null>(null);
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("link");
      setFeedback("Post link copied.");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback("Could not copy the post link on this browser.");
    }
  }

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
      <div className="rounded-[24px] border border-border bg-subtle/30 p-4 sm:p-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
          Share This Session
        </p>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The post permalink is the share target. The image below is the
          generated session card people can repost without screenshotting the
          app.
        </p>

        <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
            Permalink
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl bg-subtle px-3 py-2 text-sm text-foreground">
              {shareUrl}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle"
            >
              {copied === "link" ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
              {copied === "link" ? "Copied" : "Copy URL"}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[24px] border border-border bg-background shadow-sm">
          <Image
            src={imageUrl}
            alt="Generated session share card preview"
            width={1080}
            height={1080}
            unoptimized
            className="block h-auto w-full"
          />
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
