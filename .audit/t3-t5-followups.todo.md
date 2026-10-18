# T3, T5, follow-ups checklist

## Feature playbook
- [x] `how` over affected subsystems.
- [x] `architect` for parallel design exploration.
- [x] **Blocking first steps.** T3/T5 boundaries and migration ordering confirmed before code fan-out.
- [x] **Independent workstreams.** T3 owner implements. T5 and follow-ups stay read-only until T3 returns.
- [x] **Shared mutable state.** Schema and migration single-writer is T3 owner worktree. Main thread touches only `.audit` trail.
- [x] **Smallest safe decomposition.** One owner per code-coupled tranche.
- [x] Delegate code-writing with named data shape, organizing structure, file fences, and success criteria.
- [x] Verify on matching surface.
- [x] Sequence small units. Verify and commit each unit before next.
- [x] Run `Opening a PR` before each PR.

## Work units
- [x] T3 schema and migration.
- [x] T3 friend event recording.
- [x] T3 targeted broadcast delivery and failed-recipient tracking.
- [x] T3 admin API/UI and tests.
- [x] T3 lint, typecheck, unit, integration, review.
- [ ] T5 expand schema and identity helper.
- [ ] T5 expand verification and security review.
- [ ] T5 backfill script and tests.
- [ ] T5 backfill verification and security review.
- [ ] T5 contract only after explicit approval for irreversible plaintext drop.
- [ ] Follow-up debt assessment and reversible fixes.
- [ ] Deployment migration runbook only; external deploy waits for approval.
- [ ] Audit local files without mutating user files.

## Throughput checkpoint
- [ ] **Blocking first steps.** Confirm T3/T5 boundaries and migration ordering before code fan-out.
- [ ] **Independent workstreams.** T3 friend events and broadcast delivery can design in parallel; schema migration writes serialize.
- [ ] **Shared mutable state.** `src/lib/db/schema.ts` and migration journal are single-writer boundaries.
- [ ] **Smallest safe decomposition.** One owner per code-coupled tranche; reviewers stay read-only.

## Decisions
- T3 target shape remains `{ kind: 'all' } | { kind: 'user_ids', ids: string[] }`.
- Failed recipients store only deterministic hash, never raw LINE ID.
- T5 uses separate `LINE_ID_HMAC_KEY` and expand, backfill, contract ordering.
- Plaintext drop and production migration are irreversible gates and require explicit approval.
