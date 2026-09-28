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
const expectedCcusageRange = ">=20.0.20";

function isCompatibleCcusageVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
    .exec(version);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  return major > 20 || (major === 20 && (minor > 0 || patch >= 20));
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
let submitRequests = 0;
let transientDashboardFailure = false;
const dashboardDelayMs = 3_500;
const reportPath = resolve(readOption("--report") ?? join(packageDir, "test-results", "packaged-cli-e2e.json"));
const report = { node: process.version, dashboard_delay_ms: dashboardDelayMs, scenarios: [] };

try {
  await mkdir(installDir, { recursive: true });
  await mkdir(join(homeDir, ".straude"), { recursive: true });
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
      `Packed CLI installed incompatible ccusage ${installedCcusage.version}; expected a stable version >=20.0.20`,
    );
  }

  const cli = join(installedPackageDir, "dist", "index.js");
  const childEnvironment = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    CODEX_HOME: codexHome,
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
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/usage/submit" && request.method === "POST") {
      submitRequests += 1;
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const submission = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (submission.protocol_version !== 2) {
        throw new Error(`Expected usage protocol v2, got ${submission.protocol_version}`);
      }
      if (submission.collector?.version !== installedCcusage.version) {
        throw new Error(
          `Expected installed ccusage ${installedCcusage.version}, got ${submission.collector?.version}`,
        );
      }
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
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    if (!passed) {
      throw new Error(`Packaged CLI failed ${scenario.name}:\n${output}\nReport: ${reportPath}`);
    }
    console.log(`${scenario.name} passed on Node ${process.version} (${elapsedMs}ms)`);
  }
  console.log(`straude v${packageJson.version} with ccusage ${installedCcusage.version}; report: ${reportPath}`);
} finally {
  if (server) {
    await new Promise((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    });
  }
  await rm(root, { recursive: true, force: true });
}
