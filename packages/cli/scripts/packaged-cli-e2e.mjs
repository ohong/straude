import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "straude-packaged-e2e-"));
const installDir = join(root, "install");
const homeDir = join(root, "home");
const codexHome = join(homeDir, "codex");
let server;

try {
  await mkdir(installDir, { recursive: true });
  await mkdir(join(homeDir, ".straude"), { recursive: true });
  await writeFile(
    join(installDir, "package.json"),
    JSON.stringify({ private: true }),
  );

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

  const { stdout: packOutput } = await execFileAsync(
    "npm",
    ["pack", "--json", "--pack-destination", root],
    { cwd: new URL("..", import.meta.url) },
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(root, filename);

  await execFileAsync("npm", ["install", "--no-audit", "--no-fund", tarball], {
    cwd: installDir,
  });

  server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/usage/submit" && request.method === "POST") {
      response.end(JSON.stringify({
        results: [{
          date,
          usage_id: "usage-e2e",
          post_id: "post-e2e",
          post_url: "http://straude.test/post/post-e2e",
          action: "created",
        }],
      }));
      return;
    }

    if (request.url !== "/api/cli/dashboard") {
      response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_700));
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
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

  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const cli = join(installDir, "node_modules", ".bin", "straude");
  const startedAt = performance.now();
  const { stdout, stderr } = await execFileAsync(cli, ["push", "--date", date], {
    cwd: installDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CODEX_HOME: codexHome,
      STRAUDE_TELEMETRY_DISABLED: "1",
    },
  });
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

  console.log(`straude v${packageJson.version} packed-install scorecard passed (${elapsedMs}ms)`);
} finally {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await rm(root, { recursive: true, force: true });
}
