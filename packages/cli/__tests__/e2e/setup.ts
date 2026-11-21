import { execFileSync } from "node:child_process";

export default function setup() {
  // Every worker must launch the binary from this checkout, including filtered runs.
  execFileSync("bun", ["run", "build"], { cwd: new URL("../../", import.meta.url), stdio: "inherit" });
}
