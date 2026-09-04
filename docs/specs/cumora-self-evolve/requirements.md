# Cumora 自进化 — Requirements

**Status:** v0 proposal. Awaiting Yetone's final scope sign-off.

**Scope: this spec covers only the v0 slice of "Cumora 自进化".** v1+ (multi-trigger, automatic application, capability emergence as criterion) is out of scope here — it gets its own spec once v0 has been run end-to-end at least once.

## Background

"Cumora 自进化" = a closed loop that improves Cumora (topology, agent prompts, workflows, UI, …) over time. The full ambition is unbounded: any layer can change, any trigger can start a cycle, any measure can judge success. **v0 deliberately narrows that surface to one thing: prove the loop exists and is safe.**

## v0 Goal

> Build a human-in-the-loop observe → propose → approve pipeline. v0 produces **proposals**; it never applies them automatically. The proposal must include (1) what would change, (2) why, (3) predicted impact. Yetone reviews and either approves or rejects.

## Functional requirements

### F1. Manual trigger
- A single command starts an evolution cycle. Yetone only.
- Command surface: a new `cumora evolve` CLI subcommand.
- Output: a proposal document written to `docs/evolve/proposals/<id>.md`.

### F2. Observation layer
- v0 reads from existing data sources in the fork. No new instrumentation.
- Default data sources:
  1. Recent `convene_sessions` and `convene_transcript` rows — what topics came up, who participated, what decisions were made.
  2. Recent `participants.status` transitions — who's been busy / idle / erroring.
  3. Recent `message.new` counts per conversation — what's been active.
- Aggregation is read-only SQL against `~/Developer/AI/cumora/server/src/db/pool.ts`.

### F3. Proposal generator
- Given aggregated observations, the proposer emits one or more **proposals**.
- Each proposal has the shape:
  - **What changes** — a concrete patch candidate (file path + diff hint, or config value, or workflow step)
  - **Why** — the observation(s) that motivated it, with concrete data points
  - **Predicted impact** — which v0 success metric this is expected to move, and by how much
  - **Risk** — what could go wrong, blast radius, rollback plan
- v0 proposer can be rule-based; it does not need an LLM call. Examples:
  - "Conversation X has had 12 messages this week with no human reply → propose a doc note."
  - "Agent Y has flipped status 47 times in 24h → propose a status-throttle heuristic."
  - "Convene session Z ran for 30 minutes with no decision → propose a default-checkin prompt."

### F4. Proposal storage + review
- All proposals land in `docs/evolve/proposals/<id>.md` (git-tracked).
- Proposal frontmatter: `id`, `created_at`, `triggered_by`, `status` (open / approved / rejected / applied), `risk`, `area`.
- Yetone reviews in any normal git workflow: read the file, leave comments, set status.
- A `cumora evolve review <id> --approve|--reject` command flips status and writes a reviewer comment.

### F5. Apply step is OUT OF v0 scope
- v0 stops at approval. Applying the patch to a branch / merging / deploying is manual.
- This is the single hardest constraint of v0 — it's what keeps the loop safe.
- v1 may add an auto-apply path gated by risk level.

## Non-functional requirements

### N1. Determinism
- Same observations → same proposal. No hidden randomness in the rule-based proposer.
- Re-running `cumora evolve` on identical state must produce the same set of proposal IDs.

### N2. Auditability
- Every proposal references the exact SQL query or data slice that produced it.
- Every approval/rejection is timestamped and attributed.
- The whole history is one `git log` away.

### N3. Reversibility
- v0 never mutates the repo or DB. It's a writer to `docs/evolve/`. That's it.
- Even an "approved" proposal still requires Yetone to manually apply the diff.

### N4. Bounded scope
- v0 only proposes changes in: prompt text, status heuristics, doc notes. **NOT** in: schema migrations, auth, payments, deploy.
- A "danger zone" list lives in the design doc; proposer refuses to emit proposals touching it.

## Success criteria (v0 exit gate)

v0 ships when ALL of the following are true within 2 weeks of first run:

1. **The pipeline runs end-to-end at least 3 times** (manual trigger → proposal written → reviewed).
2. **At least 1 proposal gets approved** and the resulting change (applied manually) lands in the fork.
3. **At least 1 proposal gets rejected** (proves the review step actually fires).
4. **The propose step takes < 60 seconds** for a typical observation slice.
5. **No proposal touches the danger zone** — the proposer correctly refuses to emit them.

If any of these fail at the 2-week mark, v0 did not validate the loop; either fix the broken step or stop the project.

## Out of scope (v0)

- Automatic triggers (cron, bus event, self-reflection)
- Automatic application of approved proposals
- LLM-based proposers (v0 is rule-based)
- Multi-author review (v0 is Yetone-only)
- UI for proposals (v0 is CLI + markdown files)
- Capability emergence as success criterion

## Open questions

None. v0 scope is locked on Yetone's answers of 2026-08-21: route A + human-only trigger.