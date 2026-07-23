import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "../../../../supabase/migrations");
const DIRECT_USAGE_REPAIR_ROLLBACK =
  "20260507000200_rollback_codex_sql_repairs.sql";

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

  it("latest cli_auth_codes hardening removes public grants and pending-code select policies", () => {
    const latest = getLatestMigrationMatching(
      migrations,
      /public\.cli_auth_codes[\s\S]*(REVOKE\s+ALL|DROP\s+POLICY)/i
    );

    expect(latest, "Expected cli_auth_codes hardening migration").toBeTruthy();
    const content = latest!.content;

    expect(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.cli_auth_codes\s+FROM\s+anon/i.test(content)).toBe(true);
    expect(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.cli_auth_codes\s+FROM\s+authenticated/i.test(content)).toBe(true);
    expect(/GRANT\s+SELECT\s+ON\s+(TABLE\s+)?public\.cli_auth_codes\s+TO\s+anon/i.test(content)).toBe(false);
    expect(/GRANT\s+SELECT[^;]+public\.cli_auth_codes[^;]+authenticated/i.test(content)).toBe(false);
    expect(/CREATE\s+POLICY[\s\S]*ON\s+(TABLE\s+)?public\.cli_auth_codes[\s\S]*status\s*=\s*'pending'/i.test(content)).toBe(false);
    expect(/DROP\s+POLICY\s+IF\s+EXISTS\s+"Users can view own cli auth codes"/i.test(content)).toBe(true);
    expect(/DROP\s+POLICY\s+IF\s+EXISTS\s+"Authenticated users can verify pending codes"/i.test(content)).toBe(true);
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

  it("leaderboard and profile snapshots are private and refreshed atomically", () => {
    const latest = getLatestMigrationMatching(
      migrations,
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.leaderboard_snapshots/i
    );

    expect(latest, "Expected the M4 snapshot migration").toBeTruthy();
    const content = latest!.content;

    expect(/ALTER\s+TABLE\s+public\.leaderboard_snapshots\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(content)).toBe(true);
    expect(/ALTER\s+TABLE\s+public\.profile_stats_snapshots\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(content)).toBe(true);
    expect(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.leaderboard_snapshots\s+FROM\s+anon/i.test(content)).toBe(true);
    expect(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.profile_stats_snapshots\s+FROM\s+authenticated/i.test(content)).toBe(true);
    expect(/pg_try_advisory_xact_lock/i.test(content)).toBe(true);
    expect(/ON\s+CONFLICT\s*\(period,\s*user_id\)\s+DO\s+UPDATE/i.test(content)).toBe(true);
    expect(/DELETE\s+FROM\s+public\.profile_stats_snapshots[\s\S]*refreshed_at\s*<>\s*v_refreshed_at/i.test(content)).toBe(true);
    expect(/RANK\(\)\s+OVER\s*\(ORDER\s+BY\s+output_value\)\s*-\s*1/i.test(content)).toBe(true);
    expect(/community_distribution/i.test(content)).toBe(true);
    expect(/SELECT\s+COUNT\(\*\)\s+FROM\s+profile_values\s+AS\s+value/i.test(content)).toBe(false);
    expect(/SELECT\s+public\.refresh_leaderboard_snapshots\(\)/i.test(content)).toBe(true);
    expect(/'\*\/10 \* \* \* \*'/i.test(content)).toBe(true);
  });

  it("profile stats request RPC is a service-only one-row snapshot read", () => {
    const latest = getLatestMigrationMatching(
      migrations,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_profile_stats/i
    );

    expect(latest, "Expected get_profile_stats migration").toBeTruthy();
    const definition = latest!.content.slice(
      latest!.content.search(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_profile_stats/i)
    );

    expect(/SECURITY\s+DEFINER/i.test(definition)).toBe(true);
    expect(/SET\s+search_path\s*=\s*''/i.test(definition)).toBe(true);
    expect(/FROM\s+public\.profile_stats_snapshots/i.test(definition)).toBe(true);
    expect(/FROM\s+public\.(daily_usage|follows|posts|kudos)/i.test(definition.split("$$;")[0])).toBe(false);
    expect(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_profile_stats\(UUID\)\s+FROM\s+PUBLIC/i.test(definition)).toBe(true);
    expect(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_profile_stats\(UUID\)\s+TO\s+service_role/i.test(definition)).toBe(true);
    expect(/GRANT\s+EXECUTE[^;]+get_profile_stats[^;]+TO\s+(anon|authenticated)/i.test(definition)).toBe(false);
  });

  it("calculate_user_streak is set-based and keeps timezone and freeze semantics", () => {
    const latest = getLatestMigrationMatching(
      migrations,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.calculate_user_streak/i
    );

    expect(latest, "Expected calculate_user_streak migration").toBeTruthy();
    const content = latest!.content;
    expect(/ROW_NUMBER\(\)\s+OVER\s*\(ORDER\s+BY\s+date\s+DESC\)/i.test(content)).toBe(true);
    expect(/AT\s+TIME\s+ZONE\s+v_user_timezone/i.test(content)).toBe(true);
    expect(/v_grace\s*:=\s*1\s*\+\s*p_freeze_days/i.test(content)).toBe(true);
    expect(/^\s*LOOP\s*;?\s*$/im.test(content.slice(0, content.indexOf("CREATE OR REPLACE FUNCTION public.get_profile_stats")))).toBe(false);
  });

  it("adds a covering date-window leaderboard index", () => {
    const latest = getLatestMigrationMatching(
      migrations,
      /idx_daily_usage_leaderboard_covering/i
    );

    expect(latest).toBeTruthy();
    expect(/ON\s+public\.daily_usage\s*\(date\s+DESC,\s*user_id\)\s*INCLUDE\s*\(cost_usd,\s*output_tokens\)/i.test(latest!.content)).toBe(true);
  });

  it("indexes the leaderboard snapshot user foreign key without removing the region index", () => {
    const userIndex = getLatestMigrationMatching(
      migrations,
      /idx_leaderboard_snapshots_user_id/i
    );
    const regionIndex = getLatestMigrationMatching(
      migrations,
      /idx_leaderboard_snapshots_period_region_cost/i
    );

    expect(userIndex).toBeTruthy();
    expect(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_leaderboard_snapshots_user_id\s+ON\s+public\.leaderboard_snapshots\s*\(user_id\)/i.test(
        userIndex!.content
      )
    ).toBe(true);
    expect(regionIndex).toBeTruthy();
    expect(
      /ON\s+public\.leaderboard_snapshots\s*\(period,\s*region,\s*total_cost\s+DESC,\s*user_id\)/i.test(
        regionIndex!.content
      )
    ).toBe(true);
  });

  it("does not ship heuristic SQL repairs for historical Codex usage", () => {
    const abandonedRepairMigrations = migrations.filter((m) =>
      /repair_(legacy|native).*codex_inflation|restore_claude_costs_after_codex_repair|repair_codex_only_v3/i.test(m.name)
    );

    expect(abandonedRepairMigrations.length).toBeGreaterThan(0);

    for (const migration of abandonedRepairMigrations) {
      expect(
        migration.content,
        `${migration.name} must stay no-op; Codex healing belongs to the user's next CLI push.`,
      ).toMatch(/Intentionally no-op/i);
      expect(migration.content).not.toMatch(/UPDATE\s+public\.(daily_usage|device_usage)/i);
      expect(migration.content).not.toMatch(/INSERT\s+INTO\s+public\.corrections_log/i);
    }
  });

  it("does not add future migrations that rewrite usage totals directly", () => {
    const futureMigrations = migrations.filter(
      (migration) =>
        migration.name > DIRECT_USAGE_REPAIR_ROLLBACK
        && migration.name !== DIRECT_USAGE_REPAIR_ROLLBACK,
    );

    for (const migration of futureMigrations) {
      expect(
        migration.content,
        `${migration.name} must not directly rewrite usage totals. Heal incorrect Codex usage by re-pushing from the CLI source logs instead.`,
      ).not.toMatch(
        /\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+public\.(daily_usage|device_usage)\b/i,
      );
    }
  });

  it("rollback migration does not undo rows already healed by the fixed CLI collector", () => {
    const rollbackMigration = migrations.find(
      (migration) => migration.name === DIRECT_USAGE_REPAIR_ROLLBACK,
    );

    expect(rollbackMigration, "Expected direct SQL repair rollback migration").toBeTruthy();
    const content = rollbackMigration!.content;

    expect(content).toMatch(/v_fixed_codex_collector\s+text\s*:=\s*'straude-codex-native-last-token-usage'/i);
    expect(
      content.match(/COALESCE\(du\.collector_meta->>'codex', ''\)\s*<>\s*v_fixed_codex_collector/gi)?.length,
    ).toBeGreaterThanOrEqual(3);
    for (const column of [
      "cost_usd",
      "input_tokens",
      "output_tokens",
      "cache_creation_tokens",
      "cache_read_tokens",
      "total_tokens",
    ]) {
      expect(
        content.match(new RegExp(`${column}\\s*=`, "gi"))?.length,
        `rollback must restore ${column} on daily_usage and device_usage`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
