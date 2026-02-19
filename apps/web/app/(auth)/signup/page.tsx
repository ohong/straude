"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handleGitHub() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  }

  return (
    <>
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span
            className="inline-block h-6 w-6 bg-accent"
            style={{ clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" }}
          />
          STRAUDE
        </Link>
      </div>

      <h1 className="mb-1 text-2xl font-medium tracking-tight" style={{ letterSpacing: "-0.03em" }}>
        Create your account
      </h1>
      <p className="mb-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline">
          Log in
        </Link>
      </p>

      {sent ? (
        <div className="border border-border p-4">
          <p className="text-sm font-medium">Check your email</p>
          <p className="mt-1 text-sm text-muted">
            We sent a magic link to <strong>{email}</strong>
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
            <label htmlFor="signup-email" className="text-xs font-semibold uppercase tracking-widest text-muted">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full border border-border bg-background px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-3 focus:ring-accent/15"
              style={{ borderRadius: 4 }}
            />
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ borderRadius: 4 }}
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={handleGitHub}
            className="flex w-full items-center justify-center gap-2 border border-border py-3 text-sm font-semibold hover:bg-subtle"
            style={{ borderRadius: 4 }}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>
        </>
      )}
    </>
  );
}
