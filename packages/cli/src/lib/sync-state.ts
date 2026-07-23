import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  parseUsageSubmitV2,
  type UsageSubmitRequestV2,
} from "@straude/shared/usage-protocol";
import { CONFIG_DIR } from "../config.js";
import { assertCalendarDate } from "./calendar.js";

const OUTBOX_VERSION = 1 as const;
const LOCK_STALE_AFTER_MS = 15 * 60_000;
const LOCK_POLL_MS = 250;
const QUEUE_LOCK_TIMEOUT_MS = 2_000;
const QUEUE_LOCK_STALE_MS = 30_000;
const OUTBOX_LOCK_TIMEOUT_MS = 2_000;
const OUTBOX_LOCK_STALE_MS = 30_000;

export type PendingRangeMode =
  | "explicit_date"
  | "explicit_days"
  | "incremental"
  | "first_sync"
  | "migration";

export interface PendingUsageBatch {
  request: UsageSubmitRequestV2;
  requested_dates: string[];
  /** Last date proven contiguous for automatic-sync watermark advancement. */
  watermark_date?: string;
  range_mode: PendingRangeMode;
  migration_pending: boolean;
  created_at: string;
}

interface OutboxState {
  version: typeof OUTBOX_VERSION;
  batches: PendingUsageBatch[];
}

interface QueueState {
  version: typeof OUTBOX_VERSION;
  dates: string[];
}

interface LockState {
  token: string;
  pid: number;
  started_at: string;
  dates: string[];
}

export interface SyncStatePaths {
  outbox: string;
  lock: string;
  queue: string;
}

export interface SyncLease {
  queuedDates: string[];
  acknowledgeQueuedDates: (dates: string[]) => void;
  release: () => void;
}

const DEFAULT_PATHS: SyncStatePaths = {
  outbox: join(CONFIG_DIR, "pending-sync.json"),
  lock: join(CONFIG_DIR, "sync.lock"),
  queue: join(CONFIG_DIR, "sync-queue.json"),
};

export class SyncStateCorruptError extends Error {
  readonly preservedPath: string;

  constructor(path: string, preservedPath: string) {
    super(`Straude state at ${path} is corrupt. It was preserved at ${preservedPath}.`);
    this.name = "SyncStateCorruptError";
    this.preservedPath = preservedPath;
  }
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
}

function atomicWriteJson(path: string, value: unknown): void {
  ensureParent(path);
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    chmodSync(temporary, 0o600);
    renameSync(temporary, path);
    chmodSync(path, 0o600);
    try {
      const directory = openSync(dirname(path), "r");
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    } catch {
      // Some platforms do not support fsync on directories.
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function preserveCorruptFile(path: string): never {
  const suffix = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const preserved = `${path}.corrupt-${suffix}`;
  renameSync(path, preserved);
  throw new SyncStateCorruptError(path, preserved);
}

function parseOutbox(value: unknown): OutboxState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== OUTBOX_VERSION || !Array.isArray(record.batches)) return null;

  const batches: PendingUsageBatch[] = [];
  for (const candidate of record.batches) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return null;
    const batch = candidate as Record<string, unknown>;
    const parsedRequest = parseUsageSubmitV2(batch.request);
    if (!parsedRequest.ok) return null;
    if (
      !Array.isArray(batch.requested_dates)
      || batch.requested_dates.some((date) => typeof date !== "string")
      || new Set(batch.requested_dates).size !== batch.requested_dates.length
    ) {
      return null;
    }
    const requestedDates = batch.requested_dates as string[];
    try {
      requestedDates.forEach((date) => assertCalendarDate(date));
      if (batch.watermark_date !== undefined) {
        if (
          typeof batch.watermark_date !== "string"
          || !requestedDates.includes(assertCalendarDate(batch.watermark_date))
        ) {
          return null;
        }
      }
    } catch {
      return null;
    }
    if (
      batch.range_mode !== "explicit_date"
      && batch.range_mode !== "explicit_days"
      && batch.range_mode !== "incremental"
      && batch.range_mode !== "first_sync"
      && batch.range_mode !== "migration"
    ) {
      return null;
    }
    if (typeof batch.migration_pending !== "boolean" || typeof batch.created_at !== "string") {
      return null;
    }
    batches.push({
      request: parsedRequest.value,
      requested_dates: requestedDates,
      ...(typeof batch.watermark_date === "string"
        ? { watermark_date: batch.watermark_date }
        : {}),
      range_mode: batch.range_mode,
      migration_pending: batch.migration_pending,
      created_at: batch.created_at,
    });
  }
  return { version: OUTBOX_VERSION, batches };
}

