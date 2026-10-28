import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ANALYTICS_BROWSER_USE, assertAnalyticsBrowser, configureAnalyticsBrowser } from "./helpers/analytics-browser";

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

type AnalyticsReceipt = {
  event: string;
  identity: string;
  insert_id: string | null;
  transport: string;
  has_analytics_consent: boolean | null;
};
type AnalyticsBoundary = {
  requests: { path: string; method: string }[];
  receiver: string | null;
  start: number;
};
const analytics = new Map<string, AnalyticsBoundary>();
const evidenceNames = new Set([
  "installed-candidate", "accepted-storage-comparison", "real-device-auth-and-rotation",
  "real-auth-recovery", "cli-first-settings-result", "combined-lifecycle-receiver",
  "browser-sdk-transport-boundary", "web-first-consent",
]);
const evidenceCounts = new Map<string, number>();

async function saveEvidence(testInfo: TestInfo, name: string, receipt: unknown) {
  if (!evidenceNames.has(name) && !/^cli-\d+-(?:login|push|status)$/.test(name)) {
    throw new Error("Receipt is not allowlisted for retained CI evidence");
  }
  function sanitize(value: unknown): unknown {
    if (typeof value === "string") return redact(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key,
        /^(?:token|access_token|refresh_token|authorization|api_key|.*secret.*|.*password.*|.*cookie.*|email|magic_link)$/i.test(key)
          ? "[redacted]" : sanitize(item),
      ]),
    );
    return value;
  }
  const key = testInfo.outputPath(name);
  const count = (evidenceCounts.get(key) ?? 0) + 1;
  evidenceCounts.set(key, count);
  const path = testInfo.outputPath(`${name}${count > 1 ? `-${count}` : ""}.evidence.json`);
  const body = `${JSON.stringify(sanitize(receipt), null, 2)}\n`;
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(path, body, { mode: 0o600 });
  await testInfo.attach(name, { body, contentType: "application/json" });
}

async function receiverEvents(page: Page, receiver: string): Promise<AnalyticsReceipt[]> {
  const response = await page.request.get(`${receiver}/events`);
  expect(response.status(), "Configured local analytics receiver must be available").toBe(200);
  return response.json();
}

