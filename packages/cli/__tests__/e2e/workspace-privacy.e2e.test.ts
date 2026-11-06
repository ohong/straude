import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnCli, rmDir } from "./spawn";
import { syncAccountKey } from "../../src/lib/sync-account.js";

let home: string;
const config = { token: `x.${Buffer.from(JSON.stringify({ sub: "private-engineer" })).toString("base64url")}.x`, api_url: "http://127.0.0.1:1", username: "" };
const workspace = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "straude-private-e2e-"));
  mkdirSync(join(home, ".straude"));
  writeFileSync(join(home, ".straude/config.json"), JSON.stringify(config));
});
afterEach(() => rmDir(home));

function route(overrides: Record<string, unknown> = {}) {
  writeFileSync(join(home, ".straude/workspace.json"), JSON.stringify({ version: 1, workspace_id: workspace, installation_id: "22222222-2222-4222-8222-222222222222", account_key: syncAccountKey(config), api_url: config.api_url, source_id: "33333333-3333-4333-8333-333333333333", start_date: "2099-01-01", ...overrides }));
}

describe("built CLI private routing", () => {
  it("does not collect or contact a server before the first shareable day, even with a pending public outbox", async () => {
    route();
    const outbox = join(home, ".straude/pending-sync.json");
    writeFileSync(outbox, "must not be read as private usage");
    const result = await spawnCli({ args: ["push", "--non-interactive", "--days", "30"], home });
    expect(result.exitCode).toBe(0);
    expect(readFileSync(outbox, "utf8")).toBe("must not be read as private usage");
  });

  it("refuses background push after switching credentials and retains privacy", async () => {
    route();
    writeFileSync(join(home, ".straude/config.json"), JSON.stringify({ ...config, token: "other-account" }));
    const result = await spawnCli({ args: ["push", "--non-interactive"], home });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(readFileSync(join(home, ".straude/workspace.json"), "utf8")).workspace_id).toBe(workspace);
  });

  it("stops every attempt on a corrupt marker without moving it aside", async () => {
    const path = join(home, ".straude/workspace.json");
    writeFileSync(path, "broken");
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await spawnCli({ args: ["push", "--non-interactive"], home })).exitCode).toBe(1);
    }
    expect(readFileSync(path, "utf8")).toBe("broken");
  });

  it("does not enroll from a preview without affirmative work-only consent", async () => {
    const result = await spawnCli({ args: ["workspace", "connect", workspace], home });
    expect(result.exitCode).toBe(1);
    expect(() => readFileSync(join(home, ".straude/workspace.json"))).toThrow();
  });
});
