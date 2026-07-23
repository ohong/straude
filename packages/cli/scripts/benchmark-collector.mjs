import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(
  packageDir,
  "__tests__",
  "fixtures",
  "ccusage-gpt-5.6",
  "codex",
  "sessions",
);
const collectorPackagePath = require.resolve("ccusage/package.json");
const collectorPackage = JSON.parse(await readFile(collectorPackagePath, "utf8"));
const collectorCli = join(dirname(collectorPackagePath), collectorPackage.bin.ccusage);
const ranges = [1, 3, 7, 30];
const iterations = Number.parseInt(
  process.env.STRAUDE_COLLECTOR_BENCH_ITERATIONS ?? "7",
  10,
);
const anchor = "2026-07-09";

const collectorVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
    .exec(collectorPackage.version);
if (
  !collectorVersion
  || Number(collectorVersion[1]) < 20
  || (
    Number(collectorVersion[1]) === 20
    && Number(collectorVersion[2]) === 0
    && Number(collectorVersion[3]) < 18
  )
) {
  throw new Error(
    `Expected stable ccusage >=20.0.18, found ${collectorPackage.version}`,
  );
}
if (!Number.isInteger(iterations) || iterations < 3) {
  throw new Error(
    "STRAUDE_COLLECTOR_BENCH_ITERATIONS must be an integer of at least 3",
  );
}

function dateAtOffset(offset) {
  const date = new Date(`${anchor}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function compactDate(date) {
  return date.replaceAll("-", "");
}

function percentile(sorted, value) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

async function runCollector({ codexHome, homeDir, days }) {
  const since = dateAtOffset(-(days - 1));
  const startedAt = performance.now();
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      collectorCli,
      "daily",
      "--json",
      "--since",
      compactDate(since),
      "--until",
      compactDate(anchor),
      "--timezone",
      "UTC",
      "--by-agent",
      "--offline",
    ],
    {
      cwd: homeDir,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        HOME: homeDir,
        USERPROFILE: homeDir,
        NO_COLOR: "1",
      },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 240_000,
    },
  );
  const result = JSON.parse(stdout);
  if (!Array.isArray(result.daily) || result.daily.length !== days) {
    throw new Error(
      `Expected ${days} collector rows, received ${result.daily?.length ?? "invalid output"}`,
    );
  }
  if (result.daily.some((entry) => entry.agents?.length !== 1)) {
    throw new Error("Collector benchmark lost the per-agent breakdown");
  }
  return performance.now() - startedAt;
}

const root = await mkdtemp(join(tmpdir(), "straude-collector-benchmark-"));
try {
  const homeDir = join(root, "home");
  const codexHome = join(root, "codex");
  const sessionsDir = join(codexHome, "sessions");
  await mkdir(homeDir, { recursive: true });
  await mkdir(sessionsDir, { recursive: true });

  const templates = await Promise.all(
    (await readdir(fixtureDir))
      .filter((filename) => filename.endsWith(".jsonl"))
      .sort()
      .map(async (filename) => ({
        filename,
        contents: await readFile(join(fixtureDir, filename), "utf8"),
      })),
  );
  if (templates.length === 0) {
    throw new Error(`No collector fixtures found in ${fixtureDir}`);
  }

  for (let offset = -29; offset <= 0; offset += 1) {
    const date = dateAtOffset(offset);
    await Promise.all(
      templates.map(({ filename, contents }) =>
        writeFile(
          join(sessionsDir, `${date}-${filename}`),
          contents.replaceAll(anchor, date),
          { mode: 0o600 },
        ),
      ),
    );
  }

  const measurements = [];
  for (const days of ranges) {
    const coldMs = await runCollector({ codexHome, homeDir, days });
    const warmSamples = [];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      warmSamples.push(await runCollector({ codexHome, homeDir, days }));
    }
    warmSamples.sort((left, right) => left - right);
    measurements.push({
      days,
      fixture_sessions: days * templates.length,
      cold_ms: Number(coldMs.toFixed(1)),
      warm_median_ms: Number(percentile(warmSamples, 0.5).toFixed(1)),
      warm_p95_ms: Number(percentile(warmSamples, 0.95).toFixed(1)),
    });
  }

  console.log(
    JSON.stringify(
      {
        collector: `ccusage@${collectorPackage.version}`,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        timezone: "UTC",
        pricing: "offline fixture pricing",
        warm_iterations: iterations,
        measurements,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
