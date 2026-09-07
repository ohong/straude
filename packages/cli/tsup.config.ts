import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

const externals = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => name !== "@straude/shared",
);

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  // Kept out of the npm package by the package.json files allowlist. Release
  // automation stores it as a CI artifact for stack analysis.
  sourcemap: true,
  shims: false,
  dts: false,
  external: externals,
  noExternal: ["@straude/shared"],
});
