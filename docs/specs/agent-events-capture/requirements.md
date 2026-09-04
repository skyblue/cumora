---
feature: agent-events-capture
workflow: orca-feat-builder
created: 2026-08-21
status: approved
approved_by: skyblue
approved_at: 2026-08-21
---

# Requirements: agent-events-capture

## Background

After shipping agent-run-detail v0 (2026-08-21), smoke testing showed: a fresh BYOA Claude run produces 0 events / 0 tool traces / no engine session id in Devtools. Yetone (now Skyblue) flagged this and the team traced the root cause to a wiring gap: the dev branch has new event-emission code in `server/src/agents/computer/daemon.ts`, but the BYOA CLI artifact (`agent-cli@0.1.127`, dist/cli.js) does NOT include that code. As a result, BYOA Claude runs cannot write `engine.session` / `tool.started` / `tool.finished` events to `agent_events`, regardless of how complete the server-side wiring is.

This spec closes that gap so agent-run-detail (and any future observability feature) can be verified end-to-end.

## Goal

> BYOA Claude and BYOA Codex runs on the dev branch must write `engine.session`, `tool.started`, `tool.finished` events to `agent_events` so that Devtools shows session id and a populated trace timeline.

## Functional requirements

### F1. CLI emits engine.session on session acquisition
- When the BYOA CLI obtains a Claude or Codex session id from the local engine, it MUST POST to `POST /runtime/events` with `kind=engine.session`, `level=info`, `stage=engine_session`, `data={ engine, sessionId }`.
- `engine` is restricted to `claude` or `codex`. Empty / unknown engines do not emit.
- `sessionId` after trim must be non-empty; no synthetic ids.
- Contract shape matches dev server's existing `agent-events-capture` consumer (see `server/src/agents/computer/daemon.ts`).

### F2. CLI emits tool.started / tool.finished on tool calls
- When the BYOA CLI's `runTool → executeTool` boundary fires, it MUST:
  - Carry a `runId` from the calling agent_run into the tool execution context.
  - POST `kind=tool.started` before the tool executes.
  - POST `kind=tool.finished` after the tool completes (success or failure).
- This is the code-level boundary Iris identified: today the CLI doesn't pass `runId` through, so tool traces never correlate with the parent run.

### F3. CLI emits engine.failed on engine exit error
- When the local BYOA engine exits with an error (e.g. Codex reconnect exhausted 5/5), CLI MUST POST `kind=engine.failed` with the error reason, **before** closing the run. This is what Iris's earlier "catch 路径不写 engine.session" critique was pointing at — we want both: `engine.failed` always, `engine.session` only on success.

### F4. Local daemon can be built and run from source
- `agent-cli` package MUST support `pnpm build && node dist/cli.js …` (or equivalent) such that a developer can run the CLI directly from the dev branch without `npm exec cumora@latest`.
- The local build path is the e2e smoke surface for verifying F1–F3.

### F5. Local-only validation (publishing is OUT of v0 scope)
- Skyblue decision 2026-08-21: "先A吧, 本地开发。先不考虑发布" — A only, no publish.
- v0 ships when the **local-daemon-from-source** path proves F1–F3 work end-to-end.
- Publishing CLI 0.1.128 (or any registry release) is a **separate, later spec**. Adding it to v0 would conflate local validation with shipping.

## Non-functional requirements

### N1. Backward compat
- A run that fails before any session is acquired MUST still emit at least one event (`engine.failed` or `engine.session` with empty `data.sessionId` rejected → no event) so the run is observable.

### N2. Best-effort writes
- Event emission MUST NOT block the agent turn. If `/runtime/events` returns non-2xx, log + drop. Engine run keeps going.

### N3. tenant gate preserved
- CLI posts MUST go through the existing auth header flow; tenant check stays server-side.

### N4. No raw chain-of-thought
- `tool.started` / `tool.finished` data fields MUST NOT carry reasoning / chain-of-thought. Projection allowlist (from agent-run-detail) applies.

## Out of scope (this spec)

- Display side changes (agent-run-detail already covers this).
- New event kinds beyond `engine.session` / `engine.failed` / `tool.started` / `tool.finished`.
- Managed / cloud runtime observability (BYOA only for v0).
- Pagination / 500-cap / `events.truncated` (separate spec if needed).
- Renaming of `yetone` → `skyblue` (closed 2026-08-21 by Bram).

## Success criteria (exit gate)

1. Fresh BYOA Claude run via **local-daemon-from-source** (`pnpm build && node dist/cli.js …`): `agent_events` for that run has ≥ 1 `engine.session` row with non-empty session id, AND ≥ 1 `tool.started` AND ≥ 1 `tool.finished` row.
2. Fresh BYOA Codex run via local-daemon-from-source: same shape as #1.
3. Codex reconnect-exhaustion path: `engine.failed` row written before run close.
4. `npm run test:agent-events-capture` passes (new test entry, parallel to `test:agent-run-detail`).
5. Publishing CLI 0.1.128 is **not** an exit gate for v0.

## Open questions

- None. Scope locked on Skyblue's "A+B" decision 2026-08-21.