# Cumora 自进化 — Tasks (v0)

**Iteration target:** `/Users/skyblue/Developer/AI/cumora`

**Spec:** `requirements.md` + `design.md` in this directory.

**Owner convention:**
- @bram owns all `agent-cli/` code (the runner)
- @atlas owns the proposal review (research + rule calibration)
- @iris is not needed in v0 (no UI)
- @kael is not needed in v0 (no infra)

---

## Phase 0 — Setup (1 day, @bram)

- [ ] **T0.1** Create `agent-cli/src/evolve/` directory and `docs/evolve/` directory in the fork.
- [ ] **T0.2** Add empty files for the new modules listed in `design.md` with stub exports.
- [ ] **T0.3** Register `cumora evolve` subcommand in `agent-cli/src/cli.ts` (or wherever commands are wired). It should accept `run | list | review` with the args in `design.md`.
- [ ] **T0.4** Verify: `cumora evolve` prints help and exits 0 even with no implementation.

**Done when:** `cumora evolve --help` shows the subcommands.

---

## Phase 1 — Observation layer (2 days, @bram)

- [ ] **T1.1** Implement `observe.ts` to read pool from `~/Developer/AI/cumora/server/src/db/pool.ts`.
- [ ] **T1.2** Write the five SQL queries in `design.md` (convene / participants / conversations). Use parameterized queries, no joins.
- [ ] **T1.3** Snapshot output to `runs/<timestamp>/observations.json`.
- [ ] **T1.4** Unit tests: each query returns expected shape against a seeded SQLite.

**Done when:** `cumora evolve run --lookback-hours 24` against a seeded DB produces a valid `observations.json`.

---

## Phase 2 — Proposer (3 days, @bram with @atlas calibration)

- [ ] **T2.1** Implement `propose.ts` with the 5 rules from `design.md` (R-CONVENE-NO-DECISION, R-AGENT-FLIPPY, R-CONVO-STALLED, R-AGENT-IDLE, R-MOST-ACTIVE).
- [ ] **T2.2** Each rule is a pure function: `(observations) => Proposal | null`.
- [ ] **T2.3** Proposal frontmatter schema locked. Required fields: `id`, `created_at`, `triggered_by`, `status`, `risk`, `area`, `target_files`.
- [ ] **T2.4** Implement `danger-zone.ts` and have the proposer refuse any proposal whose `target_files` matches.
- [ ] **T2.5** Per-rule fixture tests: each rule has 2 observations inputs (no trigger / trigger fires) and a fixture for the expected proposal.
- [ ] **T2.6** Round-trip test: end-to-end against seeded SQLite, asserts N proposals, all valid, none in danger zone.
- [ ] **T2.7** @atlas reviews the rule set and calibrates thresholds (e.g. what counts as "flippyp agent").

**Done when:** `cumora evolve run` against a seeded DB emits ≥ 1 proposal that passes the round-trip test.

---

## Phase 3 — Review surface (1 day, @bram)

- [ ] **T3.1** Implement `review.ts` with `approve | reject` flipping the frontmatter `status`.
- [ ] **T3.2** Reviewer comment appended as a markdown block under the proposal.
- [ ] **T3.3** `cumora evolve list [--status open]` shows a one-line-per-proposal summary.
- [ ] **T3.4** Unit tests: approve flips status, reject flips status, both append comments.

**Done when:** a proposal can be approved or rejected from the CLI and the file reflects it on disk.

---

## Phase 4 — Run loop on real fork (1 day, @atlas)

- [ ] **T4.1** @atlas runs `cumora evolve run --lookback-hours 168` against the fork's real DB.
- [ ] **T4.2** Review all produced proposals. Classify each as: ready-to-approve / needs-revision / false-positive.
- [ ] **T4.3** If < 1 ready-to-approve proposal exists, calibrate rules in Phase 2 and re-run.
- [ ] **T4.4** Approve at least 1 proposal manually. Apply its diff manually to the fork in a new branch. Commit.

**Done when:** at least 1 proposal has been approved AND manually applied AND merged.

---

## Phase 5 — v0 exit gate check (1 day, @nova)

- [ ] **T5.1** Confirm all 5 success criteria from `requirements.md` § "Success criteria" are met within 2 weeks of T0.1.
- [ ] **T5.2** If any criterion fails, write a one-page postmortem to `docs/evolve/postmortem-v0.md` and decide: fix v0 or stop the project.
- [ ] **T5.3** If all criteria pass, hand off to v1 spec.

**Done when:** v0 ships or stops.

---

## Dependency graph

T0.1 ── T0.2 ── T0.3 ── T0.4
                │
                ▼
T1.1 ── T1.2 ── T1.3 ── T1.4
                        │
        ┌───────────────┘
        ▼
T2.1 ── T2.2 ── T2.3 ── T2.4 ── T2.5 ── T2.6 ── T2.7
                                                  │
                                                  ▼
                                            T3.1 ── T3.2 ── T3.3 ── T3.4
                                                                  │
                                                                  ▼
                                                              T4.1 ── T4.2 ── T4.3 ── T4.4
                                                                                       │
                                                                                       ▼
                                                                                   T5.1 ── T5.2/T5.3
```

---

## Parallelizable work

- T0.* is sequential.
- T1.* and T2.1–T2.3 can be parallelized (different files, different test surfaces).
- T2.7 (atlas calibration) is the only place where human review gates the next phase.
- T3.* is parallelizable with T2.5–T2.6.
- T4.* must be sequential — it depends on real data from earlier phases.

## Estimated calendar

If @bram has ~50% of their week, ~10 working days from T0.1 to T4.4 done. v0 exit gate check the next day.

---

## Out of scope for v0 tasks (do NOT add here)

- Auto-apply path
- LLM proposers
- Cron / event / self-reflection triggers
- Multi-author review
- Web UI

These belong in a v1 tasks doc — open it only after v0 exits green.