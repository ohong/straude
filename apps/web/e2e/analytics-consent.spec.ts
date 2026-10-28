import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { ANALYTICS_BROWSER_USE, assertAnalyticsBrowser, configureAnalyticsBrowser } from "./helpers/analytics-browser";

/**
 * Requires the real loopback app/Auth/database/mail stack, built with the
 * synthetic analytics key, and capture-activation-evidence.mjs as POSTHOG_HOST.
 * SDK requests are recorded/aborted only at /ingest; auth/usage are never mocked.
 * API usage below is a handcrafted protocol fixture. The separate packaged CLI
 * journey supplies installed-collector proof; this suite isolates consent.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const receiverUrl = process.env.ACTIVATION_CAPTURE_URL ?? "http://127.0.0.1:3118";
const lifecycleEvents = ["signup_completed", "first_sync_confirmed", "activation_completed"];
type EventReceipt = {
  event: string;
  identity: string;
  anonymous_identity: string | null;
  insert_id: string | null;
  transport: string;
  has_analytics_consent: boolean | null;
};

function loopback(value: string) {
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname); }
  catch { return false; }
}
function admin() {
  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function events(page: Page) {
  const response = await page.request.get(`${receiverUrl}/events`);
  expect(response.status(), "loopback analytics receiver should be running").toBe(200);
  return await response.json() as EventReceipt[];
}
async function receiptCount(page: Page) { return (await events(page)).length; }
async function snapshot(page: Page, testInfo: TestInfo, name: string, start: number) {
  const receipts = (await events(page)).slice(start);
  await testInfo.attach(name, { body: JSON.stringify({
    boundary: "local receiver acceptance only; external PostHog ingestion/deduplication unverified",
    receipts,
  }, null, 2), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  return receipts;
}
const pseudonym = (value: unknown) => typeof value === "string"
  ? createHash("sha256").update(value).digest("hex").slice(0, 20) : null;
function sdkCaptures(buffer: Buffer | null) {
  if (!buffer) return [];
  const decoded = buffer[0] === 31 && buffer[1] === 139 ? gunzipSync(buffer) : buffer;
  let text = decoded.toString();
  if (text.startsWith("data=")) text = Buffer.from(new URLSearchParams(text).get("data") ?? "", "base64").toString();
  const data = JSON.parse(text);
  const captures = Array.isArray(data) ? data : [data];
  return captures.map((capture) => ({
    event: String(capture.event),
    identity: pseudonym(capture.properties?.distinct_id ?? capture.distinct_id),
    anonymous_identity: pseudonym(capture.properties?.$anon_distinct_id),
    insert_id: pseudonym(capture.uuid ?? capture.properties?.$insert_id),
  }));
}
async function sdkBoundary(page: Page, mode: "accept" | "fail" = "accept") {
  const requests: { path: string; method: string }[] = [];
  const captures: ReturnType<typeof sdkCaptures> = [];
  let fail = mode === "fail";
  await page.context().route("**/ingest/**", async (route) => {
    requests.push({ path: new URL(route.request().url()).pathname, method: route.request().method() });
    const isCapture = route.request().method() === "POST" && /\/e\/?$/.test(new URL(route.request().url()).pathname);
    if (isCapture) captures.push(...sdkCaptures(route.request().postDataBuffer()));
    if (fail && isCapture) return route.abort("failed");
    // Acknowledge optional SDK transport only. No auth/application route is replaced.
    // Block external executable assets; remote config falls back to JSON.
    if (new URL(route.request().url()).pathname.endsWith(".js")) return route.abort("failed");
    const body = new URL(route.request().url()).pathname.endsWith("/config")
      ? '{"hasFeatureFlags":false}' : '{"status":1,"featureFlags":{}}';
    await route.fulfill({ status: 200, contentType: "application/json", body });
  });
  return { requests, captures, recover: () => { fail = false; } };
}
async function changeConsent(page: Page, preference: "all" | "essential") {
  // The public consent route and the same event used by CookieConsentModal.
  const status = await page.evaluate(async (value) => {
    const response = await fetch("/api/cookie-consent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preference: value }),
    });
    if (response.ok) window.dispatchEvent(new CustomEvent("straude:cookie-consent", {
      detail: { preference: value, analytics: value === "all" },
    }));
    return response.status;
  }, preference);
  expect(status).toBe(200);
}
async function assertNoActivationCookie(page: Page) {
  expect((await page.context().cookies()).some((cookie) => cookie.name === "straude_activation_id")).toBe(false);
}
async function activation(page: Page) {
  return page.request.post("/api/analytics/activation", {
    data: { event: "sync_command_copied", properties: { surface: "onboarding" } },
  });
}
async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send magic link", exact: true }).click();
  await expect(page.getByText("Check your email", { exact: true })).toBeVisible();
  const mail = new URL(supabaseUrl);
  mail.port = String(Number(mail.port) + 3);
  let messageId = "";
  await expect.poll(async () => {
    const response = await page.request.get(new URL(`/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, mail).href);
    expect(response.status()).toBe(200);
    messageId = (await response.json()).messages?.[0]?.ID ?? "";
    return Boolean(messageId);
  }).toBe(true);
  const message = await (await page.request.get(new URL(`/api/v1/message/${messageId}`, mail).href)).json();
  const link = String(message.HTML).match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!link) throw new Error("Local signup email is missing verification link");
  await page.goto(link);
  await expect(page).toHaveURL(/\/onboarding$/);
  const profile = await page.request.get("/api/users/me");
  expect(profile.status()).toBe(200);
  return (await profile.json()).id as string;
}
async function cleanup(email: string) {
  const client = admin();
  const listed = await client.auth.admin.listUsers({ perPage: 1000 });
  expect(listed.error).toBeNull();
  const user = listed.data.users.find((candidate) => candidate.email === email);
  if (user) expect((await client.auth.admin.deleteUser(user.id)).error).toBeNull();
}
async function signOut(page: Page) {
  await page.goto("/settings");
  const signOutButton = page.getByRole("button", { name: /log out/i }).first();
  await expect(signOutButton).toBeVisible();
  await signOutButton.click();
  await expect(page).toHaveURL(/\/(?:login)?$/);
}
async function syncProtocolFixture(page: Page) {
  const init = await page.request.post("/api/auth/cli/init");
  expect(init.status()).toBe(200);
  const { code, verify_url, poll_secret } = await init.json();
  const verification = await page.context().newPage();
  await configureAnalyticsBrowser(verification);
  await verification.goto(verify_url);
  await assertAnalyticsBrowser(verification);
  await verification.getByRole("button", { name: "Authorize CLI", exact: true }).click();
  await expect(verification.getByText("CLI authorized", { exact: true })).toBeVisible();
  await verification.close();
  const poll = await page.request.post("/api/auth/cli/poll", { data: { code, poll_secret } });
  expect(poll.status()).toBe(200);
  const { token, status } = await poll.json();
  expect(status).toBe("completed");
  const metrics = { input_tokens: 100, output_tokens: 20, reasoning_output_tokens: 10,
    cache_creation_tokens: 0, cache_read_tokens: 30, total_tokens: 160, cost_usd: 0.25 };
  const payload = {
    protocol_version: 2, request_id: randomUUID(), source: "cli", timezone: "UTC",
    installation: { id: randomUUID(), name: "analytics-consent-e2e" },
    collector: { name: "ccusage", version: "20.0.26", pricing_mode: "online" },
    entries: [{ date: new Date().toISOString().slice(0, 10), content_hash: "b".repeat(64),
      agents: [{ agent: "codex", models: ["gpt-5.6"], ...metrics,
        model_breakdown: [{ model: "gpt-5.6", ...metrics }] }] }],
  };
  const response = await page.request.post("/api/usage/submit", {
    headers: { Authorization: `Bearer ${token}` }, data: payload,
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).outcomes[0].status).toBe("committed");
  return async () => {
    const replay = await page.request.post("/api/usage/submit", {
      headers: { Authorization: `Bearer ${token}` }, data: payload,
    });
    expect(replay.status()).toBe(200);
  };
}

// PostHog intentionally drops automation events (navigator.webdriver and
// HeadlessChrome). Use Chromium's ordinary browser environment to exercise
// actual SDK emission, without changing SDK/app consent checks or CSP.
test.use(ANALYTICS_BROWSER_USE);

test.describe("optional analytics consent and identity", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await configureAnalyticsBrowser(page);
    testInfo.annotations.push({ type: "browser_environment",
      description: "Ordinary Chrome UA/CDP client-hint metadata; AutomationControlled disabled; actual SDK bot/consent checks and CSP remain enabled" });
    for (const [label, value] of [["app", testInfo.project.use.baseURL], ["Supabase", supabaseUrl], ["receiver", receiverUrl]]) {
      if (typeof value !== "string" || !loopback(value)) throw new Error(`Refusing non-loopback or missing ${label} URL`);
    }
    test.skip(!publishableKey || !secretKey, "Real local Supabase credentials required");
    test.skip(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() !== "phc_local_runtime_evidence",
      "App must be built with synthetic analytics project key");
    const health = await page.request.get(`${receiverUrl}/health`);
    expect(health.status()).toBe(200);
    test.setTimeout(90_000);
  });

  test("essential-only signup and confirmed sync create no optional traffic or activation cookie", async ({ page }, testInfo) => {
    const start = await receiptCount(page);
    const sdk = await sdkBoundary(page);
    const email = `consent-essential-${randomUUID()}@local.test`;
    try {
      const response = await page.goto("/");
      await assertAnalyticsBrowser(page);
      expect(response?.headers()["content-security-policy"]).toContain("connect-src 'self'");
      await page.getByRole("button", { name: "Accept essential", exact: true }).click();
      await expect(page.getByRole("button", { name: "Accept essential", exact: true })).toHaveCount(0);
      await assertNoActivationCookie(page);
      expect((await activation(page)).status()).toBe(204);
      const userId = await signUp(page, email);
      await assertNoActivationCookie(page);
      await syncProtocolFixture(page);
      await expect(page.getByRole("heading", { name: "Your first sync is complete" })).toBeVisible({ timeout: 15_000 });
      await page.reload();
      expect((await page.request.get("/api/usage/status")).status()).toBe(200);
      const profile = await page.request.get("/api/users/me");
      expect((await profile.json()).onboarding_completed).toBe(true);
      expect((await admin().from("daily_usage").select("id").eq("user_id", userId)).data).toHaveLength(1);
      expect(await page.evaluate(() => Boolean(window.__straudePostHogInitialized))).toBe(false);
      await assertNoActivationCookie(page);
      expect(sdk.requests).toEqual([]);
      expect((await snapshot(page, testInfo, "essential-only", start))).toEqual([]);
    } finally { await cleanup(email); }
  });

  test("accepted lifecycle keeps one identity and stable insertion IDs across reload and replay", async ({ page }, testInfo) => {
    const start = await receiptCount(page);
    const sdk = await sdkBoundary(page);
    const email = `consent-accepted-${randomUUID()}@local.test`;
    try {
      await page.goto("/");
      await assertAnalyticsBrowser(page);
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      await expect.poll(() => sdk.captures.length).toBeGreaterThan(0);
      expect((await activation(page)).status()).toBe(200);
      expect((await page.context().cookies()).some((cookie) => cookie.name === "straude_activation_id")).toBe(true);
      const userId = await signUp(page, email);
      await assertNoActivationCookie(page);
      await expect.poll(() => sdk.captures.some((capture) => capture.identity === pseudonym(userId))).toBe(true);
      const replay = await syncProtocolFixture(page);
      await expect(page.getByRole("heading", { name: "Your first sync is complete" })).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => {
        const received = (await events(page)).slice(start);
        return lifecycleEvents.filter((event) => received.some((receipt) => receipt.event === event));
      }).toEqual(lifecycleEvents);
      await replay();
      // Reload plus real endpoint retries can redeliver milestones. Assert their
      // insertion identity rather than interpreting raw delivery count as people.
      await page.reload();
      expect((await page.request.get("/api/usage/status")).status()).toBe(200);
      expect((await page.request.patch("/api/users/me", { data: { onboarding_completed: true } })).status()).toBe(200);
      const receipts = await snapshot(page, testInfo, "accepted-lifecycle", start);
      const milestones = receipts.filter((receipt) => lifecycleEvents.includes(receipt.event));
      expect(new Set(milestones.map((receipt) => receipt.identity)).size).toBe(1);
      for (const event of lifecycleEvents) {
        const deliveries = milestones.filter((receipt) => receipt.event === event);
        expect(deliveries.length).toBeGreaterThan(0);
        expect(deliveries.every((receipt) => receipt.has_analytics_consent === true)).toBe(true);
        expect(deliveries.every((receipt) => Boolean(receipt.insert_id))).toBe(true);
        expect(new Set(deliveries.map((receipt) => receipt.insert_id)).size).toBe(1);
      }
      expect(milestones.filter((receipt) => receipt.event === "first_sync_confirmed").length).toBeGreaterThan(1);
      await testInfo.attach("browser-sdk-emission", { body: JSON.stringify({
        boundary: "browser SDK emitted; analytics-only route acknowledged locally; provider ingestion unverified",
        requests: sdk.requests, captures: sdk.captures,
      }, null, 2), contentType: "application/json" });
      // Withdrawal must gate authenticated server lifecycle producers too.
      // Retrying the real status/completion endpoints retains the product state.
      await changeConsent(page, "essential");
      const withdrawnStart = await receiptCount(page);
      expect((await page.request.get("/api/usage/status")).status()).toBe(200);
      expect((await page.request.patch("/api/users/me", { data: { onboarding_completed: true } })).status()).toBe(200);
      expect((await activation(page)).status()).toBe(204);
      await page.reload();
      const profileAfterWithdrawal = await page.request.get("/api/users/me");
      expect(profileAfterWithdrawal.status()).toBe(200);
      expect(await profileAfterWithdrawal.json()).toMatchObject({ onboarding_completed: true });
      expect((await events(page)).slice(withdrawnStart)).toEqual([]);
      await assertNoActivationCookie(page);
      await testInfo.attach("withdrawn-authenticated-lifecycle", { body: JSON.stringify({
        boundary: "real authenticated usage/status and users/me completion after withdrawal",
        receiverDeliveries: 0,
      }, null, 2), contentType: "application/json" });
    } finally { await cleanup(email); }
  });

  test("withdrawal clears anonymous identity and denies new, direct and retried analytics", async ({ page }, testInfo) => {
    const start = await receiptCount(page);
    const sdk = await sdkBoundary(page, "fail");
    await page.goto("/");
    await assertAnalyticsBrowser(page);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await expect.poll(() => sdk.captures.length).toBeGreaterThan(0);
    expect((await activation(page)).status()).toBe(200);
    const sdkIdentityPersistence = () => page.evaluate(() => ({
      cookieNames: document.cookie.split(";").map((cookie) => cookie.trim().split("=")[0]).filter((name) => /^ph_.+_posthog$/.test(name)),
      localStorageKeys: Object.keys(localStorage).filter((name) => /^ph_.+_posthog$/.test(name)),
    }));
    const persistenceBeforeWithdrawal = await sdkIdentityPersistence();
    expect(persistenceBeforeWithdrawal.cookieNames.length + persistenceBeforeWithdrawal.localStorageKeys.length).toBeGreaterThan(0);
    await changeConsent(page, "essential");
    await assertNoActivationCookie(page);
    const acceptedAtWithdrawal = await receiptCount(page);
    await page.context().unroute("**/ingest/**");
    // Exercise the actual Next proxy matcher, including a pending SDK retry's
    // endpoint shape. No test route answers these denied requests.
    for (const path of ["/ingest", "/ingest/e/", "/ingest/i/v0/e/"]) {
      const response = await page.request.post(path, { data: { event: "consent_withdrawal_probe" } });
      expect(response.status()).toBe(204);
    }
    expect((await activation(page)).status()).toBe(204);
    const afterWithdrawal: { path: string; status: number }[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname.startsWith("/ingest/")) {
        afterWithdrawal.push({ path: new URL(response.url()).pathname, status: response.status() });
      }
    });
    // Keep the document alive so queued SDK requests retain their retry timers.
    // PostHog retry backoff can reach 3s. Observe a complete backoff interval;
    // either opt-out clears it, or the request gate must answer 204.
    await page.waitForTimeout(6_000);
    await page.goto("/privacy");
    expect(afterWithdrawal.every((response) => response.status === 204)).toBe(true);
    expect(await receiptCount(page)).toBe(acceptedAtWithdrawal);
    await assertNoActivationCookie(page);
    await testInfo.attach("withdrawal-sdk-boundary", { body: JSON.stringify({
      initialSdkAttempts: sdk.requests, initialSdkCaptures: sdk.captures, responsesAfterWithdrawal: afterWithdrawal,
      queuedRetryObserved: afterWithdrawal.length > 0,
      boundary: "SDK attempts recorded; actual Next proxy denies transport; provider unverified",
    }, null, 2), contentType: "application/json" });
    await snapshot(page, testInfo, "withdrawal", start);
    const persistenceAfterWithdrawal = await sdkIdentityPersistence();
    await testInfo.attach("public-withdrawal-sdk-persistence", { body: JSON.stringify({
      boundary: "actual SDK identity persistence names only; essential opt-out preference may remain",
      beforeWithdrawal: persistenceBeforeWithdrawal, afterWithdrawal: persistenceAfterWithdrawal,
    }, null, 2), contentType: "application/json" });
    expect(persistenceAfterWithdrawal.cookieNames, "Public withdrawal removes SDK identity cookie").toEqual([]);
    expect(persistenceAfterWithdrawal.localStorageKeys, "Public withdrawal removes SDK identity local storage").toEqual([]);
    // Reaccepting permits fresh analytics without reviving the previous identity.
    await sdkBoundary(page);
    await changeConsent(page, "all");
    expect((await activation(page)).status()).toBe(200);
    const fresh = (await events(page)).slice(acceptedAtWithdrawal).filter((receipt) => receipt.event === "sync_command_copied");
    const old = (await events(page)).slice(start, acceptedAtWithdrawal).find((receipt) => receipt.event === "sync_command_copied");
    expect(fresh).toHaveLength(1);
    expect(fresh[0].identity).not.toBe(old?.identity);
  });

  test("sign-out and a second account never reuse the consumed anonymous join", async ({ page }, testInfo) => {
    const start = await receiptCount(page);
    const sdk = await sdkBoundary(page);
    const first = `consent-switch-a-${randomUUID()}@local.test`;
    const second = `consent-switch-b-${randomUUID()}@local.test`;
    try {
      await page.goto("/");
      await assertAnalyticsBrowser(page);
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      expect((await activation(page)).status()).toBe(200);
      const firstUserId = await signUp(page, first);
      await expect.poll(() => sdk.captures.some((capture) => capture.identity === pseudonym(firstUserId))).toBe(true);
      await assertNoActivationCookie(page);
      expect((await activation(page)).status()).toBe(200);
      await signOut(page);
      await assertNoActivationCookie(page);
      const secondUserId = await signUp(page, second);
      await expect.poll(() => sdk.captures.some((capture) => capture.identity === pseudonym(secondUserId))).toBe(true);
      await assertNoActivationCookie(page);
      expect((await activation(page)).status()).toBe(200);
      await expect.poll(async () => (await events(page)).slice(start).filter((receipt) => receipt.event === "signup_completed").length).toBe(2);
      const receipts = await snapshot(page, testInfo, "account-switch", start);
      const signups = receipts.filter((receipt) => receipt.event === "signup_completed");
      expect(new Set(signups.map((receipt) => receipt.identity)).size).toBe(2);
      const links = receipts.filter((receipt) => receipt.event === "$identify");
      const firstIdentity = signups[0].identity;
      const secondIdentity = signups[1].identity;
      expect(links.some((receipt) => receipt.identity === firstIdentity && Boolean(receipt.anonymous_identity))).toBe(true);
      expect(links.some((receipt) => receipt.identity === secondIdentity && receipt.anonymous_identity === firstIdentity)).toBe(false);
      const secondSdkIdentities = sdk.captures.filter((capture) => capture.identity === pseudonym(secondUserId));
      expect(secondSdkIdentities.length).toBeGreaterThan(0);
      expect(secondSdkIdentities.some((capture) => capture.anonymous_identity === pseudonym(firstUserId))).toBe(false);
      await testInfo.attach("account-switch-sdk", { body: JSON.stringify({
        boundary: "browser SDK emission; account and anonymous IDs pseudonymized", captures: sdk.captures,
      }, null, 2), contentType: "application/json" });
      const firstAnonymous = links.find((receipt) => receipt.identity === firstIdentity)?.anonymous_identity;
      expect(links.some((receipt) => receipt.identity === secondIdentity && receipt.anonymous_identity === firstAnonymous)).toBe(false);
    } finally { await cleanup(first); await cleanup(second); }
  });
});
