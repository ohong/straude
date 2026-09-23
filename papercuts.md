# Papercuts

2026-08-09T03:51:58.290Z — gpt-5.6-sol — ohong

running the Mac mini Straude usage upload -> npx hit EPERM because /Users/ohong/.npm contains root-owned files; workaround was a fresh NPM_CONFIG_CACHE under /tmp, which uploaded successfully, but the CLI still exited 1 on /Users/ohong/.straude/config.json permissions

2026-08-22T03:06:02.203Z — gpt-5.6-sol — ohong

running the final autoreview closeout after two fix cycles → reviewer stayed active beyond the repository's five-minute command limit amid repeated local model-cache warnings; stopped per project policy and used full tests plus live preview scoring as the remaining gates

2026-08-22T03:20:04.846Z — gpt-5.6-sol — ohong

running autoreview for PR #151 → Codex model cache and rollout lookup emitted repeated schema/discrepancy warnings before the review completed; review still succeeded after about three minutes

2026-08-25T01:40:00.620Z — opus-5 — ohong

In packages/cli, running 'bun test' instead of 'bun run test' silently uses Bun's built-in runner against vitest-authored specs and reports 16 fake failures plus 12 errors. Cost a detour diagnosing a non-existent regression. Likely cause: package.json test script is 'vitest run', but 'bun test' shadows it without warning.

