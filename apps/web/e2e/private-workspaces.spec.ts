import { test, expect, type Browser, type BrowserContext, type APIResponse } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { loadWebEnv } from "./perf/env";
import { createCliToken } from "../lib/api/cli-auth";

const exec = promisify(execFile);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const monday = shift(today, -((new Date().getUTCDay() + 6) % 7));
const previousMonday = shift(monday, -7);
const nativeDay = shift(previousMonday, -1);

async function json(response: APIResponse, status = 200) {
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(status);
  return body;
}

type Actor = { id: string; email: string; username: string; context: BrowserContext; db: SupabaseClient };

function agent(cost: number, tokens: number, tool = "codex", model = "gpt-5.6") {
  const usage = { input_tokens: tokens, output_tokens: 0, reasoning_output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: tokens, cost_usd: cost };
  return { agent: tool, models: [model], ...usage, model_breakdown: [{ model, ...usage }] };
}

test("private workspace browser journey, CLI enrollment, report accuracy and revoked access", async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  const env = loadWebEnv();
  for (const url of [env.NEXT_PUBLIC_SUPABASE_URL, baseURL]) {
    if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)) {
      throw new Error("Private workspace E2E requires loopback app and Supabase URLs.");
    }
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const actors: Actor[] = [];
  const workspaces: string[] = [];
  const cliDirectory = await mkdtemp(join(tmpdir(), "straude-private-workspace-"));
  const evidenceDirectory = resolve(process.cwd(), "test-results/private-workspaces-evidence");
  await mkdir(evidenceDirectory, { recursive: true });
  const transcript: string[] = [];

  async function actor(label: string, browserInstance: Browser): Promise<Actor> {
    const id = randomUUID();
    const email = `workspace-${label}-${id}@example.test`;
    const password = randomUUID();
    const username = `ws_${id.slice(0, 8)}`;
    expect((await admin.auth.admin.createUser({ id, email, password, email_confirm: true })).error).toBeNull();
    expect((await admin.from("users").upsert({ id, username, display_name: `Example ${label}`, is_public: false, onboarding_completed: false, timezone: "UTC" })).error).toBeNull();
    const jar = new Map<string, string>();
    const db = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies: { name: string; value: string }[]) => { for (const cookie of cookies) jar.set(cookie.name, cookie.value); },
      },
    });
    expect((await db.auth.signInWithPassword({ email, password })).error).toBeNull();
    const context = await browserInstance.newContext({ baseURL });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL!, sameSite: "Lax" })));
    const result = { id, email, username, context, db };
    actors.push(result);
    return result;
  }

  async function source(person: Actor, workspace: string, name: string) {
    return (await json(await person.context.request.post(`/api/workspaces/${workspace}/sources`, {
      data: { name, installation_id: randomUUID(), work_only: true },
    }))).source;
  }

  async function sync(person: Actor, workspace: string, workSource: { id: string; installation_id: string }, entries: object[], status = 200) {
    return json(await person.context.request.post(`/api/workspaces/${workspace}/sync`, {
      data: { source_id: workSource.id, installation_id: workSource.installation_id, timezone: "UTC", entries },
    }), status);
  }

  async function denied(person: Actor, workspace: string) {
    for (const path of ["", "/report", "/report?format=csv"]) {
      expect((await person.context.request.get(`/api/workspaces/${workspace}${path}`)).status()).toBe(403);
    }
    expect((await person.context.request.post(`/api/workspaces/${workspace}`, { data: { action: "invite", email: person.email } })).status()).toBe(403);
    for (const table of ["workspaces", "workspace_members", "workspace_invites", "workspace_sources", "workspace_usage_days"]) {
      expect((await person.db.from(table).select("*")).error, `direct read of ${table}`).not.toBeNull();
      expect((await person.db.from(table).delete().eq(table === "workspaces" ? "id" : "workspace_id", workspace)).error, `direct mutation of ${table}`).not.toBeNull();
    }
    expect((await person.db.rpc("workspace_action", { p_actor: person.id, p_action: "report", p_workspace: workspace, p_input: { start: previousMonday, end: today } })).error).not.toBeNull();
  }

  try {
    const owner = await actor("Owner", browser);
    const member = await actor("Engineer", browser);
    const outsider = await actor("Outsider", browser);
    const unsynced = await actor("Unconnected", browser);
    const ownerPage = await owner.context.newPage();
    const memberPage = await member.context.newPage();
    const personal = { user_id: member.id, date: monday, cost_usd: 77, input_tokens: 7700, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 7700, models: ["personal-model"], session_count: 1, is_verified: true, raw_hash: `personal-${member.id}` };
    expect((await admin.from("daily_usage").insert(personal)).error).toBeNull();

    // A private account without completed public onboarding can create a workspace by keyboard.
    await ownerPage.goto("/recap");
    await expect(ownerPage.getByRole("heading", { name: "Personal recap", exact: true })).toBeVisible();
    const listLoaded = ownerPage.waitForResponse(response => response.url().endsWith("/api/workspaces") && response.request().method() === "GET");
    await ownerPage.getByRole("link", { name: "Private workspaces", exact: true }).click();
    expect((await listLoaded).status()).toBe(200);
    await ownerPage.getByLabel("Workspace name").fill("Example Workshop");
    await expect(ownerPage.getByRole("button", { name: "Create workspace", exact: true })).toBeEnabled();
    await ownerPage.getByLabel("Workspace name").press("Enter");
    await expect(ownerPage).toHaveURL(/\/workspaces\/[0-9a-f-]+$/);
    const workspace = new URL(ownerPage.url()).pathname.split("/").at(-1)!;
    workspaces.push(workspace);
    await expect(ownerPage.getByRole("heading", { name: "Example Workshop", exact: true })).toBeVisible();
    await expect(ownerPage.getByText("No source connected · No data received", { exact: true })).toBeVisible();
    const second = (await json(await outsider.context.request.post("/api/workspaces", { data: { name: "Other Example Workshop" } }))).workspace.id;
    workspaces.push(second);
    await denied(outsider, workspace);
    await denied(owner, second);

    await ownerPage.getByLabel("Colleague’s email").fill(member.email);
    await ownerPage.getByLabel("Colleague’s email").press("Enter");
    const invitation = ownerPage.getByLabel("Invitation link", { exact: true });
    await expect(invitation).toBeVisible();
    const invitationUrl = await invitation.inputValue();
    // An invitation binds to the actual invited account, never a domain or badge.
    expect((await outsider.context.request.post("/api/workspaces/join", { data: { token: invitationUrl.split("/").at(-1) } })).status()).toBe(403);
    await memberPage.goto(invitationUrl);
    await expect(memberPage.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
    await memberPage.getByRole("checkbox").focus();
    await memberPage.keyboard.press("Space");
    await memberPage.keyboard.press("Tab");
    await memberPage.keyboard.press("Enter");
    await expect(memberPage).toHaveURL(new RegExp(`/workspaces/${workspace}$`));
    expect((await json(await member.context.request.get(`/api/workspaces/${workspace}`))).role).toBe("member");
    expect((await member.context.request.post(`/api/workspaces/${workspace}`, { data: { action: "remove", user_id: owner.id } })).status()).toBe(403);
    const revokedInvite = await json(await owner.context.request.post(`/api/workspaces/${workspace}`, { data: { action: "invite", email: unsynced.email } }));
    await json(await owner.context.request.post(`/api/workspaces/${workspace}`, { data: { action: "revoke", invite_id: revokedInvite.invite.id } }));
    expect((await unsynced.context.request.post("/api/workspaces/join", { data: { token: revokedInvite.token } })).status()).toBe(403);
    const goodInvite = await json(await owner.context.request.post(`/api/workspaces/${workspace}`, { data: { action: "invite", email: unsynced.email } }));
    await json(await unsynced.context.request.post("/api/workspaces/join", { data: { token: goodInvite.token } }));
    const neverSource = await source(unsynced, workspace, "Example never synced source");
    const ownerSource = await source(owner, workspace, "Example zero usage source");

    // Use the real device authorization API before launching the built CLI.
    const init = await json(await member.context.request.post("/api/auth/cli/init"));
    const verification = new URL(init.verify_url);
    await json(await member.context.request.post("/api/auth/cli/verify", { data: { code: init.code, verify_secret: verification.searchParams.get("verify_secret") } }));
    const authorization = await json(await member.context.request.post("/api/auth/cli/poll", { data: { code: init.code, poll_secret: init.poll_secret } }));
    expect(authorization.status).toBe("completed");
    const configDir = join(cliDirectory, ".straude");
    await mkdir(configDir, { recursive: true });
    const legacyDeviceId = randomUUID();
    await writeFile(join(configDir, "config.json"), JSON.stringify({ token: authorization.token, username: member.username, api_url: baseURL, device_id: legacyDeviceId, device_name: "Example work-only source" }));
    // Keep the host's HOME and CODEX_HOME untouched; enrollment only needs Node's home API.
    const preload = join(cliDirectory, "fixture-home.cjs");
    await writeFile(preload, `require('node:os').homedir = () => ${JSON.stringify(cliDirectory)}; require('node:module').syncBuiltinESMExports();`);
    const cliEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH, NODE_OPTIONS: `--require=${preload}`, NODE_ENV: "test",
      XDG_CONFIG_HOME: join(cliDirectory, ".config"), XDG_DATA_HOME: join(cliDirectory, ".local/share"),
      XDG_CACHE_HOME: join(cliDirectory, ".cache"), APPDATA: join(cliDirectory, "AppData/Roaming"),
      LOCALAPPDATA: join(cliDirectory, "AppData/Local"), SYSTEMROOT: process.env.SYSTEMROOT,
      STRAUDE_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1", TZ: "UTC", CI: "1",
    };
    const cliPath = resolve(process.cwd(), "../../packages/cli/dist/index.js");
    async function cli(args: string[], shouldSucceed = true) {
      try {
        const result = await exec(process.execPath, [cliPath, ...args], { env: cliEnv, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
        if (!shouldSucceed) throw new Error("Expected CLI operation to be refused");
        transcript.push(`straude ${args.join(" ")}\n${result.stdout}${result.stderr}`);
        return result.stdout;
      } catch (error) {
        if (shouldSucceed || !(error && typeof error === "object" && "code" in error)) throw error;
        const failure = error as { stdout?: string; stderr?: string };
        transcript.push(`straude ${args.join(" ")} [refused]\n${failure.stdout ?? ""}${failure.stderr ?? ""}`);
        return `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
      }
    }
    await cli(["workspace", "connect", workspace], false);
    expect((await admin.from("workspace_sources").select("id").eq("user_id", member.id)).data).toEqual([]);
    await cli(["workspace", "connect", workspace, "--work-only"]);
    const markerPath = join(configDir, "workspace.json");
    const marker = JSON.parse(await readFile(markerPath, "utf8"));
    expect(marker.start_date).toBe(shift(today, 1));
    const memberSource = (await admin.from("workspace_sources").select("*").eq("id", marker.source_id).single()).data!;
    expect(memberSource.previous_device_id).toBe(legacyDeviceId);
    await sync(member, workspace, memberSource, [{ date: today, agents: [agent(100, 1000)] }], 400);
    await cli(["push", "--date", today, "--non-interactive"], false);

    // An older client can label post-consent UTC usage with the previous local
    // date. Block public writes for enrolled identities even before start_date,
    // including the legacy config identity, while preserving stored personal history.
    for (const installationId of [marker.installation_id, legacyDeviceId]) {
      const publicV2 = await json(await member.context.request.post("/api/usage/submit", {
        headers: { Authorization: `Bearer ${authorization.token}` },
        data: {
          protocol_version: 2, request_id: randomUUID(), source: "cli", timezone: "America/Vancouver",
          installation: { id: installationId }, collector: { name: "ccusage", version: "20.0.26", pricing_mode: "online" },
          entries: [{ date: today, content_hash: "0".repeat(64), agents: [agent(1, 100)] }],
        },
      }), 400);
      expect(publicV2.outcomes).toMatchObject([{ status: "permanent_error", error: { code: "42501" } }]);
      const publicV1 = await json(await member.context.request.post("/api/usage/submit", {
        headers: { Authorization: `Bearer ${authorization.token}` },
        data: {
          source: "cli", device_id: installationId, collector: { ccusage_version: "20.0.26" },
          entries: [{ date: today, data: { date: today, models: ["gpt-5.6"], inputTokens: 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 100, costUSD: 1 } }],
        },
      }), 400);
      expect(publicV1.results).toEqual([]);
      expect(publicV1.errors).toHaveLength(1);
    }
    expect((await admin.from("daily_usage").select("cost_usd,total_tokens").eq("user_id", member.id)).data).toEqual([{ cost_usd: 77, total_tokens: 7700 }]);
    expect((await admin.from("posts").select("id").eq("user_id", member.id)).data).toEqual([]);

    // Fixture-only enrollment in the past lets a real collector exercise a week boundary.
    // Production source creation never accepts a historical start date.
    expect((await admin.from("workspace_sources").update({ start_date: nativeDay }).in("id", [memberSource.id, ownerSource.id, neverSource.id])).error).toBeNull();
    await writeFile(markerPath, JSON.stringify({ ...marker, start_date: nativeDay }));
    await sync(member, workspace, memberSource, [{ date: nativeDay, agents: [agent(1, 100)] }]);
    const actualDay = await admin.from("workspace_usage_days").select("agents").eq("source_id", memberSource.id).eq("date", nativeDay).single();
    expect(actualDay.error).toBeNull();
    expect(actualDay.data!.agents.length).toBeGreaterThan(0);
    expect(actualDay.data!.agents.reduce((sum: number, entry: { total_tokens: number }) => sum + entry.total_tokens, 0)).toBeGreaterThan(0);
    await cli(["workspace", "status"]);
    const receipt = (await admin.from("workspace_sources").select("last_received_at").eq("id", memberSource.id).single()).data;
    await sync(member, workspace, memberSource, [{ date: nativeDay, agents: [] }], 400);
    expect((await admin.from("workspace_usage_days").select("agents").eq("source_id", memberSource.id).eq("date", nativeDay).single()).data).toEqual(actualDay.data);
    expect((await admin.from("workspace_sources").select("last_received_at").eq("id", memberSource.id).single()).data).toEqual(receipt);

    // Separate known snapshots make the week-boundary arithmetic independent of live prices.
    const knownDays = [{ date: previousMonday, agents: [agent(2, 200)] }, { date: monday, agents: [agent(5, 500)] }, ...(today === monday ? [] : [{ date: today, agents: [] }])];
    await sync(member, workspace, memberSource, knownDays);
    await sync(member, workspace, memberSource, knownDays);
    await sync(owner, workspace, ownerSource, [{ date: monday, agents: [] }]);
    expect((await admin.from("workspace_sources").update({ last_received_at: `${shift(today, -3)}T00:00:00Z` }).eq("id", ownerSource.id)).error).toBeNull();
    const report = await json(await owner.context.request.get(`/api/workspaces/${workspace}/report?week=${monday}`));
    expect(report.current).toEqual({ estimated_value_usd: 5, tokens: 500 });
    expect(report.previous).toEqual({ estimated_value_usd: 2, tokens: 200 });
    expect(report.contributors).toMatchObject({ current: 2, previous: 1, common: 1, new: 1 });
    expect(report.same_contributors).toMatchObject({ current: { estimated_value_usd: 5, tokens: 500 }, previous: { estimated_value_usd: 2, tokens: 200 } });
    expect(report.coverage).toMatchObject({ stale_sources: 1, never_synced_sources: 1 });
    expect(report.period.incomplete).toBe(true);
    const csvResponse = await owner.context.request.get(`/api/workspaces/${workspace}/report?week=${monday}&format=csv`);
    expect(csvResponse.status()).toBe(200);
    const csv = await csvResponse.text();
    expect(csv).toContain('"total","estimated_value","","","5","2","estimated value USD at API prices; actual billed charges unknown"');
    expect(csv).toContain('"total","tokens","","","500","200","tokens"');
    expect(csv).toContain('"participation","contributors","","","2","1"');
    expect((await json(await outsider.context.request.get(`/api/workspaces/${second}/report`))).current.tokens).toBe(0);
    expect((await admin.from("daily_usage").select("cost_usd,total_tokens").eq("user_id", member.id)).data).toEqual([{ cost_usd: 77, total_tokens: 7700 }]);
    expect((await admin.from("posts").select("id").eq("user_id", member.id)).data).toEqual([]);
    expect((await outsider.context.request.get(`/api/users/${member.username}`)).status()).toBe(403);

    await ownerPage.reload();
    await expect(ownerPage.locator("dd").filter({ hasText: /^\$5\.00$/ })).toBeVisible();
    const download = ownerPage.waitForEvent("download");
    await ownerPage.getByRole("link", { name: "Export CSV" }).click();
    const exported = await download;
    expect(exported.suggestedFilename()).toMatch(/\.csv$/);
    const exportedPath = await exported.path();
    expect(await readFile(exportedPath!, "utf8")).toContain('"total","tokens","","","500","200","tokens"');
    await expect(ownerPage.getByText(/First sync confirmed/)).toBeVisible();
    await expect(ownerPage.getByText(/Stale — /)).toBeVisible();
    await expect(ownerPage.getByText(/Waiting for first sync/)).toBeVisible();
    await ownerPage.screenshot({ path: join(evidenceDirectory, "private-workspace-desktop.png"), fullPage: true });
    await ownerPage.setViewportSize({ width: 390, height: 844 });
    expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ownerPage.screenshot({ path: join(evidenceDirectory, "private-workspace-mobile.png"), fullPage: true });
    await ownerPage.getByRole("button", { name: "Remove Example Engineer", exact: true }).click();
    await expect.poll(async () => (await member.context.request.get(`/api/workspaces/${workspace}`)).status()).toBe(403);
    await denied(member, workspace);
    await sync(member, workspace, memberSource, [{ date: today, agents: [agent(999, 999)] }], 403);
    await cli(["workspace", "status"], false);
    expect((await json(await owner.context.request.get(`/api/workspaces/${workspace}/report?week=${monday}`))).current).toEqual(report.current);
    expect((await admin.from("daily_usage").select("cost_usd,total_tokens").eq("user_id", member.id)).data).toEqual([{ cost_usd: 77, total_tokens: 7700 }]);
    expect((await admin.from("posts").select("id").eq("user_id", member.id)).data).toEqual([]);
    await testInfo.attach("known-week-report", { body: JSON.stringify({ current: report.current, previous: report.previous, contributors: report.contributors, coverage: report.coverage }, null, 2), contentType: "application/json" });
    await testInfo.attach("weekly-report.csv", { body: csv, contentType: "text/csv" });
    await testInfo.attach("built-cli-transcript", { body: transcript.join("\n\n").replaceAll(workspace, "example-workspace").replaceAll(cliDirectory, "<temporary-work-source>"), contentType: "text/plain" });
    await writeFile(join(evidenceDirectory, "known-week-report.json"), JSON.stringify({ current: report.current, previous: report.previous, contributors: report.contributors, coverage: report.coverage }, null, 2));
    await writeFile(join(evidenceDirectory, "weekly-report.csv"), csv);
    await writeFile(join(evidenceDirectory, "built-cli-transcript.txt"), transcript.join("\n\n").replaceAll(workspace, "example-workspace").replaceAll(cliDirectory, "<temporary-work-source>"));
  } finally {
    // Delete only this test's workspaces/accounts; never reset a shared test database.
    for (const workspace of workspaces) expect((await admin.from("workspaces").delete().eq("id", workspace)).error).toBeNull();
    for (const person of actors) {
      await person.context.close();
      expect((await admin.auth.admin.deleteUser(person.id)).error).toBeNull();
    }
    await rm(cliDirectory, { recursive: true, force: true });
  }
});

test("built CLI collects native work usage and retries against the real private API", async ({ request, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(process.env.STRAUDE_E2E_SKIP_NETWORK_COLLECTOR === "1", "Cloud native collector cannot verify the pricing proxy certificate; run on CI with direct pricing access.");
  const env = loadWebEnv();
  for (const url of [env.NEXT_PUBLIC_SUPABASE_URL, baseURL]) {
    if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)) throw new Error("Native CLI E2E requires loopback app and database.");
  }
  process.env.CLI_JWT_SECRET = env.CLI_JWT_SECRET;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const id = randomUUID();
  const username = `native_${id.slice(0, 8)}`;
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "straude-native-work-"));
  let workspace: string | undefined;
  try {
    // Package managers may extract the native binary without execute bits. Its
    // official launcher repairs those bits, which must happen before the
    // dependency tree is mounted read-only in the isolated collector container.
    // --version never reads usage logs.
    const cliRequire = createRequire(resolve(process.cwd(), "../../packages/cli/package.json"));
    await exec(process.execPath, [cliRequire.resolve("ccusage/src/cli.js"), "--version"]);
    expect((await admin.auth.admin.createUser({ id, email: `native-${id}@example.test`, email_confirm: true })).error).toBeNull();
    expect((await admin.from("users").upsert({ id, username, is_public: false, timezone: "UTC", onboarding_completed: false })).error).toBeNull();
    const token = createCliToken(id, username);
    workspace = (await json(await request.post("/api/workspaces", { headers: { Authorization: `Bearer ${token}` }, data: { name: "Example native collector workspace" } }))).workspace.id;
    const configDirectory = join(fixtureDirectory, ".straude");
    await mkdir(configDirectory, { recursive: true });
    await mkdir(join(fixtureDirectory, ".codex/sessions"), { recursive: true });
    await writeFile(join(configDirectory, "config.json"), JSON.stringify({ token, username, api_url: baseURL, device_name: "Example native source" }));
    const log = await readFile(resolve(process.cwd(), "../../packages/cli/__tests__/fixtures/ccusage-gpt-5.6/codex/sessions/gpt-5.6.jsonl"), "utf8");
    await writeFile(join(fixtureDirectory, ".codex/sessions/example.jsonl"), log.replaceAll("2026-07-09", today) + "\n");
    const transcript: string[] = [];
    async function cli(args: string[]) {
      // The container's default home is a disposable bind mount. Neither the host's
      // HOME/CODEX_HOME nor any developer usage stores are passed to the collector.
      const output = await exec("docker", ["run", "--rm", "--network=host",
        "--mount", `type=bind,source=${resolve(process.cwd(), "../..")},target=/app,readonly`,
        "--mount", `type=bind,source=${fixtureDirectory},target=/root`,
        "-e", "STRAUDE_TELEMETRY_DISABLED=1", "-e", "DO_NOT_TRACK=1", "-e", "TZ=UTC", "-e", "CI=1",
        "-e", `STRAUDE_FIXTURE_OWNER=${process.getuid!()}:${process.getgid!()}`,
        "node:22-bookworm-slim", "sh", "-c",
        'node "$@"; straude_result=$?; chown -R "$STRAUDE_FIXTURE_OWNER" /root; exit "$straude_result"',
        "fixture-cli", "/app/packages/cli/dist/index.js", ...args,
      ], { timeout: 60_000 });
      transcript.push(`straude ${args.join(" ")}\n${output.stdout}${output.stderr}`);
    }
    await cli(["workspace", "connect", workspace!, "--work-only"]);
    const markerPath = join(configDirectory, "workspace.json");
    const marker = JSON.parse(await readFile(markerPath, "utf8"));
    expect((await admin.from("workspace_sources").update({ start_date: today }).eq("id", marker.source_id)).error).toBeNull();
    await writeFile(markerPath, JSON.stringify({ ...marker, start_date: today }));
    await cli(["push", "--date", today, "--non-interactive"]);
    const first = await admin.from("workspace_usage_days").select("agents").eq("source_id", marker.source_id);
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    expect(first.data![0].agents.reduce((total: number, item: { total_tokens: number }) => total + item.total_tokens, 0)).toBe(110000);
    await cli(["push", "--date", today, "--non-interactive"]);
    expect((await admin.from("workspace_usage_days").select("agents").eq("source_id", marker.source_id)).data).toEqual(first.data);
    expect((await admin.from("daily_usage").select("id").eq("user_id", id)).data).toEqual([]);
    expect((await admin.from("posts").select("id").eq("user_id", id)).data).toEqual([]);
    const evidenceDirectory = resolve(process.cwd(), "test-results/private-workspaces-evidence");
    await mkdir(evidenceDirectory, { recursive: true });
    const sanitized = transcript.join("\n\n").replaceAll(workspace!, "example-workspace").replaceAll(fixtureDirectory, "<temporary-work-source>");
    await writeFile(join(evidenceDirectory, "native-cli-transcript.txt"), sanitized);
    await testInfo.attach("native-cli-transcript", { body: sanitized, contentType: "text/plain" });
  } finally {
    if (workspace) expect((await admin.from("workspaces").delete().eq("id", workspace)).error).toBeNull();
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});
