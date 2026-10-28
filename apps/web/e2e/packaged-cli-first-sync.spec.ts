import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// General builds and installs the candidate once. This suite must consume those
// exact bytes, rather than accidentally testing the registry's mutable latest.
const install = process.env.STRAUDE_E2E_CLI_INSTALL;
const tarball = process.env.STRAUDE_E2E_CLI_TARBALL;
const sourceCommit = process.env.STRAUDE_E2E_CLI_COMMIT;
const fileEnv = (() => {
  try {
    return new Map(readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
      .split("\n").filter(line => line.trim() && !line.trim().startsWith("#"))
      .map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"(.*)"$/, "$1")];
      }));
  } catch { return new Map<string, string>(); }
})();
const value = (key: string) => process.env[key] || fileEnv.get(key) || "";
const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = value("SUPABASE_SECRET_KEY");

function local(url: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}

function admin() {
  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function redact(text: string) {
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]")
    .replace(/([?&](?:verify_secret|poll_secret|token|code)=)[^&\s]+/g, "$1[redacted]")
    .replace(/packaged-browser-[^\s@]+@local\.test/g, "[synthetic local email]");
}

async function signup(page: Page, request: APIRequestContext, email: string) {
  await expect(page).toHaveURL(/\/signup(?:\?|$)/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send magic link", exact: true }).click();
  await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
  const mail = new URL(supabaseUrl);
  mail.port = String(Number(mail.port) + 3);
  let id = "";
  await expect.poll(async () => {
    const response = await request.get(new URL(`/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, mail).href);
    expect(response.ok()).toBe(true);
    id = (await response.json()).messages?.[0]?.ID ?? "";
    return Boolean(id);
  }, { timeout: 20_000 }).toBe(true);
  const response = await request.get(new URL(`/api/v1/message/${id}`, mail).href);
  expect(response.ok()).toBe(true);
  const message = await response.json();
  const link = String(message.HTML).match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!link) throw new Error("Local signup email did not contain a verification link");
  await page.goto(link);
}

async function cleanup(email: string) {
  const db = admin();
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  expect(error).toBeNull();
  const user = data.users.find(candidate => candidate.email === email);
  if (!user) return;
  expect((await db.auth.admin.deleteUser(user.id)).error).toBeNull();
  for (const table of ["users", "daily_usage", "usage_agent_daily", "device_usage", "posts"]) {
    const key = table === "users" ? "id" : "user_id";
    const remaining = await db.from(table).select(key).eq(key, user.id);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([]);
  }
}

async function cliFixture(testInfo: TestInfo) {
  const root = await mkdtemp(join(tmpdir(), "straude-browser-cli-"));
  const home = join(root, "home");
  const codex = join(home, "codex");
  await mkdir(join(home, ".claude", "projects"), { recursive: true });
  await mkdir(join(home, ".straude"), { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const binary = join(install!, "node_modules", "straude", "dist", "index.js");
  const pkg = JSON.parse(await readFile(join(install!, "node_modules", "straude", "package.json"), "utf8"));
  const collector = JSON.parse(await readFile(join(install!, "node_modules", "ccusage", "package.json"), "utf8"));
  const metadata = {
    source_commit: sourceCommit, tarball_sha256: createHash("sha256").update(await readFile(tarball!)).digest("hex"),
    cli_version: pkg.version, collector_version: collector.version, node: process.version,
    environment: "local app + local Supabase + local email + synthetic native Codex sessions", csp_bypassed: false,
  };
  await testInfo.attach("installed-candidate", { body: JSON.stringify(metadata, null, 2), contentType: "application/json" });
  const environment = {
    ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codex,
    CLAUDE_CONFIG_DIR: join(home, ".claude"), STRAUDE_TELEMETRY_DISABLED: "1", TZ: "UTC",
  };
  let sequence = 0;
  const start = (args: string[]) => {
    const started = Date.now();
    const child = spawn(process.execPath, [binary, ...args], { cwd: install!, env: environment, stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    const finished = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveResult, reject) => {
      child.once("error", reject);
      child.once("close", async code => {
        try {
          await testInfo.attach(`cli-${++sequence}-${args[0] ?? "push"}`, {
            body: JSON.stringify({ command: ["node", "installed/straude/dist/index.js", ...args], started_at: new Date(started).toISOString(), duration_ms: Date.now() - started, exit_code: code, stdout: redact(stdout), stderr: redact(stderr) }, null, 2),
            contentType: "application/json",
          });
          resolveResult({ code, stdout, stderr });
        } catch (error) { reject(error); }
      });
    });
    return { child, finished, output: () => stdout + stderr };
  };
  async function run(args: string[], code = 0) {
    const result = await start(args).finished;
    expect(result.code, redact(result.stdout + result.stderr)).toBe(code);
    return result;
  }
  async function logs() {
    await cp(resolve(process.cwd(), "../../packages/cli/__tests__/fixtures/ccusage-gpt-5.6/codex"), codex, { recursive: true });
    for (const file of await readdir(join(codex, "sessions"))) {
      const path = join(codex, "sessions", file);
      await writeFile(path, (await readFile(path, "utf8")).replaceAll("2026-07-09", date));
    }
  }
  const state = async (name: string) => JSON.parse(await readFile(join(home, ".straude", `${name}.json`), "utf8"));
  const save = async (name: string, data: unknown) => writeFile(join(home, ".straude", `${name}.json`), JSON.stringify(data), { mode: 0o600 });
  const clearLogs = () => rm(codex, { recursive: true, force: true });
  return { root, date, metadata, start, run, logs, clearLogs, state, save };
}

type Cli = Awaited<ReturnType<typeof cliFixture>>;

async function authorize(cli: Cli, page: Page, origin: string, beforeAuthorize?: (page: Page) => Promise<void>) {
  const login = cli.start(["login", "--api-url", origin]);
  try {
    let url = "";
    await expect.poll(() => {
      url = login.output().match(/https?:\/\/[^\s]+\/cli\/verify\?[^\s]+/)?.[0] ?? "";
      return Boolean(url);
    }, { timeout: 30_000 }).toBe(true);
    expect(new URL(url).origin).toBe(origin);
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    if (beforeAuthorize) await beforeAuthorize(page);
    await page.getByRole("button", { name: "Authorize CLI", exact: true }).click();
    await expect(page.getByText("CLI authorized", { exact: true })).toBeVisible();
    expect((await login.finished).code).toBe(0);
  } finally {
    if (login.child.exitCode === null) login.child.kill("SIGTERM");
  }
}

async function storedUsage(userId: string) {
  const db = admin();
  const [daily, devices, sources, posts, outcomes] = await Promise.all([
    db.from("daily_usage").select("id,date,total_tokens,cost_usd,models").eq("user_id", userId),
    db.from("device_usage").select("date,total_tokens,cost_usd").eq("user_id", userId),
    db.from("usage_agent_daily").select("date,agent,total_tokens,cost_usd,collector").eq("user_id", userId),
    db.from("posts").select("id,daily_usage_id").eq("user_id", userId),
    db.from("usage_submission_outcomes").select("request_id,date,outcome").eq("user_id", userId),
  ]);
  for (const result of [daily, devices, sources, posts, outcomes]) expect(result.error).toBeNull();
  return { daily: daily.data!, devices: devices.data!, sources: sources.data!, posts: posts.data!, outcomes: outcomes.data! };
}

async function assertAccepted(page: Page, cli: Cli, userId: string, testInfo: TestInfo) {
  const stored = await storedUsage(userId);
  expect(stored.daily).toHaveLength(1);
  expect(stored.devices).toHaveLength(1);
  expect(stored.sources).toHaveLength(1);
  expect(stored.posts).toHaveLength(1);
  const daily = stored.daily[0];
  expect(Number(daily.total_tokens)).toBe(440_000);
  expect(Number(daily.cost_usd)).toBeGreaterThan(0);
  expect(daily.models).toHaveLength(4);
  expect(stored.posts[0].daily_usage_id).toBe(daily.id);
  for (const layer of [stored.devices[0], stored.sources[0]]) {
    expect(Number(layer.total_tokens)).toBe(Number(daily.total_tokens));
    expect(Number(layer.cost_usd)).toBeCloseTo(Number(daily.cost_usd), 5);
    expect(layer.date).toBe(cli.date);
  }
  expect(stored.sources[0]).toMatchObject({ agent: "codex", collector: { version: cli.metadata.collector_version, pricing_mode: "online" } });
  const response = await page.request.get("/api/usage/status");
  expect(response.status()).toBe(200);
  const status = await response.json();
  expect(status).toMatchObject({ has_usage: true, total_tokens: Number(daily.total_tokens), latest_usage_id: daily.id, latest_post_url: `/post/${stored.posts[0].id}` });
  expect(status.cost_usd).toBe(Math.round(Number(daily.cost_usd) * 100) / 100);
  await testInfo.attach("accepted-storage-comparison", { body: JSON.stringify({ ...stored, status }, null, 2), contentType: "application/json" });
  return stored;
}

function signedToken(payload: Record<string, unknown>) {
  const key = value("CLI_JWT_SECRET");
  if (!key) throw new Error("Local CLI_JWT_SECRET is required for signed expiry/rotation fixtures");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.${createHmac("sha256", key).update(`${header}.${body}`).digest("base64url")}`;
}

test.describe("installed CLI and browser first sync", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!install || !tarball || !sourceCommit, "Requires the exact candidate install, tarball and source commit via STRAUDE_E2E_CLI_*.");
    test.skip(!supabaseUrl || !secretKey, "Requires local Supabase fixture credentials.");
    expect(local(supabaseUrl), "Fixture operations must stay on loopback").toBe(true);
    expect(local(String(testInfo.project.use.baseURL))).toBe(true);
    expect(testInfo.project.use.bypassCSP ?? false).toBe(false);
  });

  test("web signup collects native logs, retries completion, and recovers expired CLI sign-in", async ({ page, request }, testInfo) => {
    test.setTimeout(300_000);
    const email = `packaged-browser-${randomUUID()}@local.test`;
    const cli = await cliFixture(testInfo);
    const origin = String(testInfo.project.use.baseURL);
    try {
      const signupResponse = await page.goto("/signup");
      expect(signupResponse?.headers()["content-security-policy"]).toContain("connect-src");
      const acceptAnalytics = page.getByRole("button", { name: "Accept all", exact: true });
      if (await acceptAnalytics.isVisible()) await acceptAnalytics.click();
      await signup(page, request, email);
      await expect(page).toHaveURL(/\/onboarding$/);
      const profile = await (await page.request.get("/api/users/me")).json();
      expect(profile.onboarding_completed).toBe(false);
      await expect(page.locator("#sync-command")).toBeVisible();
      const verification = await page.context().newPage();
      await authorize(cli, verification, origin);
      await verification.close();

      // This independent dashboard check also leaves a useful auth receipt if
      // the environment later blocks the native collector's pricing transport.
      const config = await cli.state("config");
      const now = Math.floor(Date.now() / 1000);
      const originalIat = now - 8 * 86400;
      const old = signedToken({ sub: profile.id, iat: originalIat, oiat: originalIat, exp: originalIat + 30 * 86400 });
      await cli.save("config", { ...config, token: old });
      await cli.run(["status", "--non-interactive"]);
      const rotated = await cli.state("config");
      expect(rotated.token).not.toBe(old);
      const claims = JSON.parse(Buffer.from(rotated.token.split(".")[1], "base64url").toString());
      expect(claims).toMatchObject({ sub: profile.id, oiat: originalIat, exp: originalIat + 30 * 86400 });
      const expired = signedToken({ sub: profile.id, iat: now - 31 * 86400, oiat: now - 31 * 86400, exp: now - 86400 });
      await cli.save("config", { ...rotated, token: expired });
      const expiredStatus = await cli.run(["status", "--non-interactive"], 1);
      expect(expiredStatus.stdout + expiredStatus.stderr).not.toContain("Opening browser");
      // Dashboard reads do not record accepted usage or submission health.
      await expect(readFile(join(cli.root, "home", ".straude", "sync-health.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      const freshSignIn = await page.context().newPage();
      await authorize(cli, freshSignIn, origin);
      await freshSignIn.close();
      await cli.run(["status", "--non-interactive"]);
      await expect(readFile(join(cli.root, "home", ".straude", "sync-health.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await testInfo.attach("real-device-auth-and-rotation", { body: JSON.stringify({ user_id: profile.id, device_login: true, rotated_claims: claims, expired_dashboard_exit: expiredStatus.code, browser_reauthentication: true }, null, 2), contentType: "application/json" });
      await cli.logs();

      // Interrupt only the completion transport after the genuine sync. Neither
      // auth nor collection nor submission success is mocked.
      let interrupted = false;
      await page.route("**/api/users/me", async route => {
        const body = route.request().postDataJSON();
        if (!interrupted && route.request().method() === "PATCH" && body?.onboarding_completed) {
          interrupted = true;
          await route.abort("failed");
        } else await route.continue();
      });
      await cli.run(["push", "--date", cli.date, "--non-interactive"]);
      await expect(page.getByRole("button", { name: "Retry setup", exact: true })).toBeVisible({ timeout: 20_000 });
      const beforeRetry = await assertAccepted(page, cli, profile.id, testInfo);
      expect((await (await page.request.get("/api/users/me")).json()).onboarding_completed).toBe(false);
      await page.getByRole("button", { name: "Retry setup", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Your first sync is complete" })).toBeVisible();
      await expect(page.locator("dl")).toContainText(`$${Number(beforeRetry.daily[0].cost_usd).toFixed(2)}`);
      await expect(page.locator("dl")).toContainText("440k");
      const github = page.getByRole("radio", { name: "GitHub", exact: true });
      await page.locator("label").filter({ has: github }).click();
      await page.getByLabel("Anything more specific?", { exact: false }).fill("  Native collector browser journey  ");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("button", { name: "View synced post", exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("real-cli-first-sync.png"), fullPage: true });
      await page.getByRole("button", { name: "View synced post", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/post/${beforeRetry.posts[0].id}$`));
      await expect(page.getByRole("heading", { name: "Post", exact: true })).toBeVisible();
      await expect(page.locator("main")).toContainText(`$${Number(beforeRetry.daily[0].cost_usd).toFixed(2)}`);
      await page.reload();
      const completed = await (await page.request.get("/api/users/me")).json();
      expect(completed).toMatchObject({ onboarding_completed: true, heard_about_sources: ["github"], heard_about: "Native collector browser journey" });
      expect((await storedUsage(profile.id)).posts).toEqual(beforeRetry.posts);

      // Expiry uses a legitimately expired thirty-day chain, not a synthetic401.
      await cli.save("config", { ...await cli.state("config"), token: expired });
      const codesBefore = await admin().from("cli_auth_codes").select("id");
      expect(codesBefore.error).toBeNull();
      const rejected = await cli.run(["push", "--date", cli.date, "--non-interactive"], 2);
      expect(rejected.stdout + rejected.stderr).toContain("straude login");
      expect(rejected.stdout + rejected.stderr).not.toContain("Opening browser");
      const codesAfter = await admin().from("cli_auth_codes").select("id");
      expect(codesAfter.error).toBeNull();
      expect(codesAfter.data).toEqual(codesBefore.data);
      const pending = await cli.state("pending-sync");
      expect(pending.batches).toHaveLength(1);
      const health = await cli.state("sync-health");
      expect(health.auth_required_at).toBeTruthy();
      const watermark = (await cli.state("config")).last_push_date;
      await cli.run(["push", "--date", cli.date, "--dry-run", "--non-interactive"]);
      expect(await cli.state("pending-sync")).toEqual(pending);
      expect(await cli.state("sync-health")).toEqual(health);
      await cli.clearLogs();
      await cli.run(["push", "--date", cli.date, "--non-interactive"], 2);
      expect(await cli.state("pending-sync")).toEqual(pending);
      const stillBlockedHealth = await cli.state("sync-health");
      expect(stillBlockedHealth.account_key).toBe(health.account_key);
      expect(stillBlockedHealth.last_success_at).toBe(health.last_success_at);
      expect(stillBlockedHealth.auth_required_at).toBeTruthy();
      await cli.logs();
      const recovery = await page.context().newPage();
      await authorize(cli, recovery, origin);
      await recovery.close();
      expect(await cli.state("sync-health")).toEqual(stillBlockedHealth);
      expect((await cli.state("config")).last_push_date).toBe(watermark);
      await cli.run(["push", "--date", cli.date, "--non-interactive"]);
      expect((await cli.state("pending-sync")).batches).toEqual([]);
      expect((await cli.state("sync-health")).auth_required_at).toBeUndefined();
      const recovered = await assertAccepted(page, cli, profile.id, testInfo);
      expect(recovered.posts).toEqual(beforeRetry.posts);
      expect(recovered.outcomes.filter(row => row.request_id === pending.batches[0].request.request_id)).toHaveLength(1);
      await testInfo.attach("real-auth-recovery", { body: JSON.stringify({ rotated_claims: claims, expired_exit: rejected.code, pending_request_id: pending.batches[0].request.request_id, watermark_preserved: true, accepted_pending_once: true }, null, 2), contentType: "application/json" });
    } finally {
      try { await cleanup(email); }
      finally { await rm(cli.root, { recursive: true, force: true }); }
    }
  });

  test("CLI-first email signup opens Settings, keeps missing logs incomplete, then syncs", async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    const email = `packaged-browser-${randomUUID()}@local.test`;
    const cli = await cliFixture(testInfo);
    try {
      await authorize(cli, page, String(testInfo.project.use.baseURL), async verification => {
        await verification.getByRole("button", { name: "Sign in to authorize", exact: true }).click();
        await expect(verification).toHaveURL(/\/login\?/);
        await verification.waitForLoadState("networkidle");
        await verification.getByRole("link", { name: "Sign up", exact: true }).click();
        await signup(verification, request, email);
        await expect(verification).toHaveURL(/\/cli\/verify\?/);
      });
      const settings = await page.goto("/settings");
      expect(settings?.status()).toBe(200);
      expect(settings?.headers()["content-security-policy"]).toContain("connect-src");
      const me = await page.request.get("/api/users/me");
      expect(me.status()).toBe(200);
      expect(me.headers()["content-type"]).toContain("application/json");
      const initialProfile = await me.json();
      const config = await cli.state("config");
      const claims = JSON.parse(Buffer.from(config.token.split(".")[1], "base64url").toString());
      expect(initialProfile.id).toBe(claims.sub);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.getByLabel("Display Name", { exact: true }).fill("Local CLI first");
      const saved = page.waitForResponse(response => response.url().endsWith("/api/users/me") && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "Save Changes", exact: true }).focus();
      await page.keyboard.press("Enter");
      const savedResponse = await saved;
      expect(savedResponse.status()).toBe(200);
      expect(savedResponse.headers()["content-type"]).toContain("application/json");
      await page.reload();
      await expect(page.getByLabel("Display Name", { exact: true })).toHaveValue("Local CLI first");
      const profile = await (await page.request.get("/api/users/me")).json();
      expect(profile.onboarding_completed).toBe(false);
      await page.screenshot({ path: testInfo.outputPath("cli-first-settings-360.png"), fullPage: true });
      await testInfo.attach("cli-first-settings-result", { body: JSON.stringify({ user_id: profile.id, cli_subject: claims.sub, get_me_status: me.status(), patch_me_status: savedResponse.status(), display_name: profile.display_name, onboarding_completed: profile.onboarding_completed }, null, 2), contentType: "application/json" });
      const empty = await cli.run(["push", "--date", cli.date, "--non-interactive"]);
      expect(empty.stdout + empty.stderr).toContain("No usage data");
      await expect(readFile(join(cli.root, "home", ".straude", "sync-health.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect((await storedUsage(profile.id)).daily).toEqual([]);
      await page.goto("/onboarding");
      await expect(page.getByText("Waiting for your first sync. This page checks automatically.")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("cli-first-missing-logs-360.png"), fullPage: true });
      await cli.logs();
      await cli.run(["push", "--date", cli.date, "--non-interactive"]);
      await expect(page.getByRole("heading", { name: "Your first sync is complete" })).toBeVisible({ timeout: 20_000 });
      await assertAccepted(page, cli, profile.id, testInfo);
      expect((await (await page.request.get("/api/users/me")).json()).onboarding_completed).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("cli-first-completed-360.png"), fullPage: true });
    } finally {
      try { await cleanup(email); }
      finally { await rm(cli.root, { recursive: true, force: true }); }
    }
  });
});
