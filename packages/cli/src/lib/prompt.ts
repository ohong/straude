import { createInterface } from "node:readline";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

/**
 * Prompt the user with a yes/no question on stdin. Returns true for "y"/"yes"
 * (case-insensitive), false otherwise. Empty input falls back to `defaultValue`.
 *
 * Caller is responsible for checking `isInteractive()` first — calling this in
 * a non-TTY context will hang waiting on stdin.
 */
export function promptYesNo(question: string, defaultValue: boolean): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === "") {
        resolve(defaultValue);
        return;
      }
      resolve(/^y(es)?$/i.test(trimmed));
    });
  });
}
