import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  durableBackgroundInvocation,
  exactBackgroundCommand,
} from "../src/lib/background-command.js";

const originalArgv1 = process.argv[1];
const directories: string[] = [];

afterEach(() => {
  process.argv[1] = originalArgv1;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("background CLI command", () => {
  it("pins fallback execution to the current Straude version", () => {
    process.argv[1] = "/tmp/vitest.mjs";
    expect(durableBackgroundInvocation()).toBeNull();
    expect(exactBackgroundCommand()).toBe(
      "npx --yes straude@0.2.0 push --non-interactive",
    );
  });

  it("uses the absolute installed entrypoint when it is durable", () => {
    const directory = mkdtempSync(join(tmpdir(), "straude-background-"));
    directories.push(directory);
    const script = join(directory, "packages", "cli", "dist", "index.js");
    mkdirSync(join(directory, "packages", "cli", "dist"), { recursive: true });
    writeFileSync(script, "#!/usr/bin/env node\n");
    process.argv[1] = script;

    const invocation = durableBackgroundInvocation();

    expect(invocation).toMatchObject({
      executable: expect.stringMatching(/^[/A-Za-z:]/),
      args: [expect.stringMatching(/packages\/cli\/dist\/index\.js$/)],
    });
    expect(exactBackgroundCommand()).toContain("'push' '--non-interactive'");
    expect(exactBackgroundCommand()).not.toContain("straude@0.2.0");
  });
});
