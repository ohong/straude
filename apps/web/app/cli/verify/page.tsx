"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

// metadata must be in a server component; for this client page, we use a
// separate layout or rely on the parent layout. Adding a generateMetadata
// export here would require splitting the file. Instead we embed a <title>.
// See: the Suspense fallback already handles SSR.

function VerifyContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">No authorization code provided.</p>
      </div>
    );
  }

  async function handleAuthorize() {
    setState("loading");
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setErrorMsg("You must be logged in to authorize the CLI.");
        setState("error");
        return;
      }

      const { error: updateError } = await supabase
        .from("cli_auth_codes")
        .update({ user_id: user.id, status: "completed" })
        .eq("code", code)
        .eq("status", "pending");

      if (updateError) {
        setErrorMsg("Failed to authorize. The code may have expired.");
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <title>Authorize CLI — Straude</title>
        <h1 className="text-2xl font-medium tracking-tight">Authorize CLI</h1>

        <div className="border border-border p-6">
          <p className="text-sm text-muted mb-3">Your authorization code:</p>
          <p className="font-mono text-3xl font-semibold tracking-widest">{code}</p>
        </div>

        {state === "success" ? (
          <div className="space-y-2">
            <p className="text-accent font-semibold">CLI authorized</p>
            <p className="text-sm text-muted">You can close this window and return to your terminal.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {state === "error" && (
              <p className="text-error text-sm">{errorMsg}</p>
            )}
            <Button
              onClick={handleAuthorize}
              disabled={state === "loading"}
              className="w-full"
            >
              {state === "loading" ? "Authorizing..." : "Authorize CLI"}
            </Button>
            <p className="text-xs text-muted">
              This will grant your CLI access to push usage data on your behalf.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CliVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted">Loading...</p>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
