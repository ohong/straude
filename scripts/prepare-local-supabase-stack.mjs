import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const source = path.resolve(import.meta.dir, "..", "supabase");

export async function prepareLocalStack(workdir) {
  const target = path.join(workdir, "supabase");
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

if (import.meta.main) {
  const workdir = process.argv[2];
  if (!workdir || !path.isAbsolute(workdir)) {
    console.error("Expected an absolute path to a disposable Supabase workdir.");
    process.exit(1);
  }
  await prepareLocalStack(workdir);
}
