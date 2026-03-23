import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const CONFIG_DIR = join(homedir(), ".straude");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const DEFAULT_API_URL = "https://straude.com";
export const CLI_VERSION = pkg.version;

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 300_000; // 5 minutes

export const MAX_BACKFILL_DAYS = 7;

export const DEFAULT_SUBPROCESS_TIMEOUT_MS = 240_000; // 4 minutes

// Auto-push scheduler
export const AUTO_PUSH_LOG_FILE = join(CONFIG_DIR, "auto-push.log");
export const AUTO_PUSH_SCRIPT_FILE = join(CONFIG_DIR, "auto-push.sh");
export const AUTO_PUSH_DEFAULT_TIME = "21:00";
export const LAUNCHD_PLIST_PATH = join(
  homedir(),
  "Library",
  "LaunchAgents",
  "com.straude.auto-push.plist",
);
export const AUTO_PUSH_LOG_MAX_BYTES = 1_048_576; // 1 MB
export const AUTO_PUSH_LOG_KEEP_LINES = 500;
