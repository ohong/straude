"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Download, Check } from "lucide-react";
import { RecapCard } from "@/components/app/recap/RecapCard";
import type { PersonalWeeklyReview } from "@/lib/utils/personal-review";
import type { RecapData } from "@/lib/utils/recap";
import {
  RECAP_BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  type RecapBackgroundId,
} from "@/lib/recap-backgrounds";


const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function PersonalWeekReview({ review }: { review: PersonalWeeklyReview | null | undefined }) {
  if (!review) return <p role="status" className="mb-6 text-sm text-muted">Weekly comparison is unavailable. Refresh to try again.</p>;
  const delta = review.current.estimated_value_usd - review.previous.estimated_value_usd;
  return (
    <section aria-labelledby="personal-week-heading" className="mb-8 border border-border p-4 sm:p-6">
      <h2 id="personal-week-heading" className="text-lg font-semibold">Your personal week</h2>
      <p className="mt-1 text-sm text-muted">{review.start}–{review.end} · UTC date boundaries · Week in progress, including today’s partial usage.</p>
      <p className="mt-3 text-sm">Estimated value at API prices. Actual billed charges are unknown. Private workspace contributions appear in your workspace report.</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Estimated value at API prices</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(review.current.estimated_value_usd)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Output tokens</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{review.current.output_tokens.toLocaleString("en-US")}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm">
        {review.previous.received_days > 0
          ? `${delta > 0 ? "+" : ""}${money(delta)} versus ${money(review.previous.estimated_value_usd)} across the same weekdays last week (${review.previous_start}–${review.previous_end}).`
          : "No data received for the same weekdays last week; a change cannot be calculated."}
      </p>
      <p className="mt-2 text-xs text-muted">Data received for {review.current.received_days} days this week and {review.previous.received_days} comparable days last week. Days without submissions are unknown, not confirmed zero usage. Changes may reflect sync coverage.</p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        {([
          ["Tool mix", review.tools, review.tool_unattributed_usd],
          ["Model mix", review.models, review.model_unattributed_usd],
        ] as const).map(([label, entries, unattributed]) => (
          <div key={label}>
            <h3 className="text-sm font-semibold">{label} · estimated value</h3>
            {entries.length === 0 ? <p className="mt-2 text-sm text-muted">No breakdown received.</p> : (
              <dl className="mt-2 divide-y divide-border">
                {entries.map((entry) => (
                  <div key={entry.name} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                    <dt className="min-w-0 break-words">{entry.name}</dt>
                    <dd className="shrink-0 tabular-nums">{money(entry.estimated_value_usd)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {Math.abs(unattributed) >= 0.005 && <p className="mt-2 text-xs text-muted">{unattributed > 0 ? `${money(unattributed)} has no recorded attribution.` : "Breakdown and recorded total differ; attribution is incomplete."}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecapPage({
  initialData,
  initialError = null,
}: {
  initialData: RecapData | null;
  initialError?: string | null;
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<RecapData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const initialRender = useRef(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [backgroundId, setBackgroundId] =
    useState<RecapBackgroundId>(DEFAULT_BACKGROUND_ID);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    let cancelled = false;

    async function loadRecap() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/recap?period=${period}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Failed to load recap data.",
          );
        }

        if (!cancelled) {
          setData(payload as RecapData);
        }
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load recap data.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecap();

    return () => {
      cancelled = true;
    };
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
    setDownloadError(null);
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
      setDownloadError("Failed to generate image. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [period, backgroundId]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h1 className="text-lg font-medium">Personal recap</h1>
        <a href="/workspaces" className="ml-auto text-sm font-semibold text-accent hover:underline">Private workspaces</a>
      </header>

      <div className="p-6">
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setPeriod("week")}
            aria-pressed={period === "week"}
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
            aria-pressed={period === "month"}
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

        {loading ? (
          <div
            className="animate-pulse bg-subtle"
            style={{ height: 380, borderRadius: 8 }}
          />
        ) : error ? (
          <p className="text-sm text-muted">{error}</p>
        ) : data ? (
          <>
            {period === "week" && <PersonalWeekReview review={data.personal_review} />}
            <RecapCard data={data} backgroundId={backgroundId} />

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

            {downloadError && (
              <div role="alert" className="mt-3 flex items-center gap-2 text-sm text-error">
                <span>{downloadError}</span>
                <button
                  onClick={handleDownload}
                  className="font-semibold underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            )}

            {!data.is_public && (
              <p className="mt-3 text-xs text-muted">
                Your profile is private. The shareable link will not work for
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
