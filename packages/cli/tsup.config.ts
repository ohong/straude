import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

const externals = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => name !== "@straude/shared",
);

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: false,
  dts: false,
  external: externals,
  noExternal: ["@straude/shared"],
});
