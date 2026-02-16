import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_API_URL } from "../config.js";

export interface StraudeConfig {
  token: string;
  username: string;
  api_url: string;
}

export function loadConfig(): StraudeConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.token) return null;
    return {
      token: parsed.token,
      username: parsed.username ?? "",
      api_url: parsed.api_url ?? DEFAULT_API_URL,
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: StraudeConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function requireAuth(): StraudeConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Not logged in. Run `straude login` first.");
    process.exit(1);
  }
  return config;
}
