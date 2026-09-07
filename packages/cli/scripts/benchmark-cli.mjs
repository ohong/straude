import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const iterations = Number.parseInt(process.env.STRAUDE_BENCH_ITERATIONS ?? "15", 10);

if (!Number.isInteger(iterations) || iterations < 3) {
  throw new Error("STRAUDE_BENCH_ITERATIONS must be an integer of at least 3");
}

function percentile(sorted, value) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

async function time(command, args, options) {
  const startedAt = performance.now();
  await execFileAsync(command, args, options);
  return performance.now() - startedAt;
}

const root = await mkdtemp(join(tmpdir(), "straude-benchmark-"));
try {
  const installDir = join(root, "install");
  const homeDir = join(root, "home");
  await mkdir(installDir, { recursive: true });
  await mkdir(homeDir, { recursive: true });
  await writeFile(join(installDir, "package.json"), JSON.stringify({ private: true }));

  const { stdout } = await execFileAsync(
    npm,
    ["pack", "--json", "--pack-destination", root],
    { cwd: packageDir, maxBuffer: 10 * 1024 * 1024 },
  );
  const jsonStart = stdout.lastIndexOf("\n[");
  const [pack] = JSON.parse(jsonStart === -1 ? stdout : stdout.slice(jsonStart + 1));
  const tarball = join(root, pack.filename);
  await execFileAsync(npm, ["install", "--no-audit", "--no-fund", tarball], {
    cwd: installDir,
    maxBuffer: 10 * 1024 * 1024,
  });

  const manifest = JSON.parse(
    await readFile(join(installDir, "node_modules", "straude", "package.json"), "utf8"),
  );
  const cli = join(installDir, "node_modules", "straude", "dist", "index.js");
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    STRAUDE_TELEMETRY_DISABLED: "1",
  };

  // Warm filesystem caches and create the isolated first-run marker before
  // measuring steady-state process startup.
  await execFileAsync(process.execPath, [cli, "--version"], { cwd: installDir, env });

  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    samples.push(await time(process.execPath, [cli, "--version"], {
      cwd: installDir,
      env,
    }));
  }
  samples.sort((left, right) => left - right);
  const result = {
    package: `straude@${manifest.version}`,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    metric: "warm-cache --version process latency",
    iterations,
    median_ms: Number(percentile(samples, 0.5).toFixed(1)),
    p95_ms: Number(percentile(samples, 0.95).toFixed(1)),
    min_ms: Number(samples[0].toFixed(1)),
    max_ms: Number(samples.at(-1).toFixed(1)),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
