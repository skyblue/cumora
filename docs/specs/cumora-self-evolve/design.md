# Cumora 自进化 — Design (v0)

## Architecture

```
┌────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Trigger   │ →  │ Observation │ →  │  Proposer    │ →  │  Reviewer    │
│ (manual    │    │  layer      │    │ (rule-based) │    │ (Yetone +    │
│  cumora    │    │ (read-only  │    │              │    │  git review) │
│  evolve)   │    │  SQL)       │    │              │    │              │
└────────────┘    └─────────────┘    └──────────────┘    └──────────────┘
                       │                    │                    │
                       ▼                    ▼                    ▼
                 observations.json    docs/evolve/         status flip in
                 (per-run snapshot)   proposals/<id>.md    frontmatter
```

Every arrow is a **read or a write to `docs/evolve/`**. No arrow touches application code, schema, or DB writes beyond read queries.

## Repository layout

All new code lives under the fork at `~/Developer/AI/cumora`. New code:

```
agent-cli/src/evolve/
  index.ts          # CLI entry: cumora evolve [run|review|list]
  observe.ts        # F2: read SQL aggregations into observations.json
  propose.ts        # F3: rule-based proposer, writes proposals/*.md
  review.ts         # F4: approve/reject, flips frontmatter
  danger-zone.ts    # N4: hard-coded list of forbidden proposal areas
  types.ts          # Proposal + Observation TS types
  README.md         # how to run, examples
```

New data (not code):

```
docs/evolve/
  README.md                    # how proposals work
  proposals/
    YYYY-MM-DD-<short-id>.md   # one per proposal, git-tracked
  runs/
    YYYY-MM-DDTHH-mm-ss-<id>/
      observations.json
      proposals.txt            # list of proposal IDs created this run
```

`docs/evolve/` is a regular directory; git history becomes the audit log (N2).

## Module specs

### `observe.ts` (F2)

Inputs: nothing (reads DB on invocation).
Outputs: `observations.json` snapshot file in the run dir.

Observation schema (v0):

```ts
type Observations = {
  capturedAt: string                  // ISO timestamp
  lookbackHours: number               // default 168 = 7 days
  convene: {
    sessionCount: number
    avgDurationMinutes: number
    undecidedSessions: number        // sessions with no decision row
    transcriptVolumeByMember: Record<string, number>
  }
  participants: {
    statusFlipCountByMember: Record<string, number>
    idleMembers: string[]             // > 24h since last activity
    erroringMembers: string[]         // > 5 status flips in lookback
  }
  conversations: {
    mostActive: Array<{ id: string; messageCount: number; lastActivityAt: string }>
    stalled: Array<{ id: string; lastActivityAt: string }>  // > 7 days no activity
  }
}
```

Implementation: read-only queries against `pool` from `~/Developer/AI/cumora/server/src/db/pool.ts`. Each query is a single SQL statement, no joins, no transactions.

### `propose.ts` (F3)

Inputs: `observations.json`.
Outputs: one or more proposal markdown files in `docs/evolve/proposals/`.

Rule set (v0 ships with these; v1 may add more):

| Rule ID | Trigger observation | Proposal type | Target file hint |
|---|---|---|---|
| R-CONVENE-NO-DECISION | convene.undecidedSessions > 0 | Add a default check-in prompt template | `server/src/agents/convene.ts` (a constant) |
| R-AGENT-FLIPPY | any statusFlipCountByMember > N | Add a status-throttle heuristic | new file `server/src/agents/status-throttle.ts` |
| R-CONVO-STALLED | conversations.stalled.length > 0 | Add a doc note to dormant convo | new file `docs/notes/<convo-id>.md` |
| R-AGENT-IDLE | any participants.idleMembers | Add a status-reset rule | `server/src/status.ts` |
| R-MOST-ACTIVE | conversations.mostActive top-3 | Promote active convo's doc to surface | new file `docs/surfaces/<convo-id>.md` |

Each rule emits a proposal with all required fields filled. Rules are pure functions: same input → same output. Determinism (N1) is enforced by sorting inputs before any rule fires.

### `review.ts` (F4)

Inputs: `<proposal-id>` + `--approve` or `--reject`.
Outputs: frontmatter `status` field flipped, reviewer comment appended.

CLI:

```
cumora evolve review <id> --approve --comment "looks safe"
cumora evolve review <id> --reject  --comment "risky, not now"
```

This command does NOT apply the diff. It only edits the proposal's frontmatter + appends a comment block.

### `danger-zone.ts` (N4)

Hard-coded set of forbidden proposal areas:

```ts
export const DANGER_ZONE = new Set([
  /server\/src\/db\/migrate/,
  /server\/src\/auth/,
  /server\/src\/oauth/,
  /server\/src\/payments/,
  /server\/src\/api\/billing/,
  /\.env/,
  /\/secrets?\//,
])
```

The proposer refuses to emit any proposal whose `target_files` intersects with `DANGER_ZONE`. If a rule would otherwise emit such a proposal, the rule logs "refused: danger zone" and emits nothing.

## CLI surface

```
cumora evolve run [--lookback-hours N]   # F1, F2, F3
cumora evolve list [--status open]       # F4 (read-side)
cumora evolve review <id> --approve|--reject [--comment T]  # F4
```

## Failure modes

| Failure | Behavior |
|---|---|
| DB unreachable | `observe.ts` exits non-zero with clear error; nothing else runs |
| Rule emits danger-zone proposal | refused silently + log; other rules still run |
| File write fails (perms, disk) | exit non-zero; partial proposals removed |
| Review command on nonexistent ID | exit non-zero with "proposal not found" |
| Frontmatter malformed | review command refuses to edit; suggests `cumora evolve repair <id>` (out of v0) |

## Tests

v0 ships with two test layers:

1. **Unit tests on rules** — pure functions, easy to cover. Each rule has a fixture of `observations.json` and an expected proposal shape.
2. **Round-trip test** — `cumora evolve run --lookback-hours 24` against a seeded SQLite produces N proposals, all with required fields, none touching danger zone. Runs in CI.

No integration test against live Postgres in v0 — that requires infra work that's not worth it for v0.

## What v0 explicitly does NOT design

- The auto-apply path (v1)
- LLM-based proposers (v1)
- Multi-user review (v1+)
- Cron / event triggers (v1)
- A web UI (v1+)

These belong in their own specs once v0 has produced at least one approved-and-applied proposal.