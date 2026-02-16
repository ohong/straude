"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { User } from "@/types";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [link, setLink] = useState("");
  const [country, setCountry] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setUsername(data.username ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setLink(data.link ?? "");
        setCountry(data.country ?? "");
        setGithubUsername(data.github_username ?? "");
        setIsPublic(data.is_public);
        setTimezone(data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username || undefined,
        display_name: displayName || undefined,
        bio: bio || undefined,
        link: link || undefined,
        country: country || undefined,
        github_username: githubUsername || undefined,
        is_public: isPublic,
        timezone,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  if (!profile) {
    return <div className="p-6 text-sm text-muted">Loading...</div>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Settings</h3>
        <Link
          href="/settings/import"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Import Usage Data
        </Link>
      </header>

      <form onSubmit={handleSave} className="mx-auto max-w-lg space-y-6 px-6 py-8">
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <Avatar
            src={profile.avatar_url}
            alt={profile.username ?? ""}
            fallback={displayName || username || "?"}
            size="lg"
          />
          <div>
            <p className="font-medium">{profile.username ?? "No username set"}</p>
            <p className="text-sm text-muted">{profile.id}</p>
          </div>
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Username
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            maxLength={20}
            pattern="^[a-zA-Z0-9_]{3,20}$"
          />
          <p className="mt-1 text-xs text-muted">3-20 chars, alphanumeric + underscore</p>
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Display Name
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Bio
          </label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={2}
            className="min-h-0"
          />
          <p className="mt-1 text-xs text-muted">{bio.length}/160</p>
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Country (ISO code)
          </label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="US"
            maxLength={2}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Website
          </label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com"
            maxLength={200}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            GitHub Username
          </label>
          <Input
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Timezone
          </label>
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            id="is_public"
            className="accent-accent"
          />
          <label htmlFor="is_public" className="text-sm">
            Public profile (visible on leaderboard)
          </label>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        {saved && <p className="text-sm text-accent">Saved successfully.</p>}

        <Button type="submit" disabled={saving} className="w-full py-3">
          {saving ? "Saving..." : "Save Changes"}
        </Button>

        <div className="border-t border-border pt-6">
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/");
            }}
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </form>
    </>
  );
}
