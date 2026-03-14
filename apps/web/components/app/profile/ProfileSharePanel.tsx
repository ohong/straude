"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, ImageIcon, Link2 } from "lucide-react";

export function ProfileSharePanel({
  username,
  isPublic,
  isOwner,
  shareUrlOverride,
  imageUrlOverride,
  downloadUrlOverride,
}: {
  username: string;
  isPublic: boolean;
  isOwner: boolean;
  shareUrlOverride?: string;
  imageUrlOverride?: string;
  downloadUrlOverride?: string;
}) {
  const [busy, setBusy] = useState<"copy-image" | "download" | null>(null);
  const [copied, setCopied] = useState<"link" | "image" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [supportsClipboardImage, setSupportsClipboardImage] = useState(false);
  const imageUrl = useMemo(
    () => imageUrlOverride ?? `/api/consistency/${username}/image`,
    [imageUrlOverride, username]
  );
  const downloadUrl = useMemo(
    () => downloadUrlOverride ?? `${imageUrl}?download=1`,
    [downloadUrlOverride, imageUrl]
  );

  useEffect(() => {
    setPublicUrl(
      shareUrlOverride ??
        new URL(`/consistency/${username}`, window.location.origin).toString()
    );
    setSupportsClipboardImage(
      typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard?.write === "function"
    );
  }, [shareUrlOverride, username]);

  async function copyLink() {
    if (!isPublic) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied("link");
      setFeedback("Consistency link copied.");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback("Could not copy the consistency link on this browser.");
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
      setFeedback("Consistency card copied. Paste it straight into your post.");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback("Could not copy the consistency image. Try Download PNG.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadImage() {
    setBusy("download");
    setFeedback(null);

    try {
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `straude-consistency-${username}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setFeedback("Consistency card downloaded.");
    } catch {
      setFeedback("Could not generate the consistency card PNG.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 rounded-[24px] border border-border bg-subtle/30 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
            Share Your Consistency Card
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            A public, tweetable heatmap card for the last 52 weeks of grind.
            The heatmap stays the hero; the stats stay sharp.
          </p>
        </div>
        {!isPublic && isOwner && (
          <p className="text-xs text-muted">
            Your profile is private, so only the PNG preview/download is enabled.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-[18px] border border-border bg-background px-4 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
          Share URL
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl bg-subtle px-3 py-2 text-sm text-foreground">
            {isPublic && publicUrl
              ? publicUrl
              : "Make your profile public to unlock a shareable URL."}
          </code>
          <button
            type="button"
            onClick={copyLink}
            disabled={!isPublic}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied === "link" ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
            {copied === "link" ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-border bg-background shadow-sm">
        <Image
          src={imageUrl}
          alt={`@${username}'s consistency card`}
          width={1200}
          height={630}
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
  );
}
