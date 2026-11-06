import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { workspaceDateRange } from "../src/commands/workspace.js";
import { assertWorkspaceAccount, loadWorkspaceSource, saveWorkspaceSource, type WorkspaceSource } from "../src/lib/workspace-source.js";
import { syncAccountKey } from "../src/lib/sync-account.js";
import { parseCliArgs } from "../src/lib/args.js";

const config = { token: `x.${Buffer.from(JSON.stringify({ sub: "private-engineer" })).toString("base64url")}.x`, api_url: "http://localhost:3099", username: "" };
const source: WorkspaceSource = { version: 1, workspace_id: "11111111-1111-4111-8111-111111111111", installation_id: "22222222-2222-4222-8222-222222222222", account_key: syncAccountKey(config), api_url: config.api_url, source_id: "33333333-3333-4333-8333-333333333333", start_date: "2026-11-02" };
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("private sharing boundaries", () => {
  it("never selects historical or future days, even with a backfill request", () => {
    expect(workspaceDateRange(source, { days: 30 }, "2026-11-04")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(workspaceDateRange(source, {}, "2026-11-01")).toEqual([]);
    expect(() => workspaceDateRange(source, { date: "2026-11-01" }, "2026-11-04")).toThrow();
    expect(() => workspaceDateRange(source, { date: "2026-11-05" }, "2026-11-04")).toThrow();
    expect(workspaceDateRange(source, {}, "2026-12-10")).toHaveLength(30);
  });

  it("keeps incomplete enrollment private and cannot collect until confirmed", () => {
    const directory = mkdtempSync(join(tmpdir(), "straude-private-"));
    directories.push(directory);
    const path = join(directory, "workspace.json");
    const { source_id: _, start_date: __, ...pending } = source;
    saveWorkspaceSource({ ...pending, previous_device_id: "44444444-4444-4444-8444-444444444444" }, path);
    const recovered = loadWorkspaceSource(path)!;
    expect(recovered.workspace_id).toBe(source.workspace_id);
    // Retry keeps the old public identity even if auth config has been reset.
    expect(recovered.previous_device_id).toBe("44444444-4444-4444-8444-444444444444");
    saveWorkspaceSource({ ...recovered, source_id: source.source_id, start_date: source.start_date }, path);
    expect(loadWorkspaceSource(path)?.previous_device_id).toBe(recovered.previous_device_id);
    expect(() => workspaceDateRange(recovered, {}, "2026-11-04")).toThrow();
  });

  it("preserves corrupt routing across attempts instead of reverting to public", () => {
    const directory = mkdtempSync(join(tmpdir(), "straude-private-"));
    directories.push(directory);
    const path = join(directory, "workspace.json");
    writeFileSync(path, "interrupted write");
    expect(() => loadWorkspaceSource(path)).toThrow();
    expect(() => loadWorkspaceSource(path)).toThrow();
    expect(readFileSync(path, "utf8")).toBe("interrupted write");
  });

  it("survives token rotation but blocks account and server switches", () => {
    expect(() => assertWorkspaceAccount(source, { ...config, token: config.token.replace(/^x/, "rotated") })).not.toThrow();
    expect(() => assertWorkspaceAccount(source, { ...config, token: "another-account" })).toThrow();
    expect(() => assertWorkspaceAccount(source, { ...config, api_url: "https://straude.com" })).toThrow();
  });

  it("requires a workspace and accepts work-only consent only for enrollment", () => {
    expect(parseCliArgs(["workspace", "connect", source.workspace_id, "--work-only"]).options.workOnly).toBe(true);
    expect(() => parseCliArgs(["push", "--work-only"])).toThrow();
    expect(() => parseCliArgs(["workspace", "connect"])).toThrow();
  });
});
