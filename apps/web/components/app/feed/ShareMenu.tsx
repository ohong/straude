"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Share2, Link2, Image, Download, Check } from "lucide-react";
import { SHARE_THEMES, type ShareThemeId } from "@/lib/share-themes";

const THEME_SWATCH: Record<ShareThemeId, string> = {
  light: "#FFFFFF",
  dark: "#0A0A0A",
  accent: "linear-gradient(135deg, #FF8C42, #FFF275, #FF6B6B)",
};

export function ShareMenu({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ShareThemeId>("light");
  const [generating, setGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const fetchBlob = useCallback(async () => {
    const res = await fetch(
      `/api/posts/${postId}/share-image?theme=${theme}`
    );
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return res.blob();
  }, [postId, theme]);

  async function handleCopyLink() {
    const url = `${window.location.origin}/post/${postId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleCopyImage() {
    setGenerating(true);
    try {
      const blob = await fetchBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.error("Copy image failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const blob = await fetchBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `straude-${postId.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  const supportsClipboardItem = typeof window !== "undefined" && typeof ClipboardItem !== "undefined";

  return (
    <div ref={menuRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold hover:text-accent"
      >
        Share <Share2 size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 z-20 mb-2 w-52 rounded-lg border border-border bg-background shadow-lg"
          role="menu"
        >
          {/* Theme swatches */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <span className="text-xs font-medium text-muted">Theme</span>
            <div className="ml-auto flex gap-1.5">
              {SHARE_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className="rounded-full"
                  style={{
                    width: 24,
                    height: 24,
                    background: THEME_SWATCH[t.id],
                    border:
                      theme === t.id
                        ? "2px solid #DF561F"
                        : "2px solid var(--color-border)",
                  }}
                  title={t.label}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-subtle"
              role="menuitem"
            >
              {copiedLink ? (
                <Check size={15} className="text-accent" />
              ) : (
                <Link2 size={15} className="text-muted" />
              )}
              {copiedLink ? "Copied!" : "Copy Link"}
            </button>

            {supportsClipboardItem && (
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={generating}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-subtle disabled:opacity-50"
                role="menuitem"
              >
                {copiedImage ? (
                  <Check size={15} className="text-accent" />
                ) : (
                  <Image size={15} className="text-muted" />
                )}
                {generating
                  ? "Generating..."
                  : copiedImage
                    ? "Copied!"
                    : "Copy Image"}
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={generating}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-subtle disabled:opacity-50"
              role="menuitem"
            >
              <Download size={15} className="text-muted" />
              {generating ? "Generating..." : "Download PNG"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
