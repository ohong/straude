export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "chore",
        "refactor",
        "test",
        "ci",
        "perf",
        "style",
        "build",
        "revert",
      ],
    ],
    "header-max-length": [2, "always", 100],
  },
};
