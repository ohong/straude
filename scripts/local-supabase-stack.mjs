import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const source = path.join(root, "supabase");
const workdir = path.join(source, ".temp", "worktree-stack");
const target = path.join(workdir, "supabase");

const [action, ...args] = process.argv.slice(2);
const configure = action === "up" || action === "setup";
const validRuntime = args.length === 2 && args[0] === "--runtime"
  && ["auto", "docker", "podman", "native"].includes(args[1]);

const statusEnv = action === "status" && args.length === 1 && args[0] === "--env";
const noArguments = args.length === 0;
if (!(configure && (validRuntime || noArguments))
  && !(action === "status" && (statusEnv || noArguments))
  && !(["down", "reset"].includes(action) && noArguments)) {
  console.error("Usage: bun run local:stack:{setup,up} [--runtime auto|docker|podman|native]");
  console.error("       bun run local:stack:{down,reset} | bun run local:stack:status [--env]");
  process.exit(1);
}

if (configure) {
  const config = Bun.TOML.parse(await Bun.file(path.join(source, "config.toml")).text());
  config.local_smtp = config.inbucket;
  delete config.inbucket;
  delete config.api.tls;
  delete config.experimental;
  delete config.edge_runtime.deno_version;
  delete config.edge_runtime.inspector_port;
  delete config.db.shadow_port;
  delete config.studio.api_url;
  delete config.studio.openai_api_key;
  for (const service of [config.api, config.db, config.db.pooler, config.studio, config.local_smtp, config.analytics]) {
    delete service.port;
  }

  mkdirSync(target, { recursive: true });
  for (const name of ["migrations", "seed.sql"]) {
    try {
      symlinkSync(path.relative(target, path.join(source, name)), path.join(target, name));
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }

  const scratch = mkdtempSync(path.join(target, ".config-"));
  try {
    const configPath = path.join(scratch, "config.jsonc");
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    renameSync(configPath, path.join(target, "config.jsonc"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    !key.startsWith("SUPABASE_") || key === "SUPABASE_NATIVE_POSTGRES_USER"),
);
env.SUPABASE_EXPERIMENTAL_STACK = "1";

function cli(command, { capture = false, format = "text" } = {}) {
  const result = Bun.spawnSync(
    ["bunx", "--package", "supabase@3.4.0", "supabase", ...command,
      "--workdir", workdir, "--output-format", format],
    { cwd: root, env, stdin: "inherit", stderr: "inherit", stdout: capture ? "pipe" : "inherit" },
  );
  if (result.error) throw result.error;
  if (result.exitCode !== 0) {
    if (capture) process.stderr.write(result.stdout);
    process.exit(result.exitCode || 1);
  }
  return result.stdout?.toString();
}

if (configure) {
  const status = cli(["stack", "start", ...args], { capture: true, format: "json" });
  const { env: { API_URL, DB_URL }, runtime } = JSON.parse(status);
  console.log(`Supabase (${runtime}) listening at ${API_URL} (database port ${new URL(DB_URL).port}).`);
} else if (action === "down") {
  cli(["stack", "stop"]);
} else if (action === "reset") {
  cli(["db", "reset", "--yes"]);
} else {
  cli(["stack", "status", ...args]);
}

if (action === "setup") {
  const status = cli(["stack", "status", "--env"], { capture: true });
  const scratch = mkdtempSync(path.join(workdir, ".status-"));
  const statusPath = path.join(scratch, "stack.env");
  try {
    writeFileSync(statusPath, status, { mode: 0o600 });
    const result = Bun.spawnSync(
      ["bun", "run", "local:env", "--status-file", statusPath],
      { cwd: root, stdout: "inherit", stderr: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.exitCode !== 0) process.exitCode = result.exitCode || 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
