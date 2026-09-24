"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  HEARD_ABOUT_LABELS,
  HEARD_ABOUT_SURVEY_KEYS,
  type HeardAboutSurveyKey,
} from "@/lib/onboarding/heard-about-options";
import { cn } from "@/lib/utils/cn";

const DETAIL_MAX_LENGTH = 160;
const DETAIL_PLACEHOLDERS: Record<HeardAboutSurveyKey, string> = {
  search_engine: "What did you search for?",
  friend_or_coworker: "Who or what group mentioned it?",
  x_twitter: "A post or account",
  github: "A repo or profile",
  hacker_news: "A post title",
  reddit: "A subreddit or post",
  newsletter: "Which newsletter?",
  podcast: "Which show or episode?",
  youtube: "Which video or channel?",
  ai_agent: "Which assistant?",
  other: "A community, event, or site",
};

export function HeardAboutStep({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<HeardAboutSurveyKey | null>(null);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectSource(key: HeardAboutSurveyKey) {
    if (key !== selected) setDetail("");
    setSelected(key);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The column remains an array so earlier answers and consumers stay valid.
          heard_about_sources: [selected],
          heard_about: detail.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "We could not save your answer. Try again.",
        );
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError("We could not save your answer. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <fieldset className="border-0 p-0" aria-describedby="heard-about-hint">
        <legend className="text-balance text-lg font-medium">
          How did you find Straude?
        </legend>
        <p id="heard-about-hint" className="mt-1 text-pretty text-sm text-muted">
          Choose the first place you heard about us.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {HEARD_ABOUT_SURVEY_KEYS.map((key) => (
            <label key={key} className="cursor-pointer">
              <input
                type="radio"
                name="heard_about_source"
                value={key}
                checked={selected === key}
                onChange={() => selectSource(key)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm text-foreground transition-colors duration-150",
                  "hover:bg-subtle peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                  "peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:font-medium",
                )}
              >
                <span
                  className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-muted"
                  aria-hidden="true"
                >
                  {selected === key && <span className="size-2 rounded-full bg-accent" />}
                </span>
                {HEARD_ABOUT_LABELS[key]}
              </span>
            </label>
          ))}
        </div>

        {selected && (
          <div className="mt-5">
            <label htmlFor="heard-about-detail" className="mb-1.5 block text-sm font-medium">
              {selected === "other" ? "Where did you find us?" : "Anything more specific?"}{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input
              id="heard-about-detail"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              maxLength={DETAIL_MAX_LENGTH}
              placeholder={DETAIL_PLACEHOLDERS[selected]}
              aria-describedby="heard-about-detail-hint"
            />
            <p id="heard-about-detail-hint" className="mt-1 text-xs text-muted">
              {detail.length}/{DETAIL_MAX_LENGTH} characters
            </p>
          </div>
        )}
      </fieldset>

      <div className="mt-5 flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
          Skip
        </Button>
        <Button type="submit" disabled={!selected || saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-center text-pretty text-sm text-error">
          {error}
        </p>
      )}
    </form>
  );
}
