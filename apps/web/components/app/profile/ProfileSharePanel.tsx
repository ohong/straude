"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ImageIcon } from "lucide-react";
import { buildProfileIntentUrl } from "@/lib/utils/profile-share";

export function ProfileSharePanel({
  username,
  isPublic,
  isOwner,
  shareUrlOverride,
  imageUrlOverride,
  downloadUrlOverride,
  cacheVersion,
}: {
  username: string;
  isPublic: boolean;
  isOwner: boolean;
  shareUrlOverride?: string;
  imageUrlOverride?: string;
  downloadUrlOverride?: string;
  /** Fingerprint that changes when card data changes (e.g. usage count). */
  cacheVersion?: string;
}) {
  const [busy, setBusy] = useState<"share-x" | "copy-image" | "download" | null>(null);
  const [copied, setCopied] = useState<"image" | "link" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [supportsClipboardImage, setSupportsClipboardImage] = useState(false);
  const vParam = cacheVersion ? `?v=${cacheVersion}` : "";
  const imageUrl = useMemo(
    () => imageUrlOverride ?? `/api/stats/${username}/image${vParam}`,
    [imageUrlOverride, username, vParam]
  );
  const downloadUrl = useMemo(
    () => downloadUrlOverride ?? `/api/stats/${username}/image?download=1${cacheVersion ? `&v=${cacheVersion}` : ""}`,
    [downloadUrlOverride, username, cacheVersion]
  );

  useEffect(() => {
    setPublicUrl(
      shareUrlOverride ??
        new URL(`/stats/${username}`, window.location.origin).toString()
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
        const response = await fetch(imageUrl, {});
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
      window.setTimeout(() => setCopied(null), 2000);
    }

    setBusy(null);
  }

  async function copyImage() {
    setBusy("copy-image");
    setFeedback(null);

    try {
      const response = await fetch(imageUrl, {});
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
      setFeedback("Could not copy the image. Try downloading instead.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadImage() {
    setBusy("download");
    setFeedback(null);

    try {
      const response = await fetch(downloadUrl, {});
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `straude-stats-${username}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setFeedback("Could not generate the stats card.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
            Your Coding Rhythm
          </p>
        </div>
        {!isPublic && isOwner && (
          <p className="text-xs text-muted">
            Your profile is private, so only the PNG preview/download is enabled.
          </p>
        )}
      </div>

      <div className="mt-4 max-w-[480px] overflow-hidden rounded-[24px] border border-border bg-background shadow-sm">
        <Image
          src={imageUrl}
          alt={`@${username}'s stats card`}
          width={1200}
          height={630}
          unoptimized
          className="block h-auto w-full"
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!isPublic}
          onClick={async () => {
            if (!isPublic || !publicUrl) return;
            try {
              await navigator.clipboard.writeText(publicUrl);
              setCopied("link");
              window.setTimeout(() => setCopied((c) => c === "link" ? null : c), 2000);
            } catch {
              setFeedback("Could not copy the link.");
            }
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-border p-2.5 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Copy share URL"
        >
          {copied === "link" ? <Check size={14} className="text-accent" aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={shareOnX}
          disabled={!isPublic || busy !== null}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-border p-2.5 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Share on X"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1200 1227" fill="currentColor" aria-hidden>
            <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z" />
          </svg>
        </button>
        {supportsClipboardImage && (
          <button
            type="button"
            onClick={copyImage}
            disabled={busy !== null}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-border p-2.5 hover:bg-subtle disabled:opacity-60"
            aria-label="Copy PNG to clipboard"
          >
            {copied === "image" ? <Check size={14} className="text-accent" aria-hidden /> : <ImageIcon size={14} aria-hidden />}
          </button>
        )}
        <button
          type="button"
          onClick={downloadImage}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent p-2.5 text-accent-foreground hover:opacity-90 disabled:opacity-60"
          aria-label="Download PNG"
        >
          <Download size={14} aria-hidden />
        </button>
      </div>

      {feedback && (
        <p className="mt-3 text-sm text-muted">{feedback}</p>
      )}
    </div>
  );
}
