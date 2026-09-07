import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const route = fileURLToPath(new URL("../.next/server/app/api/users/me/route.js", import.meta.url));
const result = spawnSync(process.execPath, [
  "--no-experimental-require-module",
  "--eval",
  "require(process.argv[1]);",
  route,
], { stdio: "inherit", timeout: 30_000 });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Profile route loads without experimental require(ESM).");
