# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you're about to work in

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

Neither exists yet. That is expected, not a gap to fill.

## File structure

This is a single-context repo — one Next.js app, `pnpm-workspace.yaml` declares no `packages:`. There is no `CONTEXT-MAP.md` and no per-context `src/<context>/docs/adr/`.

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── src/
```

## `docs/` is not domain truth

`docs/PRD.md`, `docs/PRP-Plan.md`, `docs/tracking-issues.md`, and `docs/context-package.md` describe a **Supabase + RLS + Supabase-Auth** architecture the code never adopted. See "Stack reality vs. the planning docs" in `AGENTS.md`.

Do not mine them for domain vocabulary and do not treat them as decisions of record. They are historical intent.

The nearest thing this repo has to a decisions-of-record document today is `AGENTS.md` itself, plus the `§`-prefixed comments in the source that explain why a piece of code has the shape it does.

## Language

Domain vocabulary is **Thai**: เคส, เรื่องร้องเรียน, ผู้แจ้ง, หน่วยงาน, มอบหมาย.

Status labels have two registers, both in `src/lib/cases/state-machine.ts`:

- `STATUS_LABELS_TH` — staff-facing (`/admin`)
- `STATUS_LABELS_TH_CITIZEN` — public-facing (LINE, `/track`)

Reach for the existing Thai term rather than coining an English one. When your output names a domain concept — an issue title, a refactor proposal, a hypothesis, a test name — use the term the code already uses.

If the concept you need has no term yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
