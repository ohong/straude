import { existsSync, realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
import { CLI_VERSION } from "../config.js";

export interface BackgroundInvocation {
  executable: string;
  args: string[];
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function durableBackgroundInvocation(): BackgroundInvocation | null {
  const script = process.argv[1];
  if (!script || !isAbsolute(script) || !existsSync(script)) return null;
  const normalized = script.replaceAll("\\", "/");
  if (
    !/(?:\/node_modules\/straude|\/packages\/cli)\/dist\/index\.js$/.test(normalized)
    || /\/(?:_npx|\.bun\/install\/cache|bunx-)\//.test(normalized)
  ) {
    return null;
  }
  return {
    executable: realpathSync(process.execPath),
    args: [realpathSync(script)],
  };
}

export function exactBackgroundCommand(): string {
  const durable = durableBackgroundInvocation();
  if (durable) {
    return [durable.executable, ...durable.args, "push", "--non-interactive"]
      .map(shellQuote)
      .join(" ");
  }
  return `npx --yes straude@${CLI_VERSION} push --non-interactive`;
}
