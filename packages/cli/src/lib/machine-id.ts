import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";

const MACHINE_ID_FILE = join(CONFIG_DIR, "machine_id");

let cachedInstallationId: string | null = null;
let cachedAnalyticsFallback: string | null = null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InstallationIdentityError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`${message} (${MACHINE_ID_FILE}).`, options);
    this.name = "InstallationIdentityError";
  }
}

function readDurableId(): string {
  const id = readFileSync(MACHINE_ID_FILE, "utf8").trim();
  if (!UUID_RE.test(id)) {
    throw new InstallationIdentityError(
      "Straude's installation identity is corrupt; restore the file or resolve the device before syncing",
    );
  }
  return id;
}

function createDurableId(): string {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  let descriptor: number | undefined;
  try {
    descriptor = openSync(MACHINE_ID_FILE, "wx", 0o600);
    writeFileSync(descriptor, `${id}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    chmodSync(MACHINE_ID_FILE, 0o600);
    return id;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return readDurableId();
    throw new InstallationIdentityError(
      "Straude could not persist a durable installation identity",
      { cause: error },
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function getInstallationId(): string {
  if (cachedInstallationId) return cachedInstallationId;
  try {
    cachedInstallationId = existsSync(MACHINE_ID_FILE) ? readDurableId() : createDurableId();
    return cachedInstallationId;
  } catch (error) {
    if (error instanceof InstallationIdentityError) throw error;
    throw new InstallationIdentityError(
      "Straude could not load its durable installation identity",
      { cause: error },
    );
  }
}

/**
 * Returns a stable, anonymous per-machine UUID stored at ~/.straude/machine_id.
 * Used as the PostHog distinct_id for users who haven't run `straude login`,
 * so anonymous CLI events aren't all collapsed into a single distinct_id.
 */
export function getMachineId(): string {
  try {
    return getInstallationId();
  } catch {
    // If we can't read/write the file, fall back to a process-local UUID.
    // Worse for analytics (every invocation looks like a new user) but never
    // breaks the CLI for users with read-only home directories.
    cachedAnalyticsFallback ??= randomUUID();
    return cachedAnalyticsFallback;
  }
}

/** Reset the process cache for isolated tests. */
export function _resetMachineIdForTests(): void {
  cachedInstallationId = null;
  cachedAnalyticsFallback = null;
}

/**
 * PostHog distinct_id for an event. Falls back to the machine UUID when the
 * user hasn't logged in yet.
 */
export function getDistinctId(config: { username?: string } | null): string {
  return config?.username || getMachineId();
}