export function loadPendingBatches(
  paths: SyncStatePaths = DEFAULT_PATHS,
): PendingUsageBatch[] {
  if (!existsSync(paths.outbox)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(paths.outbox, "utf8"));
  } catch {
    preserveCorruptFile(paths.outbox);
  }
  const outbox = parseOutbox(parsed);
  if (!outbox) preserveCorruptFile(paths.outbox);
  return outbox.batches;
}

export function savePendingBatches(
  batches: PendingUsageBatch[],
  paths: SyncStatePaths = DEFAULT_PATHS,
): void {
  withFileLock(
    `${paths.outbox}.lock`,
    OUTBOX_LOCK_TIMEOUT_MS,
    OUTBOX_LOCK_STALE_MS,
    "Another Straude process is updating the sync outbox. Retry shortly.",
    () => {
      const validated = parseOutbox({ version: OUTBOX_VERSION, batches });
      if (!validated) throw new Error("Refusing to persist an invalid Straude outbox.");
      atomicWriteJson(paths.outbox, validated);
    },
  );
}

export function upsertPendingBatch(
  batch: PendingUsageBatch,
  paths: SyncStatePaths = DEFAULT_PATHS,
): void {
  withFileLock(
    `${paths.outbox}.lock`,
    OUTBOX_LOCK_TIMEOUT_MS,
    OUTBOX_LOCK_STALE_MS,
    "Another Straude process is updating the sync outbox. Retry shortly.",
    () => {
      const batches = loadPendingBatches(paths);
      const index = batches.findIndex(
        (candidate) => candidate.request.request_id === batch.request.request_id,
      );
      if (index === -1) batches.push(batch);
      else batches[index] = batch;
      const validated = parseOutbox({ version: OUTBOX_VERSION, batches });
      if (!validated) throw new Error("Refusing to persist an invalid Straude outbox.");
      atomicWriteJson(paths.outbox, validated);
    },
  );
}

export function removePendingBatch(
  requestId: string,
  paths: SyncStatePaths = DEFAULT_PATHS,
): void {
  withFileLock(
    `${paths.outbox}.lock`,
    OUTBOX_LOCK_TIMEOUT_MS,
    OUTBOX_LOCK_STALE_MS,
    "Another Straude process is updating the sync outbox. Retry shortly.",
    () => {
      const batches = loadPendingBatches(paths)
        .filter((batch) => batch.request.request_id !== requestId);
      const validated = parseOutbox({ version: OUTBOX_VERSION, batches });
      if (!validated) throw new Error("Refusing to persist an invalid Straude outbox.");
      atomicWriteJson(paths.outbox, validated);
    },
  );
}

function parseQueue(path: string): QueueState {
  if (!existsSync(path)) return { version: OUTBOX_VERSION, dates: [] };
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return preserveCorruptFile(path);
    }
    const record = value as Record<string, unknown>;
    if (
      record.version !== OUTBOX_VERSION
      || !Array.isArray(record.dates)
      || record.dates.some((date) => typeof date !== "string")
    ) {
      return preserveCorruptFile(path);
    }
    const dates = [...new Set(record.dates as string[])].sort();
    dates.forEach((date) => assertCalendarDate(date));
    return { version: OUTBOX_VERSION, dates };
  } catch (error) {
    if (error instanceof SyncStateCorruptError) throw error;
    return preserveCorruptFile(path);
  }
}

function waitSynchronously(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withFileLock<T>(
  lockPath: string,
  timeoutMs: number,
  staleMs: number,
  timeoutMessage: string,
  operation: () => T,
): T {
  ensureParent(lockPath);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const descriptor = openSync(lockPath, "wx", 0o600);
      try {
        return operation();
      } finally {
        closeSync(descriptor);
        unlinkSync(lockPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > staleMs) {
          unlinkSync(lockPath);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(timeoutMessage);
      }
      waitSynchronously(10);
    }
  }
}

