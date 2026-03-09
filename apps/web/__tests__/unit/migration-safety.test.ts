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
});
