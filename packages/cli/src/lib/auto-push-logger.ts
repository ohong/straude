import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { AUTO_PUSH_LOG_FILE, AUTO_PUSH_LOG_MAX_BYTES, AUTO_PUSH_LOG_KEEP_LINES } from "../config.js";

const MAX_TAIL_READ_BYTES = 256 * 1024;

export function readLog(lines: number = 50): string[] {
  if (!existsSync(AUTO_PUSH_LOG_FILE)) return [];
  if (!Number.isInteger(lines) || lines <= 0) return [];

  let fd: number | undefined;
  try {
    const size = statSync(AUTO_PUSH_LOG_FILE).size;
    const bytesToRead = Math.min(size, MAX_TAIL_READ_BYTES);
    const buffer = Buffer.alloc(bytesToRead);
    fd = openSync(AUTO_PUSH_LOG_FILE, "r");
    const bytesRead = readSync(fd, buffer, 0, bytesToRead, size - bytesToRead);
    let content = buffer.subarray(0, bytesRead).toString("utf-8");
    if (size > bytesToRead) {
      const firstNewline = content.indexOf("\n");
      content = firstNewline === -1 ? "" : content.slice(firstNewline + 1);
    }
    const allLines = content.split("\n").filter((l) => l.length > 0);
    return allLines.slice(-lines);
  } catch {
    return [];
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Reading logs is best-effort.
      }
    }
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
