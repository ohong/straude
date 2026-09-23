"use client";

import { useState } from "react";
import { Checkbox } from "@base-ui-components/react/checkbox";
import {
  Chrome,
  Ellipsis,
  Facebook,
  Github,
  Instagram,
  Linkedin,
  MessagesSquare,
  Mic,
  MonitorPlay,
  Newspaper,
  Rss,
  Sparkles,
  Twitter,
  UsersRound,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  HEARD_ABOUT_LABELS,
  HEARD_ABOUT_OPTION_KEYS,
  HEARD_ABOUT_OTHER_KEY,
  type HeardAboutOptionKey,
} from "@/lib/onboarding/heard-about-options";
import { cn } from "@/lib/utils/cn";

const OTHER_DETAIL_MAX_LENGTH = 500;

const OPTION_ICONS: Record<HeardAboutOptionKey, LucideIcon> = {
  google: Chrome,
  friend_or_coworker: UsersRound,
  newsletter: Newspaper,
  hacker_news: Rss,
  reddit: MessagesSquare,
  x_twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  github: Github,
  billboards_outside: MonitorPlay,
  podcast: Mic,
  ai_agent: Sparkles,
  other: Ellipsis,
};

export function HeardAboutStep({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<HeardAboutOptionKey[]>([]);
  const [otherDetail, setOtherDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherSelected = selected.includes(HEARD_ABOUT_OTHER_KEY);

  function setOptionSelected(key: HeardAboutOptionKey, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, key] : current.filter((value) => value !== key),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length === 0 || saving) return;

    setSaving(true);
    setError(null);

    // Send catalog order so the payload matches the order the API stores.
    const body: Record<string, unknown> = {
      heard_about_sources: HEARD_ABOUT_OPTION_KEYS.filter((key) => selected.includes(key)),
    };
    // "Other" is the only option with a free-text detail; keep the rest of the
    // free-text column untouched when the option is not selected.
    if (otherSelected) {
      body.heard_about = otherDetail.trim() || null;
    }

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      // The parent unmounts this step, so no state reset is needed on success.
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
          How did you hear about us?
        </legend>
        <p id="heard-about-hint" className="mt-1 text-pretty text-sm text-muted">
          Select all that apply. This helps us understand where people find Straude.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {HEARD_ABOUT_OPTION_KEYS.map((key) => {
            const Icon = OPTION_ICONS[key];
            return (
              <Checkbox.Root
                key={key}
                checked={selected.includes(key)}
                onCheckedChange={(checked) => setOptionSelected(key, checked)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  "data-unchecked:border-border data-unchecked:text-muted data-unchecked:hover:bg-subtle",
                  "data-checked:border-accent data-checked:bg-accent/10 data-checked:font-medium data-checked:text-foreground",
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {HEARD_ABOUT_LABELS[key]}
              </Checkbox.Root>
            );
          })}
        </div>

        {otherSelected && (
          <div className="mt-4">
            <label
              htmlFor="heard-about-other"
              className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted"
            >
              Tell us where
            </label>
            <Input
              id="heard-about-other"
              value={otherDetail}
              onChange={(event) => setOtherDetail(event.target.value)}
              maxLength={OTHER_DETAIL_MAX_LENGTH}
              placeholder="Conference, community, a blog post…"
              aria-describedby="heard-about-other-hint"
            />
            <p id="heard-about-other-hint" className="mt-1 text-xs text-muted">
              Optional. {otherDetail.length}/{OTHER_DETAIL_MAX_LENGTH}
            </p>
          </div>
        )}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="mr-auto text-xs text-muted">
          {selected.length > 0 ? `${selected.length} selected` : ""}
        </p>
        <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
          Skip
        </Button>
        <Button type="submit" disabled={selected.length === 0 || saving}>
          {saving ? "Saving…" : "Submit"}
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
