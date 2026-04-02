/**
 * Lightweight terminal spinner with rotating messages.
 * Inspired by the Claude Code loading sequence — fun, varied messages
 * that make the wait feel intentional rather than broken.
 */

const SCAN_MESSAGES = [
  "Scanning session logs",
  "Crunching tokens",
  "Tallying the damage",
  "Reading the meter",
  "Counting cache hits",
  "Parsing model breakdowns",
  "Summing it all up",
];

const SYNC_MESSAGES = [
  "Syncing to Straude",
  "Updating your stats",
  "Checking the leaderboard",
  "Calculating your streak",
  "Phoning it in",
];

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export class Spinner {
  private messages: string[];
  private interval: ReturnType<typeof setInterval> | null = null;
  private messageInterval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private messageIndex = 0;
  private currentMessage: string;

  constructor(phase: "scan" | "sync") {
    this.messages = phase === "scan" ? SCAN_MESSAGES : SYNC_MESSAGES;
    this.currentMessage = this.messages[0]!;
  }

  start(): void {
    if (!process.stderr.isTTY) return;

    process.stderr.write("\x1B[?25l"); // hide cursor

    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % FRAMES.length;
      this.render();
    }, 80);

    this.messageInterval = setInterval(() => {
      this.messageIndex = (this.messageIndex + 1) % this.messages.length;
      this.currentMessage = this.messages[this.messageIndex]!;
    }, 2500);

    this.render();
  }

  stop(finalMessage?: string): void {
    if (this.interval) clearInterval(this.interval);
    if (this.messageInterval) clearInterval(this.messageInterval);
    this.interval = null;
    this.messageInterval = null;

    if (!process.stderr.isTTY) return;

    // Clear the spinner line and show cursor
    process.stderr.write(`\r\x1B[2K\x1B[?25l`);
    if (finalMessage) {
      process.stderr.write(`${finalMessage}\n`);
    }
    process.stderr.write("\x1B[?25h"); // show cursor
  }

  private render(): void {
    const frame = FRAMES[this.frameIndex]!;
    process.stderr.write(`\r\x1B[2K\x1B[90m${frame} ${this.currentMessage}…\x1B[0m`);
  }
}
