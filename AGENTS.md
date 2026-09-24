# Straude — Agent Instructions

Project conventions, stack, and design rules live in [CLAUDE.md](CLAUDE.md). Read it first. The testing rules below apply to every agent working in this repo.

## Testing

E2E tests are the default and preferred way to catch bugs. Unit tests are the exception.

- NEVER write unit tests after you write code.
- Tautological tests considered harmful: a test that asserts what its mocks were told to return, or that mocks away the logic it claims to test, proves nothing.
- Change-detector tests considered harmful: a test that pins copy, markup, class names, call counts or internal structure breaks on harmless refactors and never catches a real bug.
- Do not create regression tests for bug fixes without a genuine gap in behavior testing. If an E2E test can cover the behavior, extend the E2E test.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work (Playwright in `apps/web/e2e`, the built binary in `packages/cli/__tests__/e2e` and `packages/cli/scripts/packaged-cli-e2e.mjs`). At the end of E2E tests, produce a verifiable and repeatable artifact (for example a Playwright report, trace or screenshot, or a CLI transcript) that someone else can inspect and regenerate.
- If you must test a system in isolation, FIRST write all the ways it could fail, THEN write the code. The unit tests that remain in this repo cover failure modes E2E cannot reach, such as pricing math, auth checks and date edge cases.
