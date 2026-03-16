---
summary: Universal coding conventions — explicit behavior, type safety, frontend consistency, reliability, and behavior-focused verification
last_updated: "2026-03-10 10:05 PDT"
read_when:
  - writing code
  - coding standards
  - code conventions
  - TypeScript
  - frontend
  - backend
  - error handling patterns
  - testing
---

# Code Guide

Write code that keeps behavior explicit, failure visible, and the next change easier than the last one.

## 1. Compatibility is opt-in, not ambient

Do not preserve old behavior unless a user-facing requirement explicitly asks for it.

- Remove replaced paths instead of leaving shims, aliases, or silent compatibility branches.
- Do not keep dead fields, dual formats, or migration-only logic "just in case."
- If compatibility must stay, document the exact contract being preserved and the removal condition.

## 2. Type safety is non-negotiable

The compiler is part of the design, not an afterthought.

- Write as if strict mode is enabled. Type errors are build blockers.
- Never use `any` when `unknown`, narrowing, generics, or better shared types can express the real contract.
- Reuse exported library or app types instead of recreating them locally.
- Be explicit at boundaries: function params, returns, public interfaces, API payloads, DB rows, and shared contracts.
- Validate external data at boundaries with schema validation and convert it into trusted internal shapes once.
- Avoid cross-package type casts unless there is no better contract available; fix the shared types instead when practical.

## 3. Fail clearly, never quietly

Errors are part of the contract.

- Fail explicitly. No silent fallbacks, empty catches, or degraded behavior that pretends everything is fine.
- Every caught exception must propagate, crash, or be surfaced truthfully to the user or operator.
- Do not silently switch to worse models, stale cache, inferred defaults, empty values, or best-effort modes unless that degradation is an intentional product behavior.
- Required configuration has no silent defaults. Missing required config is a startup or boundary failure.
- Error messages should identify what failed, where, and why.

## 4. Validate at boundaries

Anything crossing a boundary is untrusted until proven otherwise.

- Validate user input, config, files, HTTP responses, generated content, database reads, queue payloads, and external API data at the boundary.
- Reject invalid data instead of "normalizing" it into something ambiguous.
- Keep validation near the boundary instead of scattering half-validation deep inside the system.

## 5. Prefer direct code over speculative abstraction

Do not invent complexity for hypothetical future needs.

- Add abstractions only when multiple concrete cases already demand the same shape.
- Prefer straightforward code and small duplication over the wrong generic layer.
- If a helper hides critical validation, state changes, or failure modes, it is probably hurting clarity.

## 6. Make state, contracts, and provenance explicit

Readers should be able to tell what states exist, what transitions are legal, and what data can be trusted.

- Use explicit state representations and enforce invariants at the boundary of the operation.
- Multi-step writes must have clear transaction boundaries.
- Retryable operations must be idempotent or guarded against duplicate effects.
- New schema and persistence work should make provenance obvious and protect against duplication with the right uniqueness constraints, foreign keys, or equivalent invariants.
- Shared schemas, fixtures, and contract types must match the real API and stored data shape.

## 7. Frontend must reuse and fit the existing system

Frontend changes should extend the app, not fork its design language.

- Before creating a new component, check whether the app already has a component or pattern that should be reused.
- Reuse existing components when they satisfy the need, even if minor adaptation is required.
- When a new component is necessary, make it match the design language, interaction model, spacing, states, and compositional patterns of the rest of the app.
- Handle all states for async and data-driven UI: loading, success, empty, error.
- Optimistic UI must have an explicit rollback or invalidation strategy. Never leave optimistic state hanging without a recovery path.

## 8. Observability is part of correctness

If you cannot see the failure path, you have not finished the work.

- Emit structured logs, metrics, or events at important boundaries and state transitions.
- Include enough context to reproduce issues without logging secrets or sensitive data.
- Failed async work, retries, degraded paths, and rejected inputs must leave a useful trace.
- Do not use noisy logging to compensate for unclear control flow.

## 9. Test behavior, not implementation

Tests should protect the contract users depend on.

- Test observable behavior and boundary cases, not implementation trivia.
- Never write brittle regression tests that assert exact class strings, styling internals, private helper calls, incidental DOM structure, internal schema representations, or other implementation-detail artifacts.
- Regression tests must focus on the behavior that was broken and the behavior that is now guaranteed.
- For backend bugs, prefer behavior-focused regression tests by default.
- For frontend bugs, prefer manual QA by default; add automated regression coverage only when there is a stable user-visible behavior worth protecting.
- Do not merge behavior changes without leaving behind executable or clearly documented evidence of the new contract.

## 10. Optimize for future legibility

Write code for the next engineer or agent who has to change it under pressure.

- Keep modules narrow in responsibility and data flow obvious.
- Remove stale branches, half-migrations, dead code, and obsolete docs around the change.
- Keep docs and shipped behavior aligned.
- Before pushing or opening a PR, do a hygiene pass for stale docs, drifting contracts, typing gaps, missing rollback strategies, and new persistence correctness risks.

The best code is not the most flexible code. It is the code whose current truth is obvious, whose failures are visible, and whose wrong parts can be deleted without fear.
