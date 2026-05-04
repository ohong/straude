import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "../../../../supabase/migrations");

function getAllMigrations(): { name: string; content: string }[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((name) => ({
    name,
    content: readFileSync(join(MIGRATIONS_DIR, name), "utf-8"),
  }));
}

function getLatestMigrationMatching(
  migrations: { name: string; content: string }[],
  pattern: RegExp
) {
  return migrations.filter((m) => pattern.test(m.content)).at(-1);
}

describe("Migration safety", () => {
  const migrations = getAllMigrations();

  it("finds migration files", () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it("handle_new_user() must always insert into public.users", () => {
    // Find all migrations that redefine handle_new_user
    const redefining = migrations.filter((m) =>
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_new_user/i.test(
        m.content
      )
    );

    // There should be at least one (the original definition)
    expect(redefining.length).toBeGreaterThan(0);

    // The LAST migration that defines handle_new_user determines the
    // current behavior. It MUST insert into public.users.
    const latest = redefining[redefining.length - 1];
    const insertIntoUsers = /INSERT\s+INTO\s+public\.users/i.test(
      latest.content
    );

    expect(insertIntoUsers).toBe(true);
    // Provide a helpful error message
    if (!insertIntoUsers) {
      throw new Error(
        `Migration "${latest.name}" redefines handle_new_user() but does NOT ` +
          `insert into public.users. This will silently break all signups. ` +
          `See incident: Bao migration 20260306150625 overwrote this function ` +
          `and 16 users were lost for 3 days.`
      );
    }
  });

  it("no migration redefines handle_new_user without inserting into public.users", () => {
    // Every single migration that touches handle_new_user must include
    // an INSERT INTO public.users — not just the latest one.
    const redefining = migrations.filter((m) =>
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_new_user/i.test(
        m.content
      )
    );

    for (const m of redefining) {
      const insertIntoUsers = /INSERT\s+INTO\s+public\.users/i.test(m.content);
      expect(
        insertIntoUsers,
        `Migration "${m.name}" redefines handle_new_user() without inserting ` +
          `into public.users. This WILL break signups. Every redefinition of ` +
          `this trigger function must include INSERT INTO public.users.`
      ).toBe(true);
    }
  });

  it("handle_new_user trigger exists on auth.users", () => {
    // At least one migration must create the trigger
    const hasTrigger = migrations.some((m) =>
      /CREATE\s+TRIGGER\s+on_auth_user_created\b/i.test(m.content)
    );
    expect(hasTrigger).toBe(true);
  });

  it("no migration drops the on_auth_user_created trigger without recreating it", () => {
    // If a migration drops the trigger, it must also recreate it
    for (const m of migrations) {
      const drops = /DROP\s+TRIGGER\s+(IF\s+EXISTS\s+)?on_auth_user_created\b/i.test(
        m.content
      );
      if (drops) {
        const recreates = /CREATE\s+TRIGGER\s+on_auth_user_created\b/i.test(
          m.content
        );
        expect(
          recreates,
          `Migration "${m.name}" drops on_auth_user_created trigger but does ` +
            `not recreate it. This will silently break all signups.`
        ).toBe(true);
      }
    }
  });

  it("latest DM attachment hardening limits updates to read_at and validates paths", () => {
    const dmAttachmentMigrations = migrations.filter((m) =>
      /direct_messages/i.test(m.content)
      && /dm-attachments/i.test(m.content)
    );

    expect(dmAttachmentMigrations.length).toBeGreaterThan(0);

    const latest = dmAttachmentMigrations[dmAttachmentMigrations.length - 1];

    expect(
      /GRANT\s+UPDATE\s*\(\s*read_at\s*\)\s+ON\s+public\.direct_messages\s+TO\s+authenticated/i.test(
        latest.content
      )
    ).toBe(true);
    expect(/left\(attachment->>'path',\s*1\)\s*=\s*'\/'/i.test(latest.content)).toBe(true);
    expect(/position\('\.\.'\s+IN\s+attachment->>'path'\)\s*>\s*0/i.test(latest.content)).toBe(true);
  });

  it("latest direct_messages insert policy scopes existing threads to the inserted pair", () => {
    const latest = getLatestMigrationMatching(
      migrations,
      /CREATE\s+POLICY\s+"Users can send direct messages"[\s\S]*ON\s+public\.direct_messages\s+FOR\s+INSERT/i
    );

    expect(latest, "Expected a direct_messages insert policy migration").toBeTruthy();
    const content = latest!.content;

    expect(/auth\.uid\(\)\s*=\s*direct_messages\.sender_id/i.test(content)).toBe(true);
    expect(/recipient\.id\s*=\s*direct_messages\.recipient_id/i.test(content)).toBe(true);
    expect(/dm\.sender_id\s*=\s*sender_id/i.test(content)).toBe(false);
    expect(/dm\.recipient_id\s*=\s*recipient_id/i.test(content)).toBe(false);
    expect(/dm\.sender_id\s*=\s*direct_messages\.sender_id/i.test(content)).toBe(true);
    expect(/dm\.recipient_id\s*=\s*direct_messages\.recipient_id/i.test(content)).toBe(true);
  });

  it("latest public.users grants only expose a sanitized select list", () => {
    const usersGrantMigrations = migrations.filter((m) =>
      /public\.users/i.test(m.content)
      && (
        /REVOKE\s+ALL\s+ON\s+public\.users/i.test(m.content)
        || /GRANT\s+SELECT\s+ON\s+public\.users/i.test(m.content)
        || /GRANT\s+SELECT\s*\(/i.test(m.content)
      )
    );

    expect(usersGrantMigrations.length).toBeGreaterThan(0);

    const latest = usersGrantMigrations[usersGrantMigrations.length - 1];

    expect(
      /GRANT\s+SELECT\s+ON\s+public\.users\s+TO\s+anon/i.test(latest.content)
    ).toBe(false);
    expect(
      /GRANT\s+SELECT\s+ON\s+public\.users\s+TO\s+authenticated/i.test(latest.content)
    ).toBe(false);
    expect(
      /GRANT\s+SELECT\s*\([^)]*github_username[^)]*\)\s+ON\s+public\.users\s+TO\s+anon/i.test(
        latest.content
      )
    ).toBe(true);
  });

  it("latest get_feed() definition redacts joined user columns", () => {
    const redefining = migrations.filter((m) =>
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_feed/i.test(m.content)
    );

    expect(redefining.length).toBeGreaterThan(0);

    const latest = redefining[redefining.length - 1];

    expect(/to_jsonb\(u\.\*\)/i.test(latest.content)).toBe(false);
    expect(/jsonb_build_object\s*\(/i.test(latest.content)).toBe(true);
  });

  it("latest interaction RLS policies inherit parent post visibility", () => {
    // Match only migrations that actually CREATE POLICY on the interaction
    // tables — not every migration that happens to reference them in passing
    // (e.g. a get_feed redefinition with COUNT(*) FROM public.kudos).
    const latest = getLatestMigrationMatching(
      migrations,
      /CREATE\s+POLICY[^;]*ON\s+public\.(kudos|comments|comment_reactions)/i
    );

    expect(latest, "Expected an interaction policy migration").toBeTruthy();
    const content = latest!.content;

    expect(/ON\s+public\.kudos\s+FOR\s+SELECT[\s\S]*USING\s*\(\s*true\s*\)/i.test(content)).toBe(false);
    expect(/ON\s+public\.comments\s+FOR\s+SELECT[\s\S]*USING\s*\(\s*true\s*\)/i.test(content)).toBe(false);
    expect(/ON\s+public\.comment_reactions\s+FOR\s+SELECT[\s\S]*USING\s*\(\s*true\s*\)/i.test(content)).toBe(false);

    expect(/ON\s+public\.kudos\s+FOR\s+SELECT[\s\S]*public\.posts[\s\S]*kudos\.post_id/i.test(content)).toBe(true);
    expect(/ON\s+public\.comments\s+FOR\s+SELECT[\s\S]*public\.posts[\s\S]*comments\.post_id/i.test(content)).toBe(true);
    expect(/ON\s+public\.comment_reactions\s+FOR\s+SELECT[\s\S]*public\.comments[\s\S]*comment_reactions\.comment_id/i.test(content)).toBe(true);
    expect(/ON\s+public\.kudos\s+FOR\s+INSERT[\s\S]*WITH\s+CHECK[\s\S]*public\.posts[\s\S]*kudos\.post_id/i.test(content)).toBe(true);
    expect(/ON\s+public\.comments\s+FOR\s+INSERT[\s\S]*WITH\s+CHECK[\s\S]*public\.posts[\s\S]*comments\.post_id/i.test(content)).toBe(true);
    expect(/ON\s+public\.comment_reactions\s+FOR\s+INSERT[\s\S]*WITH\s+CHECK[\s\S]*public\.comments[\s\S]*comment_reactions\.comment_id/i.test(content)).toBe(true);
  });
});
