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
import { LogOut, Copy, Check } from "lucide-react";
import { CountryPicker } from "@/components/ui/CountryPicker";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [link, setLink] = useState("");
  const [country, setCountry] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailMentionNotifications, setEmailMentionNotifications] = useState(true);
  const [emailDmNotifications, setEmailDmNotifications] = useState(true);
  const [timezone, setTimezone] = useState("");
  const [crewCount, setCrewCount] = useState(0);
  const [refCopied, setRefCopied] = useState(false);

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
        setHeardAbout(data.heard_about ?? "");
        setLink(data.link ?? "");
        setCountry(data.country ?? "");
        setGithubUsername(data.github_username ?? "");
        setIsPublic(data.is_public);
        setEmailNotifications(data.email_notifications ?? true);
        setEmailMentionNotifications(data.email_mention_notifications ?? true);
        setEmailDmNotifications(data.email_dm_notifications ?? true);
        setTimezone(data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Fetch crew count
        const { count } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("referred_by", data.id);
        setCrewCount(count ?? 0);
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
        heard_about: heardAbout.trim() || null,
        link: link || undefined,
        country: country || undefined,
        github_username: githubUsername || undefined,
        is_public: isPublic,
        email_notifications: emailNotifications,
        email_mention_notifications: emailMentionNotifications,
        email_dm_notifications: emailDmNotifications,
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
    return <div className="p-6 text-sm text-muted">Loading&hellip;</div>;
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
          <label htmlFor="settings-username" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Username
          </label>
          <Input
            id="settings-username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            maxLength={20}
            pattern="^[a-zA-Z0-9_]{3,20}$"
          />
          <p className="mt-1 text-xs text-muted">3-20 chars, alphanumeric + underscore</p>
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-display-name" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Display Name
          </label>
          <Input
            id="settings-display-name"
            name="display_name"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-bio" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Bio
          </label>
          <Textarea
            id="settings-bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={2}
            className="min-h-0"
          />
          <p className="mt-1 text-xs text-muted">{bio.length}/160</p>
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-heard-about" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            How did you hear about us?
          </label>
          <Textarea
            id="settings-heard-about"
            name="heard_about"
            value={heardAbout}
            onChange={(e) => setHeardAbout(e.target.value)}
            placeholder="Friend, GitHub, X, newsletter, podcast..."
            maxLength={500}
            rows={3}
            className="min-h-0"
            aria-describedby="settings-heard-about-hint"
          />
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
            <p id="settings-heard-about-hint" className="text-pretty">
              Optional. This helps us understand where people are finding Straude.
            </p>
            <span>{heardAbout.length}/500</span>
          </div>
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-country" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Country
          </label>
          <CountryPicker
            id="settings-country"
            name="country"
            value={country}
            onChange={setCountry}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-website" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Website
          </label>
          <Input
            id="settings-website"
            name="url"
            type="url"
            autoComplete="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com"
            maxLength={200}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-github" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            GitHub Username
          </label>
          <Input
            id="settings-github"
            name="github_username"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
          />
        </div>

        <div className="border-b border-border pb-6">
          <label htmlFor="settings-timezone" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
            Timezone
          </label>
          <Input
            id="settings-timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </div>

        {username && (
          <div className="border-b border-border pb-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Referral Link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-border bg-subtle px-3 py-2 font-[family-name:var(--font-mono)] text-sm">
                straude.com/join/{username}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`https://straude.com/join/${username}`);
                  setRefCopied(true);
                  setTimeout(() => setRefCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-sm font-semibold hover:bg-subtle"
                style={{ borderRadius: 4 }}
              >
                {refCopied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                {refCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              Share this link to invite others.{crewCount > 0 ? ` ${crewCount} recruited so far.` : ""}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              id="is_public"
              className="accent-accent"
            />
            <label htmlFor="is_public" className="text-sm font-medium">
              Public profile
            </label>
          </div>
          <p className="pl-7 text-xs text-muted">
            {isPublic
              ? "Your profile, posts, and stats are visible to everyone. You appear on the leaderboard."
              : "Your profile and activity are only visible to your followers. You will not appear on the leaderboard."}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              id="email_notifications"
              className="accent-accent"
            />
            <label htmlFor="email_notifications" className="text-sm font-medium">
              Comment emails
            </label>
          </div>
          <p className="pl-7 text-xs text-muted">
            {emailNotifications
              ? "You\u2019ll receive an email when someone comments on your posts."
              : "Email notifications for comments are turned off."}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailMentionNotifications}
              onChange={(e) => setEmailMentionNotifications(e.target.checked)}
              id="email_mention_notifications"
              className="accent-accent"
            />
            <label htmlFor="email_mention_notifications" className="text-sm font-medium">
              Mention emails
            </label>
          </div>
          <p className="pl-7 text-xs text-muted">
            {emailMentionNotifications
              ? "You\u2019ll receive an email when someone @mentions you in a post or comment."
              : "Email notifications for mentions are turned off."}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={emailDmNotifications}
              onChange={(e) => setEmailDmNotifications(e.target.checked)}
              id="email_dm_notifications"
              className="accent-accent"
            />
            <label htmlFor="email_dm_notifications" className="text-sm font-medium">
              Direct message emails
            </label>
          </div>
          <p className="pl-7 text-xs text-muted">
            {emailDmNotifications
              ? "You\u2019ll receive an email when someone sends you a direct message."
              : "Email notifications for direct messages are turned off."}
          </p>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        {saved && <p className="text-sm text-accent">Saved successfully.</p>}

        <Button type="submit" disabled={saving} className="w-full py-3">
          {saving ? "Saving\u2026" : "Save Changes"}
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
