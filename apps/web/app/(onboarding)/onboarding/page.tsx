"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BoltIcon } from "@/components/landing/icons";
import { Check, X, Loader2, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trackActivationEvent } from "@/lib/analytics/client";
import { formatCurrency } from "@/lib/utils/format";

const SYNC_COMMAND = "npx straude@latest";

interface UsageStatus {
  has_data: boolean;
  has_usage?: boolean;
  cost_usd?: number;
  total_tokens?: number;
  session_count?: number;
  top_model?: string | null;
  latest_usage_id?: string;
  latest_usage_at?: string | null;
  latest_post_url?: string | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function Step3LogSession({ username }: { username: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<"waiting" | "success">("waiting");
  const [data, setData] = useState<UsageStatus | null>(null);
  const [hasExistingUsage, setHasExistingUsage] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const activationTrackedRef = useRef(false);
  const activationPersistedRef = useRef(false);
  const commandCopiedRef = useRef(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(SYNC_COMMAND).then(() => {
      commandCopiedRef.current = true;
      trackActivationEvent("sync_command_copied", {
        surface: "onboarding",
        command: SYNC_COMMAND,
        activation_state: "sync_command_copied",
        is_authenticated: true,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/usage/status");
        if (!res.ok) return;
        const json: UsageStatus = await res.json();
        const hasUsage = json.has_usage ?? json.has_data;

        if (hasUsage && active) {
          setData(json);
          setHasExistingUsage(!commandCopiedRef.current);
          setPhase("success");
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // ignore — will retry on next interval
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 4000);
    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "success" || !data || activationPersistedRef.current) return;

    activationPersistedRef.current = true;
    const observedUsage = data;

    async function persistActivation() {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_completed: true }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setCompletionError(
          typeof payload.error === "string"
            ? payload.error
            : "We saw your usage, but setup could not be completed. Refresh and try again.",
        );
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
          has_existing_usage: hasExistingUsage,
          "$insert_id": observedUsage.latest_usage_id
            ? `activation_completed:${observedUsage.latest_usage_id}`
            : "activation_completed:onboarding",
        });
      }
    }

    void persistActivation();
  }, [data, hasExistingUsage, phase]);

