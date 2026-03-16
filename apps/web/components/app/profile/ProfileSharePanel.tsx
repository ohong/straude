"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, ExternalLink, ImageIcon } from "lucide-react";
import {
  buildProfileIntentUrl,
  buildProfileShareUrl,
} from "@/lib/utils/profile-share";

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
  const [busy, setBusy] = useState<"share-x" | "copy-image" | "download" | null>(null);
  const [copied, setCopied] = useState<"image" | null>(null);
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
      shareUrlOverride ?? buildProfileShareUrl(window.location.origin, username)
    );
    setSupportsClipboardImage(
      typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard?.write === "function"
    );
  }, [shareUrlOverride, username]);

  async function shareOnX() {
    if (!isPublic) return;

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

    window.open(
      buildProfileIntentUrl(window.location.origin, username),
      "_blank",
      "noopener,noreferrer"
    );

    if (imageCopied) {
      setCopied("image");
      setFeedback("Opened X and copied the card. Paste it into the composer.");
      window.setTimeout(() => setCopied(null), 2000);
    } else {
      setFeedback("Opened X with the text and link. Add the image manually if needed.");
    }

    setBusy(null);
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
    <div className="mt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
            Share Your Consistency Card
          </p>
        </div>
        {!isPublic && isOwner && (
          <p className="text-xs text-muted">
            Your profile is private, so only the PNG preview/download is enabled.
          </p>
        )}
      </div>

      <div className="mt-4 max-w-[620px] overflow-hidden rounded-[24px] border border-border bg-background shadow-sm">
        <Image
          src={imageUrl}
          alt={`@${username}'s consistency card`}
          width={1200}
          height={630}
          unoptimized
          className="block h-auto w-full"
        />
      </div>

      <div className="mt-4 inline-flex max-w-full flex-col gap-2 px-1 py-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
          Share URL
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="max-w-full overflow-x-auto whitespace-nowrap rounded-xl bg-subtle px-3 py-2 text-sm text-foreground">
            {isPublic && publicUrl
              ? publicUrl
              : "Make your profile public to unlock a shareable URL."}
          </code>
          <button
            type="button"
            onClick={shareOnX}
            disabled={!isPublic || busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
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
  );
}
