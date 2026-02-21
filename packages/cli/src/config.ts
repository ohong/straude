import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".straude");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const DEFAULT_API_URL = "https://straude.com";
export const CLI_VERSION = "0.1.4";

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 300_000; // 5 minutes

export const MAX_BACKFILL_DAYS = 7;