  if (phase === "success" && data) {
    return (
      <>
        <div className="mb-8">
          <BoltIcon className="h-6 w-6 text-accent" />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <Check size={20} className="text-accent" aria-hidden="true" />
          <h1
            className="text-2xl font-medium tracking-tight"
            style={{ letterSpacing: "-0.03em" }}
          >
            Session logged
          </h1>
        </div>
        <p className="mb-6 text-sm text-muted">
          Your usage is live. Straude can now build your streak, spend totals,
          and shareable session history.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <p className="text-xs text-muted uppercase tracking-widest">Cost</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              ${formatCurrency(data.cost_usd)}
            </p>
          </div>
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <p className="text-xs text-muted uppercase tracking-widest">Tokens</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {formatTokens(data.total_tokens ?? 0)}
            </p>
          </div>
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <p className="text-xs text-muted uppercase tracking-widest">Sessions</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {data.session_count}
            </p>
          </div>
          <div className="rounded border border-border bg-subtle px-4 py-3">
            <p className="text-xs text-muted uppercase tracking-widest">Top model</p>
            <p className="mt-1 text-lg font-semibold text-foreground truncate">
              {data.top_model ?? "—"}
            </p>
          </div>
        </div>

        {completionError && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-500">
            {completionError}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          {data.latest_post_url && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(data.latest_post_url ?? "/feed")}
              className="py-3"
            >
              View session
            </Button>
          )}
          <Button
            onClick={() => router.push(username ? `/u/${username}` : "/feed")}
            className="flex-1 py-3"
          >
            {username ? "View your profile" : "Go to your feed"}
            <ArrowRight size={16} className="ml-1.5" />
          </Button>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-accent" />
          <span className="h-1.5 w-6 rounded-full bg-accent" />
          <span className="h-1.5 w-6 rounded-full bg-accent" />
        </div>
      </>
    );
  }

  // Waiting state
  return (
    <>
      <div className="mb-8">
        <BoltIcon className="h-6 w-6 text-accent" />
      </div>

      <h1
        className="text-2xl font-medium tracking-tight"
        style={{ letterSpacing: "-0.03em" }}
      >
        Sync your first session
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Run this in your terminal after a Claude Code or Codex session. Straude
        will post your usage stats as soon as the web app sees them.
      </p>

      {/* Copy-to-clipboard command */}
      <button
        type="button"
        onClick={handleCopy}
        className="flex w-full items-center justify-between gap-3 rounded border border-border bg-subtle px-4 py-3 font-[family-name:var(--font-mono)] text-sm transition-[border-color,background-color] duration-150 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Copy sync command"
      >
        <span className="text-foreground">{SYNC_COMMAND}</span>
        {copied ? (
          <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />
        ) : (
          <Copy size={16} className="shrink-0 text-muted" aria-hidden="true" />
        )}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        {copied ? "Copied to clipboard" : "Click to copy"}
      </p>

      {/* Privacy assurance */}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Only aggregate stats leave your machine - token counts, cost, model
        names. Your prompts, code, and conversations never do.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy policy
        </Link>
      </p>

      {/* Listening indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded border border-border bg-subtle px-4 py-4 font-[family-name:var(--font-mono)] text-sm text-muted">
        <span className="animate-pulse text-accent" aria-hidden="true">&#9679;&#9679;&#9679;</span>
        <span>Listening for your first session&hellip;</span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={() => router.push("/feed")}
          variant="secondary"
          className="flex-1 py-3"
        >
          Explore without syncing
        </Button>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        <span className="h-1.5 w-6 rounded-full bg-accent" />
        <span className="h-1.5 w-6 rounded-full bg-accent" />
        <span className="h-1.5 w-6 rounded-full bg-accent" />
      </div>
    </>
  );
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-detect timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Pre-fill from existing profile (e.g. GitHub OAuth data)
  useEffect(() => {
    async function loadProfile() {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const profile = await res.json();
        // Pre-fill username: use existing username (e.g. auto-claimed from GitHub),
        // otherwise suggest from GitHub handle
        if (profile.username) {
          setUsername(profile.username);
        } else if (profile.github_username) {
          const suggested = profile.github_username
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 20);
          if (/^[a-z0-9_]{3,20}$/.test(suggested)) {
            setUsername(suggested);
          }
        }
        if (profile.display_name) setDisplayName(profile.display_name);
      }
    }
    loadProfile();
  }, []);

  // Debounced username availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username || username.length < 3) {
      setUsernameStatus(username.length > 0 ? "invalid" : "idle");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/users/check-username?username=${encodeURIComponent(username)}`
      );
      if (res.ok) {
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  async function handleProfileSave() {
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      timezone,
    };
    if (username) body.username = username;
    if (displayName) body.display_name = displayName;

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep(3);
  }

  // Allow proceeding if username is valid+available, or if left empty (optional)
  const canProceed =
    usernameStatus === "available" || (!username && usernameStatus === "idle");

  if (step === 1) {
    return (
      <>
        <div className="mb-8">
          <BoltIcon className="h-6 w-6 text-accent" />
        </div>

        <h1
          className="text-2xl font-medium tracking-tight"
          style={{ letterSpacing: "-0.03em" }}
        >
          Claim your handle
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Let friends find you and see your stats. This is your public identity
          on Straude.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="onboard-username" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
              Username <span className="normal-case tracking-normal text-muted">(optional)</span>
            </label>
            <div className="relative">
              <Input
                id="onboard-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                placeholder="your_handle"
                maxLength={20}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 size={16} className="animate-spin text-muted" />
                )}
                {usernameStatus === "available" && (
                  <Check size={16} className="text-green-600" />
                )}
                {usernameStatus === "taken" && (
                  <X size={16} className="text-red-500" />
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {usernameStatus === "idle" && "3-20 characters, letters, numbers, underscores"}
              {usernameStatus === "invalid" && "3-20 characters, letters, numbers, underscores"}
              {usernameStatus === "checking" && "Checking availability\u2026"}
              {usernameStatus === "available" && (
                <span className="text-green-600">
                  straude.com/u/{username} is yours
                </span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-red-500">Already taken</span>
              )}
            </p>
          </div>

          <div>
            <label htmlFor="onboard-display-name" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
              Display name <span className="normal-case tracking-normal text-muted">(optional)</span>
            </label>
            <Input
              id="onboard-display-name"
              name="display_name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to appear"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={() => {
              trackActivationEvent("onboarding_profile_started", {
                surface: "onboarding",
                activation_state: "profile_started",
                is_authenticated: true,
              });
              setStep(2);
            }}
            disabled={!canProceed}
            className="flex-1 py-3"
          >
            Continue
            <ArrowRight size={16} className="ml-1.5" />
          </Button>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-accent" />
          <span className="h-1.5 w-6 rounded-full bg-border" />
          <span className="h-1.5 w-6 rounded-full bg-border" />
        </div>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <div className="mb-8">
          <BoltIcon className="h-6 w-6 text-accent" />
        </div>

        <h1
          className="text-2xl font-medium tracking-tight"
          style={{ letterSpacing: "-0.03em" }}
        >
          Ready to sync
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Your first sync unlocks the useful parts of Straude: spend, tokens,
          streaks, and a shareable session you can edit after it lands.
        </p>

        <div className="space-y-3 rounded border border-border bg-subtle px-4 py-4 text-sm text-muted">
          <div className="flex gap-3">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p>One command posts aggregate usage for your latest local sessions.</p>
          </div>
          <div className="flex gap-3">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p>Prompts, code, file paths, and conversation text stay private.</p>
          </div>
          <div className="flex gap-3">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p>You can add bio, location, and links later from Settings.</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm text-muted hover:text-foreground"
          >
            Back
          </button>
          <Button
            onClick={handleProfileSave}
            disabled={saving}
            className="flex-1 py-3"
          >
            {saving ? "Saving..." : "Show sync command"}
          </Button>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-accent" />
          <span className="h-1.5 w-6 rounded-full bg-accent" />
          <span className="h-1.5 w-6 rounded-full bg-border" />
        </div>
      </>
    );
  }

  // Step 3: Log your first session
  return <Step3LogSession username={username} />;
}
