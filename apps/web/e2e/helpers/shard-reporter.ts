import type { FullConfig, Reporter, Suite } from "@playwright/test/reporter";
import { writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// These two suites exercise the built or packed CLI; other specs need only the web app.
const nativeFiles = new Set(["packaged-cli-first-sync.spec.ts", "private-workspaces.spec.ts"]);

export default class ShardReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {
    const directory = process.env.RUNNER_TEMP;
    const shard = process.env.BROWSER_SHARD;
    if (!directory || !shard || !["app", "native", "global"].includes(shard)) {
      throw new Error("Expected RUNNER_TEMP and a configured browser shard");
    }
    const files = new Set<string>();
    const ids: string[] = [];
    for (const test of suite.allTests()) {
      const file = relative(config.rootDir, test.location.file).split(sep).join("/");
      const project = test.parent.project()!.name;
      const owner = project === "global-state" ? "global" : nativeFiles.has(file) ? "native" : "app";
      if (owner === shard) {
        files.add(`[${project}] > ${file}`);
        ids.push(test.id);
      }
    }
    if (!ids.length) throw new Error(`No tests discovered for ${shard}`);
    writeFileSync(join(directory, "browser-shard.txt"), [...files].sort().join("\n") + "\n");
    writeFileSync(join(directory, "browser-expected.json"), JSON.stringify(ids.sort()));
  }
}
