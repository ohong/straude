import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireSyncLease,
  getStateFileMode,
  loadPendingBatches,
  removePendingBatch,
  syncStatePathsForDirectory,
  SyncStateCorruptError,
  upsertPendingBatch,
  type PendingUsageBatch,
} from "../src/lib/sync-state.js";

const directories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "straude-sync-state-"));
  directories.push(directory);
  return directory;
}

function batch(): PendingUsageBatch {
  const date = "2026-07-23";
  return {
    request: {
      protocol_version: 2,
      request_id: randomUUID(),
      source: "cli",
      timezone: "UTC",
      installation: { id: randomUUID() },
      collector: {
        name: "ccusage",
        version: "20.0.16",
        pricing_mode: "online",
      },
      entries: [{
        date,
        content_hash: "a".repeat(64),
        agents: [{
          agent: "codex",
          models: ["gpt-5"],
          input_tokens: 1,
          output_tokens: 1,
          reasoning_output_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0,
          total_tokens: 2,
          cost_usd: 0.01,
          model_breakdown: [{
            model: "gpt-5",
            input_tokens: 1,
            output_tokens: 1,
            reasoning_output_tokens: 0,
            cache_creation_tokens: 0,
            cache_read_tokens: 0,
            total_tokens: 2,
            cost_usd: 0.01,
          }],
        }],
      }],
    },
    requested_dates: [date],
    range_mode: "incremental",
    migration_pending: false,
    created_at: "2026-07-23T12:00:00.000Z",
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(directories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe("durable sync state", () => {
  it("atomically round-trips validated outbox batches with owner-only permissions", () => {
    const paths = syncStatePathsForDirectory(temporaryDirectory());
    const pending = batch();
    upsertPendingBatch(pending, paths);

    expect(loadPendingBatches(paths)).toEqual([pending]);
    expect(getStateFileMode(paths.outbox)).toBe(0o600);

    removePendingBatch(pending.request.request_id, paths);
    expect(loadPendingBatches(paths)).toEqual([]);
  });

  it("preserves a corrupt outbox and fails clearly", () => {
    const directory = temporaryDirectory();
    const paths = syncStatePathsForDirectory(directory);
    writeFileSync(paths.outbox, "{bad json", "utf8");

    expect(() => loadPendingBatches(paths)).toThrow(SyncStateCorruptError);
    expect(existsSync(paths.outbox)).toBe(false);
    const preserved = readdirSync(directory).find((name) => name.startsWith("pending-sync.json.corrupt-"));
    expect(preserved).toBeDefined();
    expect(readFileSync(join(directory, preserved!), "utf8")).toBe("{bad json");
  });

  it("coalesces a background duplicate into the queue", async () => {
    const paths = syncStatePathsForDirectory(temporaryDirectory());
    const first = await acquireSyncLease({
      dates: ["2026-07-22"],
      interactive: false,
      paths,
    });
    expect(first).not.toBeNull();

    const duplicate = await acquireSyncLease({
      dates: ["2026-07-23"],
      interactive: false,
      paths,
    });
    expect(duplicate).toBeNull();
    first!.release();

    const next = await acquireSyncLease({
      dates: ["2026-07-24"],
      interactive: false,
      paths,
    });
    expect(next?.queuedDates).toEqual(["2026-07-23"]);
    next?.acknowledgeQueuedDates(["2026-07-23"]);
    next?.release();

    const final = await acquireSyncLease({
      dates: ["2026-07-24"],
      interactive: false,
      paths,
    });
    expect(final?.queuedDates).toEqual([]);
    final?.release();
  });
});