function withQueueLock<T>(paths: SyncStatePaths, operation: () => T): T {
  return withFileLock(
    `${paths.queue}.lock`,
    QUEUE_LOCK_TIMEOUT_MS,
    QUEUE_LOCK_STALE_MS,
    "Another Straude process is updating the sync queue. Retry shortly.",
    operation,
  );
}

function enqueueDates(dates: string[], paths: SyncStatePaths): void {
  withQueueLock(paths, () => {
    const queue = parseQueue(paths.queue);
    atomicWriteJson(paths.queue, {
      version: OUTBOX_VERSION,
      dates: [...new Set([...queue.dates, ...dates])].sort(),
    } satisfies QueueState);
  });
}

function peekQueuedDates(paths: SyncStatePaths): string[] {
  return withQueueLock(paths, () => parseQueue(paths.queue).dates);
}

function acknowledgeQueuedDates(dates: string[], paths: SyncStatePaths): void {
  const acknowledged = new Set(dates);
  withQueueLock(paths, () => {
    const queue = parseQueue(paths.queue);
    atomicWriteJson(paths.queue, {
      version: OUTBOX_VERSION,
      dates: queue.dates.filter((date) => !acknowledged.has(date)),
    } satisfies QueueState);
  });
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readLock(path: string): LockState | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.token !== "string"
      || typeof record.pid !== "number"
      || typeof record.started_at !== "string"
      || !Array.isArray(record.dates)
      || record.dates.some((date) => typeof date !== "string")
    ) {
      return null;
    }
    return {
      token: record.token,
      pid: record.pid,
      started_at: record.started_at,
      dates: record.dates as string[],
    };
  } catch {
    return null;
  }
}

function staleLock(lock: LockState | null, now: number): boolean {
  if (!lock) return true;
  const started = Date.parse(lock.started_at);
  if (!processIsAlive(lock.pid)) return true;
  // A live owner remains authoritative even if collection is slow. The age
  // check only guards an implausibly old lock whose PID has since been reused.
  return Number.isFinite(started) && now - started > LOCK_STALE_AFTER_MS * 96;
}

function tryCreateLock(
  dates: string[],
  paths: SyncStatePaths,
): { token: string } | null {
  ensureParent(paths.lock);
  const token = randomUUID();
  const state: LockState = {
    token,
    pid: process.pid,
    started_at: new Date().toISOString(),
    dates,
  };
  try {
    const descriptor = openSync(paths.lock, "wx", 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(state)}\n`, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return { token };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return null;
  }
}

function releaseLock(token: string, paths: SyncStatePaths): void {
  const lock = existsSync(paths.lock) ? readLock(paths.lock) : null;
  if (lock?.token === token) unlinkSync(paths.lock);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquireSyncLease(options: {
  dates: string[];
  interactive: boolean;
  waitMs?: number;
  paths?: SyncStatePaths;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<SyncLease | null> {
  const paths = options.paths ?? DEFAULT_PATHS;
  const requestedDates = [...new Set(options.dates)].sort();
  requestedDates.forEach((date) => assertCalendarDate(date));
  const deadline = Date.now() + (options.waitMs ?? 30_000);
  const wait = options.sleep ?? delay;
  let queued = false;

  while (true) {
    const created = tryCreateLock(requestedDates, paths);
    if (created) {
      return {
        queuedDates: peekQueuedDates(paths),
        acknowledgeQueuedDates: (dates) => acknowledgeQueuedDates(dates, paths),
        release: () => releaseLock(created.token, paths),
      };
    }

    const lock = readLock(paths.lock);
    if (staleLock(lock, Date.now())) {
      try {
        unlinkSync(paths.lock);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      continue;
    }

    if (!queued) {
      enqueueDates(requestedDates, paths);
      queued = true;
    }
    if (!options.interactive) return null;
    if (Date.now() >= deadline) return null;
    await wait(Math.min(LOCK_POLL_MS, Math.max(1, deadline - Date.now())));
  }
}

export function syncStatePathsForDirectory(directory: string): SyncStatePaths {
  return {
    outbox: join(directory, "pending-sync.json"),
    lock: join(directory, "sync.lock"),
    queue: join(directory, "sync-queue.json"),
  };
}

export function getStateFileMode(path: string): number {
  return statSync(path).mode & 0o777;
}
