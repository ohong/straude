"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface ImportResult {
  date: string;
  usage_id: string;
  post_id: string;
  post_url: string;
}

export default function ImportPage() {
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText("npx straude@latest");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("Invalid JSON. Please paste the output of: ccusage daily --json");
      setLoading(false);
      return;
    }

    const obj = parsed as { type?: string; data?: unknown[] };
    if (obj.type !== "daily" || !Array.isArray(obj.data)) {
      setError(
        'Expected ccusage output with { "type": "daily", "data": [...] }. Make sure you run: ccusage daily --json',
      );
      setLoading(false);
      return;
    }

    const entries = (obj.data as Record<string, unknown>[]).map((d) => ({
      date: d.date as string,
      data: {
        date: d.date as string,
        models: (d.models as string[]) ?? [],
        inputTokens: (d.inputTokens as number) ?? 0,
        outputTokens: (d.outputTokens as number) ?? 0,
        cacheCreationTokens: (d.cacheCreationTokens as number) ?? 0,
        cacheReadTokens: (d.cacheReadTokens as number) ?? 0,
        totalTokens: (d.totalTokens as number) ?? 0,
        costUSD: (d.costUSD as number) ?? 0,
      },
    }));

    const res = await fetch("/api/usage/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, source: "web" }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Import failed");
    } else {
      const body = await res.json();
      setResults(body.results);
    }
    setLoading(false);
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Import Usage Data</h3>
      </header>

      <div className="mx-auto max-w-lg px-6 py-8">
        <div className="mb-6 border border-border bg-subtle p-4">
          <p className="text-sm font-medium">Recommended: sync via the CLI</p>
          <div className="mt-2 flex items-center justify-between rounded bg-foreground/5 px-3 py-2">
            <pre className="font-mono text-sm">npx straude@latest</pre>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-2 shrink-0 text-muted transition-colors hover:text-foreground"
              aria-label="Copy command"
            >
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            One command to login, sync your stats, and post to your feed. CLI posts are verified and count towards the leaderboard.
          </p>
        </div>

        <div className="mb-6 border-l-2 border-l-border bg-subtle p-4">
          <p className="text-sm font-medium">Alternative: paste JSON manually</p>
          <p className="mt-1 text-xs text-muted">
            Run <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">ccusage daily --json --since YYYYMMDD --until YYYYMMDD</code> and paste the output below. Manual imports are unverified and won&apos;t count towards the leaderboard &mdash; they only post to your feed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"type":"daily","data":[...],"summary":{...}}'
            rows={12}
            className="font-mono text-sm"
          />

          {error && <p className="text-sm text-error">{error}</p>}

          {results && (
            <div className="border border-border p-4">
              <p className="text-sm font-medium">
                Imported {results.length} {results.length === 1 ? "day" : "days"} of data.
              </p>
              <ul className="mt-2 space-y-1">
                {results.map((r) => (
                  <li key={r.date} className="text-xs text-muted">
                    {r.date} &mdash;{" "}
                    <a href={r.post_url} className="text-accent hover:underline">
                      View post
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" disabled={loading || !json.trim()} className="w-full py-3">
            {loading ? "Importing..." : "Import Data"}
          </Button>
        </form>
      </div>
    </>
  );
}
