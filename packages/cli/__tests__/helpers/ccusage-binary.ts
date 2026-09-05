import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const packageJson = require.resolve("ccusage/package.json");
const ccusageRequire = createRequire(packageJson);
const nativePackage = `@ccusage/ccusage-${process.platform}-${process.arch}`;
const binary = ccusageRequire.resolve(`${nativePackage}/bin/ccusage${process.platform === "win32" ? ".exe" : ""}`);
export const bundledCcusageVersion: string = require(packageJson).version;

export async function runBundledCcusage(
  args: string[],
  fixtureHome: string,
  sourceRoots: Record<string, string> = {},
) {
  return promisify(execFile)(binary, args, {
    cwd: fixtureHome,
    timeout: 10_000,
    encoding: "utf8",
    // An allowlist prevents inherited source overrides, XDG paths, configuration,
    // and pricing caches from loading a developer's real usage into fixtures.
    env: {
      HOME: fixtureHome,
      USERPROFILE: fixtureHome,
      XDG_CONFIG_HOME: `${fixtureHome}/.config`,
      XDG_DATA_HOME: `${fixtureHome}/.local/share`,
      XDG_CACHE_HOME: `${fixtureHome}/.cache`,
      APPDATA: `${fixtureHome}/AppData/Roaming`,
      LOCALAPPDATA: `${fixtureHome}/AppData/Local`,
      SYSTEMROOT: process.env.SYSTEMROOT,
      TZ: "UTC",
      ...sourceRoots,
    },
  });
}
