import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

async function createTarball(root) {
  const { stdout } = await execFileAsync(
    npm,
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

  await execFileAsync(npm, ["install", "--no-audit", "--no-fund", tarball], {
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
  if (packageJson.dependencies?.ccusage !== "20.0.16") {
    throw new Error(`Packed CLI must pin ccusage 20.0.16, got ${packageJson.dependencies?.ccusage}`);
  }
  if (packageJson.engines?.node !== ">=20") {
    throw new Error(`Packed CLI must require Node >=20, got ${packageJson.engines?.node}`);
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
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const submission = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (submission.protocol_version !== 2) {
        throw new Error(`Expected usage protocol v2, got ${submission.protocol_version}`);
      }
      if (submission.collector?.version !== "20.0.16") {
        throw new Error(`Expected ccusage 20.0.16, got ${submission.collector?.version}`);
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

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_700));
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

  await writeFile(
    join(homeDir, ".straude", "config.json"),
    JSON.stringify({
      token: "e2e-token",
      username: "packaged-e2e",
      api_url: `http://127.0.0.1:${address.port}`,
    }),
  );

  const startedAt = performance.now();
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [cli, "push", "--date", date, "--debug"],
    {
      cwd: installDir,
      env: childEnvironment,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const elapsedMs = Math.round(performance.now() - startedAt);
  const output = `${stdout}\n${stderr}`;

  if (
    !output.includes("Synced 1 day")
    || !output.includes("@packaged-e2e")
    || !output.includes("$12.50 this week")
  ) {
    throw new Error(`Packaged CLI did not render the scorecard:\n${output}`);
  }
  if (elapsedMs < 1_500) {
    throw new Error(`Packaged CLI returned before the delayed scorecard (${elapsedMs}ms)`);
  }

  console.log(
    `straude v${packageJson.version} packed-install scorecard passed on Node ${process.version} (${elapsedMs}ms)`,
  );
} finally {
  if (server) {
    await new Promise((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    });
  }
  await rm(root, { recursive: true, force: true });
}
