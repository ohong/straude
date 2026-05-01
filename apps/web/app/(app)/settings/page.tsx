"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { User } from "@/types";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { LogOut, Copy, Check, Camera, Loader2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { compressImage } from "@/lib/utils/compress-image";
import { CountryPicker } from "@/components/ui/CountryPicker";

type ProfileUpdatePayloadInput = {
  username: string;
  displayName: string;
  bio: string;
  heardAbout: string;
  link: string;
  country: string;
  githubUsername: string;
  isPublic: boolean;
  emailNotifications: boolean;
  emailMentionNotifications: boolean;
  emailDmNotifications: boolean;
  timezone: string;
};

export function buildProfileUpdatePayload(input: ProfileUpdatePayloadInput) {
  return {
    username: input.username.trim() || undefined,
    display_name: input.displayName.trim() || null,
    bio: input.bio.trim() || null,
    heard_about: input.heardAbout.trim() || null,
    link: input.link.trim() || null,
    country: input.country || null,
    github_username: input.githubUsername.trim() || null,
    is_public: input.isPublic,
    email_notifications: input.emailNotifications,
    email_mention_notifications: input.emailMentionNotifications,
    email_dm_notifications: input.emailDmNotifications,
    timezone: input.timezone,
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const posthog = usePostHog();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/users/me");
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
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
        setCrewCount(data.crew_count ?? 0);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarInputRef.current) avatarInputRef.current.value = "";

    setAvatarUploading(true);
    setError(null);

    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);

      const uploadRes = await fetch("/api/upload?bucket=avatars", {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }

      const { url } = await uploadRes.json();

      const patchRes = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });

      if (!patchRes.ok) {
        const data = await patchRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save avatar");
      }

      setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildProfileUpdatePayload({
        username,
        displayName,
        bio,
        heardAbout,
        link,
        country,
        githubUsername,
        isPublic,
        emailNotifications,
        emailMentionNotifications,
        emailDmNotifications,
        timezone,
      })),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      setSaved(true);
      posthog.capture("profile_saved", { is_public: isPublic });
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="px-[var(--app-page-padding-x)] py-6 text-sm text-muted">Loading&hellip;</div>;
  }

  if (!profile) {
    return <div className="px-[var(--app-page-padding-x)] py-6 text-sm text-muted">Unable to load profile.</div>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-[var(--app-page-padding-x)]">
        <h3 className="text-lg font-medium">Settings</h3>
        <Link
          href="/settings/import"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Import Usage Data
        </Link>
      </header>

      <form onSubmit={handleSave} className="mx-auto max-w-lg px-[var(--app-page-padding-x)] py-8">
        <div className="flex items-center gap-4 pb-6">
          <div className="relative">
            <Avatar
              src={profile.avatar_url}
              alt={profile.username ?? ""}
              fallback={displayName || username || "?"}
              size="lg"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-background bg-subtle text-muted hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
              aria-label="Upload profile picture"
            >
              {avatarUploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
              onChange={handleAvatarUpload}
              className="hidden"
              aria-label="Choose profile picture"
            />
          </div>
          <div>
            <p className="font-medium">{profile.display_name ?? profile.username ?? "No username set"}</p>
            {profile.username && (
              <p className="text-sm text-muted">@{profile.username}</p>
            )}
          </div>
        </div>

        {/* ── Profile ── */}
        <fieldset className="space-y-6 border-t border-border pt-6">
          <legend className="text-sm font-semibold uppercase tracking-widest text-muted">Profile</legend>

          <div>
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

          <div>
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

          <div>
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

          <div>
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

          <div>
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

          <div>
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

          <div>
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

          <div>
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
            <div>
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
                    posthog.capture("referral_link_copied", { username });
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
        </fieldset>

        {/* ── Notifications ── */}
        <fieldset className="mt-8 space-y-4 border-t border-border pt-6">
          <legend className="text-sm font-semibold uppercase tracking-widest text-muted">Notifications</legend>

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
        </fieldset>

        {/* ── Privacy & Account ── */}
        <fieldset className="mt-8 space-y-4 border-t border-border pt-6">
          <legend className="text-sm font-semibold uppercase tracking-widest text-muted">Privacy &amp; Account</legend>

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
        </fieldset>

        <div className="mt-8 space-y-4">
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
        </div>

        {/* ── Delete Account ── */}
        <fieldset className="mt-12 space-y-4">
          <legend className="text-2xl font-semibold text-error">Delete account</legend>
          <hr className="border-error/30" />

          <p className="text-sm">
            Once you delete your account, all of your data&mdash;usage logs, posts, comments, and profile&mdash;will be permanently removed. This cannot be undone.
          </p>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirm("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="rounded-[4px] border border-error/30 px-5 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/10"
          >
            Delete your account
          </button>
        </fieldset>
      </form>

      {deleteOpen &&
        createPortal(
          <DeleteAccountDialog
            username={username}
            confirmValue={deleteConfirm}
            onConfirmChange={setDeleteConfirm}
            deleting={deleting}
            error={deleteError}
            inputRef={deleteInputRef}
            onClose={() => setDeleteOpen(false)}
            onDelete={async () => {
              setDeleting(true);
              setDeleteError(null);

              const res = await fetch("/api/users/me", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
              });

              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setDeleteError(data.error ?? "Failed to delete account");
                setDeleting(false);
                return;
              }

              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/");
            }}
          />,
          document.body,
        )}
    </>
  );
}

function DeleteAccountDialog({
  username,
  confirmValue,
  onConfirmChange,
  deleting,
  error,
  inputRef,
  onClose,
  onDelete,
}: {
  username: string;
  confirmValue: string;
  onConfirmChange: (value: string) => void;
  deleting: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onDelete: () => void;
}) {
  const confirmSentence = `I, ${username}, wish to delete my Straude account. I understand this cannot be undone.`;
  const canDelete = confirmValue === confirmSentence && username.length > 0;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [inputRef]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, deleting]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-desc"
        className="w-full max-w-md rounded-[8px] border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id="delete-account-title" className="text-lg font-semibold text-error">
            Are you sure you want to do this?
          </h2>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p id="delete-account-desc" className="text-sm text-muted">
            This will permanently delete your account and all associated data including usage logs, posts, comments, followers, and your profile. <strong className="text-foreground">This action cannot be undone.</strong>
          </p>

          <div>
            <label htmlFor="delete-confirm-input" className="mb-1.5 block text-sm">
              To confirm, type the following statement below:
            </label>
            <p className="mb-2 select-all rounded border border-border bg-subtle px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-foreground">
              {confirmSentence}
            </p>
            <Input
              ref={inputRef}
              id="delete-confirm-input"
              value={confirmValue}
              onChange={(e) => onConfirmChange(e.target.value)}
              placeholder="Type the sentence above to confirm"
              autoComplete="off"
              spellCheck={false}
              disabled={deleting}
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-[4px] border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete || deleting}
            className="rounded-[4px] bg-error px-4 py-2 text-sm font-semibold text-white transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting\u2026" : "Delete this account"}
          </button>
        </div>
      </div>
    </div>
  );
}
