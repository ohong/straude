import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32"
  ? {
      executable: process.execPath,
      prefixArgs: [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")],
    }
  : { executable: "npm", prefixArgs: [] };
const expectedCcusageRange = ">=20.0.26";

function isCompatibleCcusageVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
    .exec(version);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  return major > 20 || (major === 20 && (minor > 0 || patch >= 26));
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function execNpm(args, options) {
  return execFileAsync(
    npmCommand.executable,
    [...npmCommand.prefixArgs, ...args],
    options,
  );
}

async function createTarball(root) {
  const { stdout } = await execNpm(
    ["pack", "--json", "--pack-destination", root],
    { cwd: packageDir, maxBuffer: 10 * 1024 * 1024 },
  );
  const jsonStart = stdout.lastIndexOf("\n[");
  const [pack] = JSON.parse(jsonStart === -1 ? stdout : stdout.slice(jsonStart + 1));
  const filenames = pack.files.map((file) => file.path).sort();
  if (!filenames.includes("dist/index.js")) {
    throw new Error(`Packed CLI is missing dist/index.js: ${filenames.join(", ")}`);
  }
  if (filenames.some((filename) => filename.endsWith(".map") || filename.endsWith(".tsbuildinfo"))) {
    throw new Error(`Packed CLI contains excluded build metadata: ${filenames.join(", ")}`);
  }
  return join(root, pack.filename);
}

async function resolveTarball(value) {
  const candidate = isAbsolute(value) ? value : resolve(process.cwd(), value);
  if (!(await stat(candidate)).isDirectory()) return candidate;
  const tarballs = (await readdir(candidate))
    .filter((filename) => filename.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1) {
    throw new Error(`Expected one tarball in ${candidate}, found ${tarballs.length}`);
  }
  return join(candidate, tarballs[0]);
}

const root = await mkdtemp(join(tmpdir(), "straude-packaged-e2e-"));
const installDir = join(root, "install");
const homeDir = join(root, "home");
const codexHome = join(homeDir, "codex");
let server;
let dashboardRequests = 0;
let httpRequests = 0;
let submitRequests = 0;
let transientDashboardFailure = false;
let rejectAuthentication = false;
const acceptedRequestIds = [];
const rejectedRequests = [];
let authInitRequests = 0;
let activeScenario = "package-installation";
let submissionObserver;
const dashboardDelayMs = 3_500;
const reportPath = resolve(readOption("--report") ?? join(packageDir, "test-results", "packaged-cli-e2e.json"));
const startedAt = new Date().toISOString();
const report = {
  started_at: startedAt,
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  command: [process.execPath, ...process.argv.slice(1)],
  cwd: process.cwd(),
  boundary: "Installed tarball, synthetic native Codex logs, real collector and filesystem, controlled loopback API. No real authentication or database acceptance is claimed.",
  dashboard_delay_ms: dashboardDelayMs,
  planned_scenarios: ["default-slow-dashboard", "days-slow-dashboard", "date-slow-dashboard", "default-transient-dashboard", "synthetic-401-pending-recovery", "fresh-dry-run-and-empty-scan", "installed-background-hook-invocation", "unsupported-pending-native-recollection"],
  scenarios: [],
};
async function saveReport() {
  report.finished_at = new Date().toISOString();
  report.duration_ms = Date.now() - Date.parse(startedAt);
  report.not_run_scenarios = report.planned_scenarios.filter(name => !report.scenarios.some(scenario => scenario.name === name));
  report.counts = {
    passed: report.scenarios.filter(scenario => scenario.passed).length,
    failed: report.scenarios.filter(scenario => scenario.passed === false).length,
    skipped: report.scenarios.filter(scenario => scenario.skipped).length
      + (report.scenarios.some(scenario => scenario.passed === false) ? report.not_run_scenarios.length : 0),
    flaky: 0,
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
const digest = value => createHash("sha256").update(value).digest("hex");

try {
  const source = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: packageDir });
  report.harness_source_commit = source.stdout.trim();
  report.tarball_source_commit = readOption("--source-commit") ?? null;
  await mkdir(installDir, { recursive: true });
  await mkdir(join(homeDir, ".straude"), { recursive: true });
  await mkdir(join(homeDir, ".claude", "projects"), { recursive: true });
  await writeFile(join(installDir, "package.json"), JSON.stringify({ private: true }));

  const fixtureSource = new URL("../__tests__/fixtures/ccusage-gpt-5.6/codex", import.meta.url);
  await cp(fixtureSource, codexHome, { recursive: true });
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const sessionsDir = join(codexHome, "sessions");
  for (const filename of await readdir(sessionsDir)) {
    const path = join(sessionsDir, filename);
    const contents = await readFile(path, "utf8");
    await writeFile(path, contents.replaceAll("2026-07-09", date));
  }

  const suppliedTarball = readOption("--tarball");
  const tarball = suppliedTarball
    ? await resolveTarball(suppliedTarball)
    : await createTarball(root);

  report.tarball = { path: tarball, sha256: digest(await readFile(tarball)) };
  await saveReport();
  await execNpm(["install", "--no-audit", "--no-fund", tarball], {
    cwd: installDir,
    maxBuffer: 10 * 1024 * 1024,
  });

  const installedPackageDir = join(installDir, "node_modules", "straude");
  const packageJson = JSON.parse(
    await readFile(join(installedPackageDir, "package.json"), "utf8"),
  );
  if (packageJson.bin?.straude !== "dist/index.js") {
    throw new Error(`Packed CLI has an invalid bin entry: ${JSON.stringify(packageJson.bin)}`);
  }
  if (packageJson.dependencies?.ccusage !== expectedCcusageRange) {
    throw new Error(
      `Packed CLI must declare ccusage ${expectedCcusageRange}, got ${packageJson.dependencies?.ccusage}`,
    );
  }
  if (packageJson.engines?.node !== ">=20") {
    throw new Error(`Packed CLI must require Node >=20, got ${packageJson.engines?.node}`);
  }
  const installedCcusage = JSON.parse(
    await readFile(join(installDir, "node_modules", "ccusage", "package.json"), "utf8"),
  );
  if (!isCompatibleCcusageVersion(installedCcusage.version)) {
    throw new Error(
      `Packed CLI installed incompatible ccusage ${installedCcusage.version}; expected a stable version >=20.0.26`,
    );
  }

  const cli = join(installedPackageDir, "dist", "index.js");
  const childEnvironment = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    CODEX_HOME: codexHome,
    CLAUDE_CONFIG_DIR: join(homeDir, ".claude"),
    STRAUDE_TELEMETRY_DISABLED: "1",
  };
  const versionResult = await execFileAsync(process.execPath, [cli, "--version"], {
    cwd: installDir,
    env: childEnvironment,
  });
  if (versionResult.stdout.trim() !== `straude v${packageJson.version}`) {
    throw new Error(`Packed CLI reported the wrong version: ${versionResult.stdout.trim()}`);
  }

  server = createServer(async (request, response) => {
    httpRequests += 1;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/auth/cli/init") {
      authInitRequests += 1;
      response.writeHead(500).end(JSON.stringify({ error: "Background execution must not start login" }));
      return;
    }
    if (request.url === "/api/usage/submit" && request.method === "POST") {
      submitRequests += 1;
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const submission = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (submissionObserver) {
        try {
          await submissionObserver(submission);
        } catch (error) {
          response.writeHead(500).end(JSON.stringify({ error: error.message }));
          return;
        }
      }
      if (rejectAuthentication) {
        rejectedRequests.push(submission);
        response.writeHead(401).end(JSON.stringify({ error: "Synthetic expired credential" }));
        return;
      }
      if (submission.protocol_version !== 2) {
        throw new Error(`Expected usage protocol v2, got ${submission.protocol_version}`);
      }
      if (submission.collector?.version !== installedCcusage.version) {
        throw new Error(
          `Expected installed ccusage ${installedCcusage.version}, got ${submission.collector?.version}`,
        );
      }
      acceptedRequestIds.push(submission.request_id);
      response.end(JSON.stringify({
        request_id: submission.request_id,
        outcomes: submission.entries.map((entry) => ({
          date: entry.date,
          status: "committed",
          result: {
            usage_id: "usage-e2e",
            post_id: "post-e2e",
            post_url: "http://straude.test/post/post-e2e",
            action: "created",
          },
        })),
      }));
      return;
    }

    if (request.url !== "/api/cli/dashboard") {
      response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      return;
    }

    dashboardRequests += 1;
    if (transientDashboardFailure && dashboardRequests === 1) {
      response.writeHead(503).end(JSON.stringify({ error: "Temporarily unavailable" }));
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, dashboardDelayMs));
    response.end(JSON.stringify({
      username: "packaged-e2e",
      level: 7,
      streak: 4,
      daily: [{ date, cost_usd: 12.5 }],
      week_cost: 12.5,
      prev_week_cost: 10,
      leaderboard: null,
      model_breakdown: [{ model: "gpt-5.6", cost_usd: 12.5 }],
      total_output_tokens: 5_000_000,
    }));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine fixture server address");
  }

  report.cli_version = packageJson.version;
  report.ccusage_version = installedCcusage.version;
  const scenarios = [
    { name: "default-slow-dashboard", args: [], transientFailure: false },
    { name: "days-slow-dashboard", args: ["--days", "1"], transientFailure: false },
    { name: "date-slow-dashboard", args: ["push", "--date", date], transientFailure: false },
    { name: "default-transient-dashboard", args: [], transientFailure: true },
  ];
  for (const scenario of scenarios) {
    activeScenario = scenario.name;
    dashboardRequests = 0;
    submitRequests = 0;
    transientDashboardFailure = scenario.transientFailure;
    await writeFile(
      join(homeDir, ".straude", "config.json"),
      JSON.stringify({
        token: "e2e-token",
        username: "packaged-e2e",
        api_url: `http://127.0.0.1:${address.port}`,
        last_push_date: date,
        usage_protocol_v2_migration_completed_at: new Date().toISOString(),
      }),
    );

    const startedAt = performance.now();
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cli, ...scenario.args, "--debug"],
      {
        cwd: installDir,
        env: childEnvironment,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const elapsedMs = Math.round(performance.now() - startedAt);
    const output = `${stdout}\n${stderr}`;
    const passed = output.includes("Synced 1 day")
      && output.includes("@packaged-e2e")
      && output.includes("$12.50 this week")
      && !output.includes("dashboard unavailable")
      && submitRequests === 1
      && elapsedMs >= dashboardDelayMs;
    report.scenarios.push({
      name: scenario.name,
      args: scenario.args,
      passed,
      elapsed_ms: elapsedMs,
      submit_requests: submitRequests,
      dashboard_requests: dashboardRequests,
      stdout,
      stderr,
    });
    await saveReport();
    if (!passed) {
      throw new Error(`Packaged CLI failed ${scenario.name}:\n${output}\nReport: ${reportPath}`);
    }
    console.log(`${scenario.name} passed on Node ${process.version} (${elapsedMs}ms)`);
  }
  activeScenario = "synthetic-401-pending-recovery";
  rejectAuthentication = true;
  transientDashboardFailure = false;
  submitRequests = 0;
  dashboardRequests = 0;
  acceptedRequestIds.length = 0;
  const configPath = join(homeDir, ".straude", "config.json");
  const previousDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const emptyDate = [previousDate.getFullYear(), String(previousDate.getMonth() + 1).padStart(2, "0"), String(previousDate.getDate()).padStart(2, "0")].join("-");
  await writeFile(configPath, JSON.stringify({
    ...JSON.parse(await readFile(configPath, "utf8")),
    last_push_date: emptyDate,
    ccusage_version_pushed: installedCcusage.version,
  }));
  const recoveryArgs = ["push", "--non-interactive"];
  let rejected;
  try {
    await execFileAsync(process.execPath, [cli, ...recoveryArgs], { cwd: installDir, env: childEnvironment });
    throw new Error("An expired credential unexpectedly synced.");
  } catch (error) {
    if (error.code !== 2) throw error;
    rejected = { stdout: error.stdout, stderr: error.stderr, exit_code: error.code };
  }
  const healthPath = join(homeDir, ".straude", "sync-health.json");
  const outboxPath = join(homeDir, ".straude", "pending-sync.json");
  const pendingText = await readFile(outboxPath, "utf8");
  const pending = JSON.parse(pendingText);
  const blockedConfig = JSON.parse(await readFile(join(homeDir, ".straude", "config.json"), "utf8"));
  const blockedHealth = JSON.parse(await readFile(healthPath, "utf8"));
  const blockedStatus = await execFileAsync(process.execPath, [cli, "auto"], { cwd: installDir, env: childEnvironment });
  if (!blockedHealth.auth_required_at || !blockedHealth.last_success_at || !blockedStatus.stdout.includes("straude login")
      || submitRequests !== 1 || dashboardRequests !== 0 || pending.batches.length !== 1) {
    throw new Error("Background authentication failure was not visible in auto status.");
  }
  const allowedHealthKeys = new Set(["account_key", "last_success_at", "auth_required_at"]);
  if (Object.keys(blockedHealth).some(key => !allowedHealthKeys.has(key))
      || !/^[a-f0-9]{64}$/.test(blockedHealth.account_key)
      || !Number.isFinite(Date.parse(blockedHealth.auth_required_at))
      || !Number.isFinite(Date.parse(blockedHealth.last_success_at))) {
    throw new Error("Sync health must contain only an opaque account key and timestamps.");
  }
  if (!rejected.stderr.includes("straude login") || authInitRequests !== 0
      || rejectedRequests.length !== 1
      || JSON.stringify(rejectedRequests[0]) !== JSON.stringify(pending.batches[0].request)
      || pending.batches[0].watermark_date !== date
      || blockedConfig.last_push_date !== emptyDate) {
    throw new Error("A rejected noninteractive submission lost its payload or started login.");
  }
  // A dry run must not claim that the server accepted the expired credential.
  await execFileAsync(process.execPath, [cli, "push", "--date", date, "--dry-run", "--non-interactive"], { cwd: installDir, env: childEnvironment });
  if (await readFile(outboxPath, "utf8") !== pendingText
      || JSON.stringify(JSON.parse(await readFile(healthPath, "utf8"))) !== JSON.stringify(blockedHealth)
      || JSON.parse(await readFile(join(homeDir, ".straude", "config.json"), "utf8")).last_push_date !== blockedConfig.last_push_date
      || submitRequests !== 1) {
    throw new Error("Dry run cleared the sign-in requirement without a submission.");
  }
  // A separate background invocation must retry the identical durable request,
  // even when its requested local date has no logs. It must not open a browser.
  try {
    await execFileAsync(process.execPath, [cli, "push", "--date", emptyDate, "--non-interactive"], { cwd: installDir, env: childEnvironment });
    throw new Error("Pending expired work unexpectedly disappeared during an empty scan.");
  } catch (error) {
    if (error.code !== 2) throw error;
  }
  if (await readFile(outboxPath, "utf8") !== pendingText || authInitRequests !== 0
      || rejectedRequests.length !== 2
      || JSON.stringify(rejectedRequests[1]) !== JSON.stringify(pending.batches[0].request)
      || JSON.parse(await readFile(healthPath, "utf8")).last_success_at !== blockedHealth.last_success_at
      || JSON.parse(await readFile(configPath, "utf8")).last_push_date !== emptyDate) {
    throw new Error("Repeated background rejection changed durable work or invented acceptance.");
  }
  const originalConfig = await readFile(configPath, "utf8");
  await writeFile(configPath, JSON.stringify({ ...JSON.parse(originalConfig), token: "other-account-token" }));
  const otherAccountStatus = await execFileAsync(process.execPath, [cli, "auto"], { cwd: installDir, env: childEnvironment });
  if (otherAccountStatus.stdout.includes("Sign-in required") || otherAccountStatus.stdout.includes(blockedHealth.last_success_at)) {
    throw new Error("Another account inherited the prior account's sync health.");
  }
  await writeFile(configPath, originalConfig);
  rejectAuthentication = false;
  const recovered = await execFileAsync(process.execPath, [cli, ...recoveryArgs], { cwd: installDir, env: childEnvironment });
  const recoveredHealth = JSON.parse(await readFile(healthPath, "utf8"));
  const recoveredStatus = await execFileAsync(process.execPath, [cli, "auto"], { cwd: installDir, env: childEnvironment });
  if (recoveredHealth.auth_required_at || !recoveredHealth.last_success_at
      || recoveredStatus.stdout.includes("Sign-in required")
      || !recoveredStatus.stdout.includes(recoveredHealth.last_success_at)
      || acceptedRequestIds.filter(id => id === pending.batches[0].request.request_id).length !== 1
      || JSON.parse(await readFile(outboxPath, "utf8")).batches.length !== 0
      || JSON.parse(await readFile(configPath, "utf8")).last_push_date !== date) {
    throw new Error("Successful sync did not clear the old sign-in notice and show its success time.");
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const recoveredEmptyDate = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, "0"), String(yesterday.getDate()).padStart(2, "0")].join("-");
  const submissionsBeforeEmpty = submitRequests;
  const empty = await execFileAsync(process.execPath, [cli, "push", "--date", recoveredEmptyDate, "--non-interactive"], { cwd: installDir, env: childEnvironment });
  if (!empty.stdout.includes("No usage data") || submitRequests !== submissionsBeforeEmpty
      || JSON.stringify(JSON.parse(await readFile(healthPath, "utf8"))) !== JSON.stringify(recoveredHealth)) {
    throw new Error("An empty local scan changed the last confirmed sync without a submission.");
  }
  report.scenarios.push({
    name: activeScenario, passed: true,
    boundary: "Synthetic 401 followed by loopback acceptance of the same synthetic credential; this is not browser reauthentication or signed-token verification.",
    repeated_401_invocations: 2,
    authentication_init_requests: authInitRequests,
    pending_sha256: digest(pendingText),
    watermark_before_acceptance: blockedConfig.last_push_date,
    watermark_after_acceptance: JSON.parse(await readFile(configPath, "utf8")).last_push_date,
    rejected_request_sha256: rejectedRequests.map(request => digest(JSON.stringify(request))),
    rejected, blocked_health: blockedHealth, blocked_status: blockedStatus.stdout,
    recovered: { stdout: recovered.stdout, stderr: recovered.stderr },
    recovered_health: recoveredHealth, recovered_status: recoveredStatus.stdout,
    other_account_status: otherAccountStatus.stdout,
    replayed_request_id: pending.batches[0].request.request_id,
    accepted_request_ids: [...acceptedRequestIds],
    empty: { stdout: empty.stdout, stderr: empty.stderr },
  });
  await saveReport();
  console.log("synthetic-401-pending-recovery passed (401, visible recovery, account isolation, preserved pending work, dry-run/no-data status, success clears notice)");
  activeScenario = "fresh-dry-run-and-empty-scan";
  const freshHome = join(root, "fresh-home");
  const freshEnvironment = { ...childEnvironment, HOME: freshHome, USERPROFILE: freshHome,
    CODEX_HOME: join(freshHome, "codex"), CLAUDE_CONFIG_DIR: join(freshHome, ".claude") };
  await mkdir(join(freshHome, ".straude"), { recursive: true });
  await mkdir(join(freshHome, "codex", "sessions"), { recursive: true });
  await mkdir(join(freshHome, ".claude", "projects"), { recursive: true });
  await writeFile(join(freshHome, ".straude", "config.json"), await readFile(configPath));
  const submissionsBeforeFresh = submitRequests;
  const freshOutputs = [];
  for (const extraArgs of [["--dry-run"], []]) {
    const output = await execFileAsync(process.execPath, [cli, "push", "--date", date, "--non-interactive", ...extraArgs], { cwd: installDir, env: freshEnvironment });
    freshOutputs.push(output);
  }
  const freshHealth = await readFile(join(freshHome, ".straude", "sync-health.json"), "utf8").catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (freshHealth !== null || submitRequests !== submissionsBeforeFresh
      || !freshOutputs[1].stdout.includes("No usage data")) {
    throw new Error("A first dry run or empty scan invented an accepted sync.");
  }
  report.scenarios.push({ name: activeScenario, passed: true, outputs: freshOutputs, health_created: false, submit_requests: 0 });
  await saveReport();

  activeScenario = "installed-background-hook-invocation";
  if (process.platform === "win32") {
    report.scenarios.push({ name: activeScenario, skipped: true, reason: "POSIX shell invocation requires Linux/macOS; current-candidate Windows CI is separate." });
  } else {
    await writeFile(join(homeDir, ".claude", "settings.json"), "{}\n");
    await execFileAsync(process.execPath, [cli, "--auto", "hooks", "--date", date, "--non-interactive"], { cwd: installDir, env: childEnvironment });
    const settings = JSON.parse(await readFile(join(homeDir, ".claude", "settings.json"), "utf8"));
    const hook = settings.hooks.SessionEnd.flatMap(group => group.hooks)
      .find(entry => entry.type === "command" && entry.command.includes(cli));
    if (!hook || !hook.command.includes("--non-interactive") || hook.async !== true || hook.timeout !== 300) {
      throw new Error("Installed CLI did not install its durable background hook.");
    }
    const submissionsBeforeHook = submitRequests;
    const hookResult = await execFileAsync("/bin/sh", ["-c", hook.command], { cwd: installDir, env: childEnvironment, maxBuffer: 10 * 1024 * 1024 });
    if (submitRequests !== submissionsBeforeHook + 1 || authInitRequests !== 0
        || !hookResult.stdout.includes("Synced 1 day")) {
      throw new Error("The installed background hook did not collect and submit usage without login.");
    }
    report.scenarios.push({ name: activeScenario, passed: true, platform: process.platform,
      boundary: "Actual installed hook command invoked manually through /bin/sh; no Claude SessionEnd event or scheduler daemon execution is claimed.",
      command: hook.command, stdout: hookResult.stdout, stderr: hookResult.stderr,
      submit_requests: submitRequests - submissionsBeforeHook,
      actual_scheduler_execution: "not exercised" });
  }
  await saveReport();
  activeScenario = "unsupported-pending-native-recollection";
  // The legacy outbox is derived from a real native collection. Only its
  // collector version and the explicit missing-source fixture are altered.
  const recollectionHome = join(root, "recollection-home");
  const recollectionConfigPath = join(recollectionHome, ".straude", "config.json");
  const recollectionOutboxPath = join(recollectionHome, ".straude", "pending-sync.json");
  const missingLogs = join(recollectionHome, "missing-codex");
  await mkdir(join(recollectionHome, ".straude"), { recursive: true });
  await mkdir(join(recollectionHome, ".claude", "projects"), { recursive: true });
  await mkdir(join(missingLogs, "sessions"), { recursive: true });
  await writeFile(recollectionConfigPath, JSON.stringify({
    token: "pending-recollection-loopback-only",
    username: "packaged-e2e",
    api_url: `http://127.0.0.1:${address.port}`,
    last_push_date: emptyDate,
    usage_protocol_v2_migration_completed_at: new Date().toISOString(),
    ccusage_version_pushed: installedCcusage.version,
  }));
  const recollectionEnvironment = { ...childEnvironment, HOME: recollectionHome,
    USERPROFILE: recollectionHome, CLAUDE_CONFIG_DIR: join(recollectionHome, ".claude") };
  const recollectionRuns = [];
  async function runRecollection(name, environment = {}) {
    const command = [cli, "push", "--non-interactive"];
    const started = performance.now();
    let result;
    try {
      result = { exit_code: 0, ...await execFileAsync(process.execPath, command, {
        cwd: installDir, env: { ...recollectionEnvironment, ...environment },
        timeout: 90_000, maxBuffer: 10 * 1024 * 1024,
      }) };
    } catch (error) {
      result = { exit_code: error.code, stdout: error.stdout, stderr: error.stderr };
    }
    recollectionRuns.push({ name, command: [process.execPath, ...command],
      elapsed_ms: Math.round(performance.now() - started), ...result });
    return result;
  }
  rejectAuthentication = true;
  assert.equal((await runRecollection("save actual native batch behind synthetic 401")).exit_code, 2);
  const nativePending = JSON.parse(await readFile(recollectionOutboxPath, "utf8"));
  assert.equal(nativePending.batches.length, 1);
  const obsolete = nativePending.batches[0];
  assert.equal(obsolete.request.collector.version, installedCcusage.version);
  obsolete.request.collector.version = "20.0.20";
  const otherAccount = structuredClone(obsolete);
  otherAccount.account_key = "f".repeat(64);
  otherAccount.request.request_id = randomUUID();
  const obsoleteOutbox = { version: nativePending.version, batches: [obsolete, otherAccount] };
  await writeFile(recollectionOutboxPath, JSON.stringify(obsoleteOutbox));
  const obsoleteBytes = await readFile(recollectionOutboxPath, "utf8");
  const unchangedConfig = await readFile(recollectionConfigPath, "utf8");
  const submissionsBeforeRecollection = submitRequests;
  const httpRequestsBeforeRecollection = httpRequests;
  assert.equal((await runRecollection("missing local logs", { CODEX_HOME: missingLogs })).exit_code, 1);
  assert.equal(await readFile(recollectionOutboxPath, "utf8"), obsoleteBytes);
  assert.equal(await readFile(recollectionConfigPath, "utf8"), unchangedConfig);
  assert.equal(submitRequests, submissionsBeforeRecollection);
  assert.equal(httpRequests, httpRequestsBeforeRecollection);

  const missingSourceOutbox = structuredClone(obsoleteOutbox);
  const originalAgent = missingSourceOutbox.batches[0].request.entries[0].agents[0];
  missingSourceOutbox.batches[0].request.entries[0].agents.push({ ...originalAgent, agent: "claude" });
  await writeFile(recollectionOutboxPath, JSON.stringify(missingSourceOutbox));
  const missingSourceBytes = await readFile(recollectionOutboxPath, "utf8");
  assert.equal((await runRecollection("missing prior source inventory")).exit_code, 1);
  assert.equal(await readFile(recollectionOutboxPath, "utf8"), missingSourceBytes);
  assert.equal(await readFile(recollectionConfigPath, "utf8"), unchangedConfig);
  assert.equal(submitRequests, submissionsBeforeRecollection);
  assert.equal(httpRequests, httpRequestsBeforeRecollection);

  await writeFile(recollectionOutboxPath, obsoleteBytes);
  const observedSubmissions = [];
  submissionObserver = async submission => {
    const durable = JSON.parse(await readFile(recollectionOutboxPath, "utf8"));
    assert.ok(!durable.batches.some(batch => batch.request.request_id === obsolete.request.request_id));
    assert.deepEqual(durable.batches.find(batch => batch.request.request_id === submission.request_id)?.request, submission);
    assert.deepEqual(durable.batches.find(batch => batch.account_key === otherAccount.account_key), otherAccount);
    observedSubmissions.push({ request_id: submission.request_id, sha256: digest(JSON.stringify(submission)),
      collector_version: submission.collector.version });
  };
  assert.equal((await runRecollection("replacement durable before synthetic rejection")).exit_code, 2);
  const replacementOutbox = JSON.parse(await readFile(recollectionOutboxPath, "utf8"));
  const replacement = replacementOutbox.batches.find(batch => batch.account_key === obsolete.account_key);
  assert.ok(replacement);
  assert.notEqual(replacement.request.request_id, obsolete.request.request_id);
  assert.equal(replacement.request.collector.version, installedCcusage.version);
  for (const key of ["requested_dates", "watermark_date", "range_mode", "migration_pending"]) {
    assert.deepEqual(replacement[key], obsolete[key]);
  }
  assert.deepEqual(replacement.request.installation, obsolete.request.installation);
  assert.equal(replacement.request.timezone, obsolete.request.timezone);
  assert.deepEqual(replacementOutbox.batches.find(batch => batch.account_key === otherAccount.account_key), otherAccount);
  assert.equal(await readFile(recollectionConfigPath, "utf8"), unchangedConfig);
  const acceptancesBeforeReplay = acceptedRequestIds.filter(id => id === replacement.request.request_id).length;
  rejectAuthentication = false;
  assert.equal((await runRecollection("replay supported replacement and settle once")).exit_code, 0);
  assert.deepEqual(JSON.parse(await readFile(recollectionOutboxPath, "utf8")).batches, [otherAccount]);
  assert.equal(JSON.parse(await readFile(recollectionConfigPath, "utf8")).last_push_date, date);
  const replacementAttempts = observedSubmissions.filter(submission => submission.request_id === replacement.request.request_id);
  assert.equal(replacementAttempts.length, 2);
  assert.equal(replacementAttempts[0].sha256, replacementAttempts[1].sha256);
  assert.equal(acceptedRequestIds.filter(id => id === replacement.request.request_id).length - acceptancesBeforeReplay, 1);
  submissionObserver = undefined;
  report.scenarios.push({ name: activeScenario, passed: true,
    boundary: "Actual installed CLI and native collector; fixture old20.0.20 outbox metadata and missing-source inventory; synthetic credential and loopback401/acceptance. No real API auth or database ingestion.",
    checks: ["missing logs preserve old bytes/config with no HTTP", "missing source preserves old bytes/config with no HTTP",
      "fresh request UUID and installed collector durable before HTTP", "intent, installation, timezone and other account preserved",
      "unchanged replacement replay accepted once, watermark advances after acceptance"],
    obsolete_request_id: obsolete.request.request_id, replacement_request_id: replacement.request.request_id,
    obsolete_outbox_sha256: digest(obsoleteBytes), missing_source_outbox_sha256: digest(missingSourceBytes),
    observed_submissions: observedSubmissions, runs: recollectionRuns });
  await saveReport();
  console.log("unsupported-pending-native-recollection passed (complete native recollection, durable replacement, source/account preservation, replay once)");
  console.log(`straude v${packageJson.version} with ccusage ${installedCcusage.version}; report: ${reportPath}`);
} catch (error) {
  if (!report.scenarios.some(scenario => scenario.name === activeScenario && scenario.passed === false)) {
    report.scenarios.push({ name: activeScenario, passed: false,
      error: { name: error.name, message: String(error.message).slice(0, 8_000),
        exit_code: error.code ?? null, stdout: String(error.stdout ?? "").slice(-8_000), stderr: String(error.stderr ?? "").slice(-8_000) } });
  }
  await saveReport();
  throw error;
} finally {
  if (server) {
    await new Promise((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    });
  }
  await rm(root, { recursive: true, force: true });
}