async function assertLifecycle(page: Page, userId: string, testInfo: TestInfo) {
  const boundary = analytics.get(testInfo.testId)!;
  if (!boundary.receiver) return;
  const names = ["signup_completed", "first_sync_confirmed", "activation_completed"];
  const insertionId = (event: string) => createHash("sha256").update(`${event}:${userId}`).digest("hex").slice(0, 20);
  let received: AnalyticsReceipt[] = [];
  await expect.poll(async () => {
    received = (await receiverEvents(page, boundary.receiver!)).slice(boundary.start);
    return names.every(event => received.some(row => row.event === event && row.insert_id === insertionId(event)));
  }, { timeout: 15_000 }).toBe(true);
  const milestones = received.filter(row => names.some(event => row.event === event && row.insert_id === insertionId(event)));
  expect(new Set(milestones.map(row => row.identity)).size).toBe(1);
  for (const row of milestones) {
    expect(row.transport).toBe("server_capture");
    expect(row.has_analytics_consent).toBe(true);
  }
  expect(boundary.requests.some(request => request.method === "POST" && /\/(?:e|batch)(?:\/|$)/.test(request.path)), "Browser SDK emitted a capture request at the intercepted transport").toBe(true);
  await saveEvidence(testInfo, "combined-lifecycle-receiver", {
    boundary: "Local receiver accepted real app server lifecycle events; browser SDK requests were acknowledged by the test transport. External PostHog ingestion and deduplication are unverified.",
    receipts: milestones,
    deliveries_by_event: Object.fromEntries(names.map(event => [event, milestones.filter(row => row.event === event).length])),
    sdk_requests: boundary.requests,
  });
}

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
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted key]")
    .replace(/^\s*(?:set-cookie|cookie|authorization):.*$/gim, "[redacted credential header]")
    .replace(/(["']?(?:access_token|refresh_token|verify_secret|poll_secret|password|token)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/g, candidate => {
      try {
        const url = new URL(candidate);
        url.username = "";
        url.password = "";
        url.search = "";
        url.hash = "";
        return url.href;
      } catch { return "[redacted URL]"; }
    })
    .replace(/([?&](?:verify_secret|poll_secret|token|token_hash|code|access_token|refresh_token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted email]");
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
  await assertAnalyticsBrowser(page);
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
  await saveEvidence(testInfo, "installed-candidate", metadata);
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
          await saveEvidence(testInfo, `cli-${++sequence}-${args[0] ?? "push"}`, {
            command: ["node", "installed/straude/dist/index.js", ...args], started_at: new Date(started).toISOString(), duration_ms: Date.now() - started, exit_code: code, stdout, stderr,
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
    await configureAnalyticsBrowser(page);
    await page.goto(url);
    await assertAnalyticsBrowser(page);
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
    db.from("daily_usage").select("id,date,total_tokens,output_tokens,cost_usd,models").eq("user_id", userId),
    db.from("device_usage").select("date,total_tokens,output_tokens,cost_usd").eq("user_id", userId),
    db.from("usage_agent_daily").select("date,agent,total_tokens,output_tokens,cost_usd,collector").eq("user_id", userId),
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
  expect(Number(daily.output_tokens)).toBe(40_000);
  expect(Number(daily.cost_usd)).toBeGreaterThan(0);
  expect(daily.models).toHaveLength(4);
  expect(stored.posts[0].daily_usage_id).toBe(daily.id);
  for (const layer of [stored.devices[0], stored.sources[0]]) {
    expect(Number(layer.total_tokens)).toBe(Number(daily.total_tokens));
    expect(Number(layer.output_tokens)).toBe(Number(daily.output_tokens));
    expect(Number(layer.cost_usd)).toBeCloseTo(Number(daily.cost_usd), 5);
    expect(layer.date).toBe(cli.date);
  }
  expect(stored.sources[0]).toMatchObject({ agent: "codex", collector: { version: cli.metadata.collector_version, pricing_mode: "online" } });
  const response = await page.request.get("/api/usage/status");
  expect(response.status()).toBe(200);
  const status = await response.json();
  // get_user_usage_totals intentionally aliases total_tokens to output_tokens
  // (20260406074500_fix_get_user_usage_totals_output_tokens.sql). Four native
  // fixture sessions independently contain 440k all-category and 40k output.
  expect(status).toMatchObject({ has_usage: true, total_tokens: 40_000, latest_usage_id: daily.id, latest_post_url: `/post/${stored.posts[0].id}` });
  expect(status.total_tokens).toBe(Number(daily.output_tokens));
  expect(status.cost_usd).toBe(Math.round(Number(daily.cost_usd) * 100) / 100);
  await saveEvidence(testInfo, "accepted-storage-comparison", { ...stored, status });
  return stored;
}

function signedToken(payload: Record<string, unknown>) {
  const key = value("CLI_JWT_SECRET");
  if (!key) throw new Error("Local CLI_JWT_SECRET is required for signed expiry/rotation fixtures");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.${createHmac("sha256", key).update(`${header}.${body}`).digest("base64url")}`;
}

// Exercise consented SDK capture outside its bot filter. The application SDK
// and CSP remain unchanged; only this browser test's environment differs.
test.use(ANALYTICS_BROWSER_USE);

test.describe("installed CLI and browser first sync", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!install || !tarball || !sourceCommit, "Requires the exact candidate install, tarball and source commit via STRAUDE_E2E_CLI_*.");
    test.skip(!supabaseUrl || !secretKey, "Requires local Supabase fixture credentials.");
    expect(local(supabaseUrl), "Fixture operations must stay on loopback").toBe(true);
    expect(local(String(testInfo.project.use.baseURL))).toBe(true);
    expect(testInfo.project.use.bypassCSP ?? false).toBe(false);
    await configureAnalyticsBrowser(page);
    const host = value("POSTHOG_HOST");
    const receiver = host && local(host) && new URL(host).port === "3118" ? new URL(host).origin : null;
    const boundary: AnalyticsBoundary = { requests: [], receiver, start: 0 };
    analytics.set(testInfo.testId, boundary);
    // Cover every verification tab too. Only optional SDK transport is replaced;
    // the real activation forwarding, auth and usage endpoints remain untouched.
    await page.context().route("**/ingest/**", async route => {
      const path = new URL(route.request().url()).pathname;
      boundary.requests.push({ path, method: route.request().method() });
      // External SDK executable assets fail locally; its config retry receives
      // valid JSON. Never treat JSON as an executable remote SDK extension.
      if (path.endsWith(".js")) return route.abort("failed");
      const body = path.endsWith("/config") ? '{"hasFeatureFlags":false}' : '{"status":1,"featureFlags":{}}';
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });
    if (receiver) boundary.start = (await receiverEvents(page, receiver)).length;
  });

  test.afterEach(async ({}, testInfo) => {
    const boundary = analytics.get(testInfo.testId);
    if (boundary) await saveEvidence(testInfo, "browser-sdk-transport-boundary", { boundary: "SDK emission recorded and acknowledged locally only; no SDK fixture traffic was forwarded to PostHog", browser_environment: "Shared ordinary Chrome user agent/client-hint metadata with AutomationControlled disabled; webdriver, UA and brands asserted on real origins", requests: boundary.requests, lifecycle_receiver_configured: Boolean(boundary.receiver) });
    analytics.delete(testInfo.testId);
  });

  test("web signup collects native logs, retries completion, and recovers expired CLI sign-in", async ({ page, request }, testInfo) => {
    test.setTimeout(300_000);
    const email = `packaged-browser-${randomUUID()}@local.test`;
    const cli = await cliFixture(testInfo);
    const origin = String(testInfo.project.use.baseURL);
    try {
      // Cookie consent is an actual landing-layout control; auth pages do not
      // render it. Complete that UI and its SDK emission before starting signup.
      const landingResponse = await page.goto("/");
      await assertAnalyticsBrowser(page);
      expect(landingResponse?.headers()["content-security-policy"]).toContain("connect-src");
      const acceptAnalytics = page.getByRole("button", { name: "Accept all", exact: true });
      await expect(acceptAnalytics).toBeVisible();
      const consentSaved = page.waitForResponse(response => response.url().endsWith("/api/cookie-consent") && response.request().method() === "POST");
      await acceptAnalytics.click();
      const consentResponse = await consentSaved;
      expect(consentResponse.status()).toBe(200);
      await consentResponse.finished();
      await expect(acceptAnalytics).toHaveCount(0);
      const boundary = analytics.get(testInfo.testId)!;
      if (boundary.receiver) await expect.poll(() => boundary.requests.some(request => request.method === "POST" && /\/(?:e|batch)(?:\/|$)/.test(request.path)), { timeout: 15_000 }).toBe(true);
      await saveEvidence(testInfo, "web-first-consent", { landing_status: landingResponse?.status(), csp_enforced: true, consent_save_status: consentResponse.status(), sdk_capture_observed: boundary.requests.some(request => request.method === "POST" && /\/(?:e|batch)(?:\/|$)/.test(request.path)), sdk_requests: boundary.requests });
      await page.goto("/signup");
      await assertAnalyticsBrowser(page);
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
      expect(rotated.token !== old, "Installed config persisted a different refreshed credential").toBe(true);
      const claims = JSON.parse(Buffer.from(rotated.token.split(".")[1], "base64url").toString());
      expect(claims).toMatchObject({ sub: profile.id, oiat: originalIat, exp: originalIat + 30 * 86400 });
      expect(claims.iat).toBeGreaterThanOrEqual(now);
      expect(claims.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
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
      await saveEvidence(testInfo, "real-device-auth-and-rotation", { user_id: profile.id, device_login: true, rotated_claims: claims, expired_dashboard_exit: expiredStatus.code, browser_reauthentication: true });
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
      await expect(page.locator("dl")).toContainText("40k");
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
      await saveEvidence(testInfo, "real-auth-recovery", { rotated_claims: claims, expired_exit: rejected.code, pending_request_id: pending.batches[0].request.request_id, watermark_preserved: true, accepted_pending_once: true });
      await assertLifecycle(page, profile.id, testInfo);
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
      await assertAnalyticsBrowser(page);
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
      await saveEvidence(testInfo, "cli-first-settings-result", { user_id: profile.id, cli_subject: claims.sub, get_me_status: me.status(), patch_me_status: savedResponse.status(), display_name: profile.display_name, onboarding_completed: profile.onboarding_completed });
      const empty = await cli.run(["push", "--date", cli.date, "--non-interactive"]);
      expect(empty.stdout + empty.stderr).toContain("No usage data");
      await expect(readFile(join(cli.root, "home", ".straude", "sync-health.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect((await storedUsage(profile.id)).daily).toEqual([]);
      await page.goto("/onboarding");
      await assertAnalyticsBrowser(page);
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
