import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { AUTO_PUSH_LOG_FILE, AUTO_PUSH_LOG_MAX_BYTES, AUTO_PUSH_LOG_KEEP_LINES } from "../config.js";

export function readLog(lines: number = 50): string[] {
  if (!existsSync(AUTO_PUSH_LOG_FILE)) return [];
  try {
    const content = readFileSync(AUTO_PUSH_LOG_FILE, "utf-8");
    const allLines = content.split("\n").filter((l) => l.length > 0);
    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

export function rotateLog(): void {
  if (!existsSync(AUTO_PUSH_LOG_FILE)) return;
  try {
    const stat = statSync(AUTO_PUSH_LOG_FILE);
    if (stat.size <= AUTO_PUSH_LOG_MAX_BYTES) return;

    const content = readFileSync(AUTO_PUSH_LOG_FILE, "utf-8");
    const lines = content.split("\n");
    const kept = lines.slice(-AUTO_PUSH_LOG_KEEP_LINES).join("\n");
    writeFileSync(AUTO_PUSH_LOG_FILE, kept, "utf-8");
  } catch {
    // Non-critical — skip rotation on error
  }
}
