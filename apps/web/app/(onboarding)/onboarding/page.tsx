"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CountryPicker } from "@/components/ui/CountryPicker";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [profileLoaded, setProfileLoaded] = useState(false);

  // Step 2
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [githubUsername, setGithubUsername] = useState("");

  // Auto-detect timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Pre-fill from existing profile (e.g. GitHub OAuth data)
  useEffect(() => {
    async function loadProfile() {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const profile = await res.json();
        if (profile.github_username) {
          setGithubUsername(profile.github_username);
        }
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
        if (profile.country) setCountry(profile.country);
        if (profile.bio) setBio(profile.bio);
      }
      setProfileLoaded(true);
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

  async function handleFinish() {
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      timezone,
      onboarding_completed: true,
    };
    if (username) body.username = username;
    if (displayName) body.display_name = displayName;
    if (bio) body.bio = bio;
    if (country) body.country = country;
    if (githubUsername) body.github_username = githubUsername;

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

    router.push("/feed");
  }

  // Allow proceeding if username is valid+available, or if left empty (optional)
  const canProceed =
    usernameStatus === "available" || (!username && usernameStatus === "idle");

  if (step === 1) {
    return (
      <>
        <div className="mb-8">
          <span
            className="inline-block h-6 w-6 bg-accent"
            style={{
              clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            }}
          />
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
            onClick={() => setStep(2)}
            disabled={!canProceed}
            className="flex-1 py-3"
          >
            Continue
            <ArrowRight size={16} className="ml-1.5" />
          </Button>
        </div>

        <div className="mt-3 text-center">
          <Link href="/feed" className="text-sm text-muted hover:text-foreground">
            Skip for now
          </Link>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-accent" />
          <span className="h-1.5 w-6 rounded-full bg-border" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <span
          className="inline-block h-6 w-6 bg-accent"
          style={{
            clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
          }}
        />
      </div>

      <h1
        className="text-2xl font-medium tracking-tight"
        style={{ letterSpacing: "-0.03em" }}
      >
        Almost there
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Optional details to round out your profile. You can always change these
        later in Settings.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="onboard-bio" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Bio
          </label>
          <Textarea
            id="onboard-bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What are you building with Claude\u2026"
            maxLength={160}
            rows={2}
            className="min-h-0"
          />
          <p className="mt-1 text-xs text-muted">{bio.length}/160</p>
        </div>

        <div>
          <label htmlFor="onboard-country" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Country
          </label>
          <CountryPicker
            id="onboard-country"
            name="country"
            value={country}
            onChange={setCountry}
          />
        </div>

        <div>
          <label htmlFor="onboard-github" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            GitHub username
          </label>
          <Input
            id="onboard-github"
            name="github_username"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="your-github"
          />
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
          onClick={handleFinish}
          disabled={saving}
          className="flex-1 py-3"
        >
          {saving ? "Setting up\u2026" : "Start logging"}
        </Button>
      </div>

      <div className="mt-3 text-center">
        <Link href="/feed" className="text-sm text-muted hover:text-foreground">
          Skip for now
        </Link>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        <span className="h-1.5 w-6 rounded-full bg-accent" />
        <span className="h-1.5 w-6 rounded-full bg-accent" />
      </div>
    </>
  );
}
