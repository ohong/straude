"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

type ThemeId = "light" | "dark";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider">
        {label}
      </div>
      <div className="relative">
        <pre className="overflow-x-auto rounded-[4px] border border-border bg-subtle px-3 py-2.5 text-xs text-foreground leading-relaxed">
          {code}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-[4px] border border-border bg-background hover:bg-subtle transition-colors"
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function CardPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [theme, setTheme] = useState<ThemeId>("light");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/users/me");
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const profile = await res.json();

      if (profile?.username) {
        setUsername(profile.username);
        setIsPublic(profile.is_public);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-sm text-muted">Loading...</div>
      </div>
    );
  }

  if (!username) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
        <div className="text-sm text-muted">
          Set a username in settings to get your card.
        </div>
        <Link href="/settings">
          <Button variant="secondary" size="sm">
            Go to Settings
          </Button>
        </Link>
      </div>
    );
  }

  const baseUrl = "https://straude.com";
  const cardUrl = `${baseUrl}/api/card/${username}`;
  const profileUrl = `${baseUrl}/u/${username}`;

  const markdownLight = `[![Straude Stats](${cardUrl})](${profileUrl})`;
  const markdownDark = `[![Straude Stats](${cardUrl}?theme=dark)](${profileUrl})`;
  const markdownAuto = `<a href="${profileUrl}">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="${cardUrl}?theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="${cardUrl}?theme=light" />
    <img alt="Straude Stats" src="${cardUrl}" />
  </picture>
</a>`;

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-8 gap-8">
      <div>
        <h1 className="text-lg font-bold text-foreground">Stats Card</h1>
        <p className="mt-1 text-sm text-muted">
          Embed your Straude stats on your GitHub profile README.
        </p>
      </div>

      {!isPublic && (
        <div className="rounded-[4px] border border-border bg-subtle px-4 py-3 text-sm text-muted">
          Your profile is private. The card will show a &quot;private
          profile&quot; placeholder until you{" "}
          <Link href="/settings" className="text-accent hover:underline">
            make it public
          </Link>
          .
        </div>
      )}

      {/* Theme toggle */}
      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider">
          Theme
        </div>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition-colors ${
                theme === t.id
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider">
          Preview
        </div>
        <div className="rounded-[4px] border border-border bg-subtle p-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/card/${username}?theme=${theme}`}
            alt="Straude Stats Card"
            width={495}
            height={270}
            className="rounded-[4px]"
          />
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/card/${username}?theme=${theme}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open image
            </Button>
          </a>
        </div>
      </div>

      {/* Embed snippets */}
      <div className="flex flex-col gap-5">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider">
          Embed in your README
        </div>
        <CopyBlock label="Light theme" code={markdownLight} />
        <CopyBlock label="Dark theme" code={markdownDark} />
        <CopyBlock label="Auto-match GitHub theme (recommended)" code={markdownAuto} />
      </div>
    </div>
  );
}
