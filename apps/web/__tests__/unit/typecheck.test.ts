import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("typecheck", () => {
  it("passes tsc --noEmit with no type errors", { timeout: 60_000 }, () => {
    const webRoot = path.resolve(__dirname, "../..");
    try {
      execSync("npx tsc --noEmit -p tsconfig.check.json", {
        cwd: webRoot,
        stdio: "pipe",
        timeout: 60_000,
      });
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      const output = [
        err.stdout?.toString(),
        err.stderr?.toString(),
      ]
        .filter(Boolean)
        .join("\n");
      expect.fail(`TypeScript compilation failed:\n${output}`);
    }
  });
});
