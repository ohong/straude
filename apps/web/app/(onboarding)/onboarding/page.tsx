"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BoltIcon } from "@/components/landing/icons";
import { Check, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { trackActivationEvent } from "@/lib/analytics/client";
import { formatCurrency } from "@/lib/utils/format";

const SYNC_COMMAND = "npx straude@latest";
const POLL_INTERVAL_MS = 4000;
const REQUEST_TIMEOUT_MS = 15_000;
const WAIT_TIMEOUT_MS = 5 * 60_000;

interface UsageStatus {
  has_data: boolean;
  has_usage?: boolean;
  cost_usd?: number;
  total_tokens?: number;
  session_count?: number;
  top_model?: string | null;
  latest_usage_id?: string;
  latest_usage_date?: string;
  latest_post_url?: string | null;
}

type SyncState =
  | { phase: "waiting" }
  | { phase: "confirming"; data: UsageStatus }
  | { phase: "success"; data: UsageStatus }
  | { phase: "error"; data?: UsageStatus; message: string; requiresLogin?: boolean };

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [sync, setSync] = useState<SyncState>({ phase: "waiting" });
  const [attempt, setAttempt] = useState(0);
  const commandCopiedRef = useRef(false);
  const confirmedUsageRef = useRef<UsageStatus | null>(null);
  const hasExistingUsageRef = useRef(false);
  const activationTrackedRef = useRef(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Profile details are optional and must never delay access to the sync command.
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    async function loadProfile() {
      try {
        const res = await fetch("/api/users/me", { signal: controller.signal });
        if (!res.ok) return;
        const profile = await res.json();
        if (!controller.signal.aborted && typeof profile.username === "string") {
          setUsername(profile.username);
        }
      } catch {
        // The feed and Settings remain available if this optional lookup fails.
      } finally {
        clearTimeout(timeout);
      }
    }
    void loadProfile();
    return () => {
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let pollTimeout: ReturnType<typeof setTimeout> | undefined;
    let requestTimeout: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const startedAt = Date.now();

    async function request(url: string, options?: RequestInit) {
      controller = new AbortController();
      requestTimeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        return { response, payload };
      } finally {
        clearTimeout(requestTimeout);
      }
    }

    async function checkUsage() {
      let observedUsage = confirmedUsageRef.current;
      try {
        if (!observedUsage) {
          const { response, payload } = await request("/api/usage/status");
          if (!active) return;
          if (!response.ok) {
            setSync({
              phase: "error",
              message: response.status === 401
                ? "Your sign-in expired. Sign in again, then return here to check your sync."
                : "We could not check your usage. Your terminal can keep syncing. Try checking again.",
              requiresLogin: response.status === 401,
            });
            return;
          }
          if (!(payload.has_usage ?? payload.has_data)) {
            if (Date.now() - startedAt >= WAIT_TIMEOUT_MS) {
              setSync({
                phase: "error",
                message: "No usage received yet. Check that the command finished in your terminal, then check again.",
              });
              return;
            }
            // Schedule only after the previous request finishes, so checks never overlap.
            pollTimeout = setTimeout(checkUsage, POLL_INTERVAL_MS);
            return;
          }
          observedUsage = payload as UsageStatus;
          confirmedUsageRef.current = observedUsage;
          hasExistingUsageRef.current = !commandCopiedRef.current;
        }

        setSync({ phase: "confirming", data: observedUsage });
        const { response, payload } = await request("/api/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onboarding_completed: true,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        if (!active) return;
        if (!response.ok) {
          setSync({
            phase: "error",
            data: observedUsage,
            message: response.status === 401
              ? "Your usage arrived, but your sign-in expired. Sign in again, then return here to finish setup."
              : typeof payload.error === "string"
                ? payload.error
                : "Your usage arrived, but we could not finish setup. Try again.",
            requiresLogin: response.status === 401,
          });
          return;
        }

        if (!activationTrackedRef.current) {
          activationTrackedRef.current = true;
          trackActivationEvent("activation_completed", {
            surface: "onboarding",
            activation_state: "activated",
            is_authenticated: true,
            session_count: observedUsage.session_count,
            total_tokens: observedUsage.total_tokens,
            total_cost_usd: observedUsage.cost_usd,
            has_existing_usage: hasExistingUsageRef.current,
            "$insert_id": observedUsage.latest_usage_id
              ? `activation_completed:${observedUsage.latest_usage_id}`
              : "activation_completed:onboarding",
          });
        }
        setSync({ phase: "success", data: observedUsage });
      } catch {
        if (!active) return;
        setSync({
          phase: "error",
          data: observedUsage ?? undefined,
          message: observedUsage
            ? "Your usage arrived, but we could not finish setup. Check your connection and try again."
            : "We could not check your usage. Check your connection and try again.",
        });
      }
    }

    void checkUsage();
    return () => {
      active = false;
      clearTimeout(pollTimeout);
      clearTimeout(requestTimeout);
      controller?.abort();
    };
  }, [attempt]);

  async function handleCopy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(SYNC_COMMAND);
      commandCopiedRef.current = true;
      trackActivationEvent("sync_command_copied", {
        surface: "onboarding",
        command: SYNC_COMMAND,
        activation_state: "sync_command_copied",
        is_authenticated: true,
      });
      setCopied(true);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  const data = "data" in sync ? sync.data : undefined;

  return (
    <>
      <div className="mb-8">
        <BoltIcon className="size-6 text-accent" />
      </div>

      <div className="flex items-center gap-2">
        {sync.phase === "success" && <Check size={20} className="text-accent" aria-hidden="true" />}
        <h1 className="text-balance text-2xl font-medium">
          {sync.phase === "success" ? "Your first sync is complete" : data ? "Your usage arrived" : "Sync your first session"}
        </h1>
      </div>
      <p className="mt-1 mb-6 text-pretty text-sm text-muted">
        {data
          ? "Your logged spend and tokens are ready. Keep syncing to build your history and streak."
          : "Run this command in the terminal on the computer where you use your coding agent. Sign in when prompted, then return here."}
      </p>

      {data ? (
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <dt className="text-xs text-muted">Logged spend</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">${formatCurrency(data.cost_usd)}</dd>
          </div>
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <dt className="text-xs text-muted">Logged tokens</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{formatTokens(data.total_tokens ?? 0)}</dd>
          </div>
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <dt className="text-xs text-muted">Latest usage model</dt>
            <dd className="mt-1 break-words text-sm font-medium">{data.top_model ?? "Not reported"}</dd>
          </div>
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <dt className="text-xs text-muted">Latest usage date</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">
              {data.latest_usage_date ? <time dateTime={data.latest_usage_date}>{data.latest_usage_date}</time> : "Not reported"}
            </dd>
          </div>
        </dl>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded border border-border bg-subtle p-3">
            <label htmlFor="sync-command" className="sr-only">Sync command</label>
            <input
              id="sync-command"
              readOnly
              value={SYNC_COMMAND}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-mono)] text-sm focus-visible:outline-2 focus-visible:outline-accent"
            />
            <Button type="button" variant="secondary" onClick={handleCopy} aria-label="Copy sync command">
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
          <p className="mt-1.5 text-pretty text-xs text-muted" role="status">
            {copyError ? "Clipboard access was blocked. Select the command above and copy it manually." : copied ? "Copied to clipboard" : "Requires Node.js 18 or later. No global install needed."}
          </p>
          <p className="mt-4 text-pretty text-xs leading-relaxed text-muted">
            Straude uses ccusage to read local usage from supported coding agents, including Claude Code and Codex. The first sync checks your last three days.
          </p>
          <p className="mt-3 text-pretty text-xs leading-relaxed text-muted">
            Only aggregate stats leave your machine: token counts, cost, and model names. Your prompts, code, and conversations stay private.{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy policy</Link>
          </p>
        </>
      )}

      {sync.phase === "waiting" && (
        <p role="status" className="mt-4 rounded border border-border bg-subtle px-4 py-4 text-pretty text-sm text-muted">
          Waiting for your first sync. This page checks automatically.
        </p>
      )}
      {sync.phase === "confirming" && (
        <p role="status" className="mt-4 text-sm text-muted">Finishing setup…</p>
      )}
      {sync.phase === "error" && (
        <div className="mt-4 rounded border border-border p-4">
          <p role="alert" className="text-pretty text-sm text-error">{sync.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSync(data ? { phase: "confirming", data } : { phase: "waiting" });
                setAttempt((value) => value + 1);
              }}
            >
              {data ? "Retry setup" : "Check again"}
            </Button>
            {sync.requiresLogin && <Link href="/login?next=%2Fonboarding" className="text-sm underline underline-offset-2">Sign in again</Link>}
          </div>
        </div>
      )}

      {sync.phase === "success" ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {data?.latest_post_url && (
              <Button type="button" variant="secondary" onClick={() => router.push(data.latest_post_url!)} className="py-3">View synced post</Button>
            )}
            <Button type="button" onClick={() => router.push(username ? `/u/${username}` : "/feed")} className="flex-1 py-3">
              {username ? "View your profile" : "Go to your feed"}
              <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-4 text-center text-pretty text-sm text-muted">
            Make it yours: <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">add a handle and profile details</Link> (optional).
          </p>
        </>
      ) : (
        <>
          <Button type="button" onClick={() => router.push("/feed")} variant="secondary" className="mt-6 w-full py-3">Explore without syncing</Button>
          <p className="mt-4 text-center text-pretty text-xs text-muted">Your handle and profile details are optional. Add them in Settings after your first sync.</p>
        </>
      )}
    </>
  );
}
