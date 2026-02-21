"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, Download, Check } from "lucide-react";
import { RecapCard } from "@/components/app/recap/RecapCard";
import type { RecapData } from "@/lib/utils/recap";

export default function RecapPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/recap?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [period]);

  const handleCopyLink = useCallback(async () => {
    if (!data) return;
    const url = `https://straude.com/recap/${data.username}?period=${period}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data, period]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/recap/image?period=${period}&format=square`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `straude-recap-${period}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [period]);

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

        {/* Card preview */}
        {loading ? (
          <div
            className="animate-pulse bg-subtle"
            style={{ height: 380, borderRadius: 8 }}
          />
        ) : data ? (
          <>
            <RecapCard data={data} />

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
                {downloading ? "Generating…" : "Download Card"}
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
