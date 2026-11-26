import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

const path = "supabase/config.toml";
const config = Bun.TOML.parse(readFileSync(path, "utf8"));
config.local_smtp = config.inbucket;
delete config.inbucket;
delete config.api.tls;
delete config.edge_runtime.deno_version;
delete config.experimental;
delete config.studio.api_url;
delete config.studio.openai_api_key;

for (const section of [config.api, config.db, config.studio, config.local_smtp]) {
  delete section.port;
}

writeFileSync("supabase/config.jsonc", JSON.stringify(config), "utf8");
unlinkSync(path);
