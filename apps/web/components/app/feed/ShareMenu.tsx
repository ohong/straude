"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Share2,
  Link2,
  Image as ImageIcon,
  Download,
  Check,
  Send,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { cn } from "@/lib/utils/cn";
import { buildInviteUrl, buildShareMoment } from "@/lib/share-moments";
import { ShareCardImage } from "@/lib/utils/share-image";
import {
  buildPostIntentUrl,
  buildPostShareText,
  buildPostShareUrl,
  getPostShareFilename,
} from "@/lib/utils/post-share";
import { SHARE_THEMES, type ShareThemeId } from "@/lib/share-themes";
import type { Post } from "@/types";

const PREVIEW_SIZE = 248;
const PREVIEW_SCALE = PREVIEW_SIZE / 1080;

const THEME_SWATCH: Record<ShareThemeId, string> = {
  light: "linear-gradient(135deg, #FFFFFF 0%, #F6F0E6 100%)",
  dark: "linear-gradient(135deg, #0A0A0A 0%, #2B2B31 100%)",
  accent: "linear-gradient(135deg, #F7BF5B 0%, #F28F3B 48%, #F7E1B5 100%)",
};

type BusyAction = "share" | "copy-image" | "download" | null;

export function ShareMenu({ post }: { post: Post }) {
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ShareThemeId>("accent");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [copiedAction, setCopiedAction] = useState<"link" | "image" | "invite" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const blobCacheRef = useRef<Partial<Record<ShareThemeId, Blob>>>({});

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const previewPost = {
    title: post.title,
    description: post.description,
    images: post.images ?? [],
    username: post.user?.username ?? "anonymous",
    avatar_url: post.user?.avatar_url ?? null,
    cost_usd: post.daily_usage?.cost_usd ?? null,
    input_tokens: post.daily_usage?.input_tokens ?? 0,
    output_tokens: post.daily_usage?.output_tokens ?? 0,
    models: post.daily_usage?.models ?? [],
    is_verified: post.daily_usage?.is_verified ?? false,
  };

  const shareText = buildPostShareText(post);
  const supportsClipboardText =
    typeof window !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function";
  const supportsClipboardImage =
    typeof window !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function";
  const supportsNativeShare =
    typeof window !== "undefined" && typeof navigator.share === "function";

  const shareMoment = buildShareMoment(post);

  function flashCopied(action: "link" | "image" | "invite") {
    setCopiedAction(action);
    window.setTimeout(() => {
      setCopiedAction((current) => (current === action ? null : current));
    }, 2000);
  }

  const fetchBlob = useCallback(
    async (selectedTheme: ShareThemeId = theme) => {
      const cached = blobCacheRef.current[selectedTheme];
      if (cached) return cached;

      const response = await fetch(
        `/api/posts/${post.id}/share-image?theme=${selectedTheme}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const blob = await response.blob();
      blobCacheRef.current[selectedTheme] = blob;
      return blob;
    },
    [post.id, theme]
  );

  async function handleCopyLink() {
    setFeedback(null);
    try {
      if (!supportsClipboardText) {
        throw new Error("Clipboard text unsupported");
      }

      const url = buildPostShareUrl(window.location.origin, post.id);
      await navigator.clipboard.writeText(url);
      flashCopied("link");
      posthog.capture("post_shared", { post_id: post.id, method: "copy_link", theme });
    } catch (error) {
      console.error("Copy link failed:", error);
      setFeedback({
        tone: "error",
        message: "Could not copy the link on this browser.",
      });
    }
  }

  async function handleCopyInvite() {
    setFeedback(null);
    try {
      if (!supportsClipboardText) {
        throw new Error("Clipboard text unsupported");
      }

      const url = buildInviteUrl(window.location.origin, post.user?.username);
      await navigator.clipboard.writeText(url);
      flashCopied("invite");
      posthog.capture("post_shared", { post_id: post.id, method: "copy_invite", theme });
    } catch (error) {
      console.error("Copy invite failed:", error);
      setFeedback({
        tone: "error",
        message: "Could not copy the invite link on this browser.",
      });
    }
  }

  async function handleCopyImage() {
    setBusyAction("copy-image");
    setFeedback(null);

    try {
      const blob = await fetchBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      flashCopied("image");
      posthog.capture("post_shared", { post_id: post.id, method: "copy_image", theme });
    } catch (error) {
      console.error("Copy image failed:", error);
      setFeedback({
        tone: "error",
        message: "Could not copy the share card. Try Download PNG instead.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownload() {
    setBusyAction("download");
    setFeedback(null);

    try {
      const blob = await fetchBlob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getPostShareFilename(post.id);
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      posthog.capture("post_shared", { post_id: post.id, method: "download_png", theme });
    } catch (error) {
      console.error("Download failed:", error);
      setFeedback({
        tone: "error",
        message: "Could not generate the PNG share card.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleNativeShare() {
    setBusyAction("share");
    setFeedback(null);

    try {
      const title = post.title?.trim() || "Straude session";
      const url = buildPostShareUrl(window.location.origin, post.id);
      const blob = await fetchBlob();

      if (typeof File !== "undefined") {
        const file = new File([blob], getPostShareFilename(post.id), {
          type: blob.type || "image/png",
        });

        if (
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            title,
            text: shareText,
            url,
            files: [file],
          });
          return;
        }
      }

      await navigator.share({ title, text: shareText, url });
      posthog.capture("post_shared", { post_id: post.id, method: "native", theme });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Native share failed:", error);
      setFeedback({
        tone: "error",
        message: "Could not open the native share sheet.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  function handleShareToX() {
    const intentUrl = buildPostIntentUrl(post, window.location.origin);
    window.open(intentUrl, "_blank", "noopener,noreferrer");
    posthog.capture("post_shared", { post_id: post.id, method: "x", theme });
  }

  const panelId = `share-panel-${post.id}`;

  return (
    <div ref={menuRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 text-sm font-semibold hover:text-accent"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
      >
        Share <Share2 size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute bottom-full right-0 z-20 mb-3 w-[22rem] rounded-md border border-border bg-background p-3 shadow-xl"
          aria-label="Share this post"
        >
          <div className="mb-3 rounded-md border border-accent/30 bg-accent/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                {shareMoment.label}
              </p>
              <span className="rounded-sm border border-accent/25 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-muted">
                Share angle
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {shareMoment.headline}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {shareMoment.detail}
            </p>
          </div>

          <div className="rounded-md border border-border bg-subtle/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Share Card
            </p>

            <div
              className="mx-auto mt-3 overflow-hidden rounded-md border border-border bg-background"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            >
              <div
                className="pointer-events-none"
                style={{
                  width: 1080,
                  height: 1080,
                  transform: `scale(${PREVIEW_SCALE})`,
                  transformOrigin: "top left",
                }}
              >
                <ShareCardImage post={previewPost} themeId={theme} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {SHARE_THEMES.map((shareTheme) => (
                <button
                  key={shareTheme.id}
                  type="button"
                  onClick={() => {
                    setTheme(shareTheme.id);
                    setFeedback(null);
                  }}
                  className={cn(
                    "rounded-md border px-2 py-2 text-left transition-colors",
                    theme === shareTheme.id
                      ? "border-accent bg-accent/5"
                      : "border-border bg-background hover:border-accent/40"
                  )}
                  aria-pressed={theme === shareTheme.id}
                  aria-label={`${shareTheme.label} theme`}
                >
                  <span
                    className="block h-8 rounded-sm border border-border/60"
                    style={{ background: THEME_SWATCH[shareTheme.id] }}
                  />
                  <span className="mt-2 block text-xs font-medium">
                    {shareTheme.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {supportsNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={busyAction !== null}
                className="col-span-2 flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Send size={16} aria-hidden="true" />
                {busyAction === "share" ? "Preparing share..." : "Share to apps"}
              </button>
            )}

            <button
              type="button"
              onClick={handleShareToX}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:border-accent/40 hover:text-accent"
              aria-label="Post to X"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1200 1227" fill="currentColor" aria-hidden="true">
                <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z" />
              </svg>
              Post to X
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:border-accent/40 hover:text-accent"
            >
              {copiedAction === "link" ? (
                <Check size={16} className="text-accent" aria-hidden="true" />
              ) : (
                <Link2 size={16} aria-hidden="true" />
              )}
              {copiedAction === "link" ? "Copied" : "Copy link"}
            </button>

            {supportsClipboardImage && (
              <button
                type="button"
              onClick={handleCopyImage}
              disabled={busyAction !== null}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:border-accent/40 hover:text-accent disabled:opacity-60"
              >
                {copiedAction === "image" ? (
                  <Check size={16} className="text-accent" aria-hidden="true" />
                ) : (
                  <ImageIcon size={16} aria-hidden="true" />
                )}
                {busyAction === "copy-image"
                  ? "Preparing..."
                  : copiedAction === "image"
                    ? "Copied"
                    : "Copy image"}
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={busyAction !== null}
              className={cn(
                "flex items-center gap-2 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:border-accent/40 hover:text-accent disabled:opacity-60",
                !supportsClipboardImage && "col-span-2"
              )}
            >
              <Download size={16} aria-hidden="true" />
              {busyAction === "download" ? "Preparing..." : "Download PNG"}
            </button>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="col-span-2 flex items-center justify-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-4 py-3 text-sm font-semibold text-foreground hover:border-accent/60"
            >
              {copiedAction === "invite" ? (
                <Check size={16} className="text-accent" aria-hidden="true" />
              ) : (
                <Link2 size={16} aria-hidden="true" />
              )}
              {copiedAction === "invite" ? "Invite copied" : shareMoment.inviteText}
            </button>
          </div>

          {feedback && (
            <div
              className={cn(
                "mt-3 rounded-md border px-3 py-2 text-sm",
                feedback.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-accent/20 bg-accent/5 text-foreground"
              )}
            >
              {feedback.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
