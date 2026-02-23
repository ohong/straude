"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, Download, Check } from "lucide-react";
import { RecapCard } from "@/components/app/recap/RecapCard";
import type { RecapData } from "@/lib/utils/recap";
import {
  RECAP_BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  type RecapBackgroundId,
} from "@/lib/recap-backgrounds";

export default function RecapPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [backgroundId, setBackgroundId] =
    useState<RecapBackgroundId>(DEFAULT_BACKGROUND_ID);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/recap?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [period]);

  const handleCopyLink = useCallback(async () => {
    if (!data) return;
    const url = `https://straude.com/recap/${data.username}?period=${period}&bg=${backgroundId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data, period, backgroundId]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/recap/image?period=${period}&format=square&bg=${backgroundId}`
      );
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `straude-recap-${period}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [period, backgroundId]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Recap</h3>
      </header>

      <div className="p-6">
        {/* Period selector */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setPeriod("week")}
            className={`border px-4 py-1.5 text-sm font-semibold ${
              period === "week"
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-subtle"
            }`}
            style={{ borderRadius: 4 }}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`border px-4 py-1.5 text-sm font-semibold ${
              period === "month"
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-subtle"
            }`}
            style={{ borderRadius: 4 }}
          >
            This Month
          </button>
        </div>

        {/* Background selector */}
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
            Background
          </p>
          <div className="flex flex-wrap gap-2">
            {RECAP_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => setBackgroundId(bg.id)}
                className="overflow-hidden"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  border:
                    backgroundId === bg.id
                      ? "2px solid #DF561F"
                      : "2px solid transparent",
                  padding: 0,
                }}
                title={bg.label}
              >
                <div
                  className="h-full w-full"
                  style={{ background: bg.css }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Card preview */}
        {loading ? (
          <div
            className="animate-pulse bg-subtle"
            style={{ height: 380, borderRadius: 8 }}
          />
        ) : data ? (
          <>
            <RecapCard data={data} backgroundId={backgroundId} />

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCopyLink}
                disabled={!data.is_public}
                className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: 4 }}
                title={
                  data.is_public
                    ? "Copy shareable link"
                    : "Set your profile to public to share"
                }
              >
                {copied ? (
                  <>
                    <Check size={14} aria-hidden /> Copied!
                  </>
                ) : (
                  <>
                    <Link2 size={14} aria-hidden /> Copy Link
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
                style={{ borderRadius: 4 }}
              >
                <Download size={14} aria-hidden />
                {downloading ? "Generating..." : "Download Card"}
              </button>
            </div>

            {!data.is_public && (
              <p className="mt-3 text-xs text-muted">
                Your profile is private. The shareable link won't work for
                others until you{" "}
                <a href="/settings" className="text-accent hover:underline">
                  make your profile public
                </a>
                .
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Failed to load recap data.</p>
        )}
      </div>
    </>
  );
}
