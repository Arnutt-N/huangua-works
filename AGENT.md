# Project Rules — huangua-works

## New Task / New Phase Workflow (MANDATORY)

Before starting ANY new task or phase, follow this sequence strictly:

### 0. Branch First
```bash
git checkout -b <type>/<short-description>
# e.g. feat/master-data-crud, fix/auth-redirect, refactor/admin-layout
```
Never work directly on `main`. Every task/phase gets its own branch.

### 1. Skill Selection
Reference `.claude/skill-collections-20260712.md` and select the appropriate skill set for the task:
- **Baseline (always):** karpathy-guidelines
- **Process discipline:** superpowers (for serious eng work)
- **Thinking/planning:** mattpocock (grilling, codebase-design, domain-modeling)
- **Full SDLC playbook:** addyosmani OR ecc (pick one, never both)
- **Frontend design:** taste-skill (landing/portfolio/redesign only)
- **Agent workflow tuning:** maestro (AI/agent projects only)

State which skills apply before proceeding.

### 2. PRD (Product Requirements Document)
Create a concise PRD covering:
- Problem statement / user need
- Scope (in/out)
- Acceptance criteria (verifiable)
- Constraints & dependencies
- Success metrics

### 3. PRP-Plan (Implementation Plan)
Break the PRD into an ordered implementation plan:
- File-level changes (create/modify/delete)
- Dependency order (what blocks what)
- Test strategy per unit
- Risk areas & mitigations
- Estimated tranche grouping (if parallelizable)

### 4. Review Gate (PRD + PRP-Plan)
Before writing any implementation code:
- Review PRD against original request (completeness, no scope creep)
- Review PRP-Plan against codebase reality (correct paths, existing patterns, no conflicts)
- Flag assumptions and get user confirmation if ambiguous

### 5. Implement
- Follow the PRP-Plan tranche order
- TDD where applicable (red → green → refactor)
- Surgical changes only — no drive-by refactors
- Run lint + typecheck + tests after each logical unit

### 6. Review & Ship
```bash
# Self-review
- Run the gates in "CI / Verification" below
- Review diff for unintended changes

# Commit (conventional commits)
git add <specific-files>
git commit -m "<type>(<scope>): <description>"

# Push + PR
git push -u origin <branch>
gh pr create --title "..." --body "..."

# Merge (after local gates green + approval)
gh pr merge --squash
```

### Summary Checklist
```
[ ] New branch created
[ ] Skills identified (ref: .claude/skill-collections-20260712.md)
[ ] PRD written & reviewed
[ ] PRP-Plan written & reviewed
[ ] Review gate passed (user confirmed if needed)
[ ] Implemented per plan
[ ] Tests pass, lint clean, typecheck clean
[ ] Committed with conventional message
[ ] PR created
[ ] Merged after local gates green + Vercel preview OK
```

## CI / Verification

GitHub Actions is **intentionally paused** to avoid billing — a PR with no Actions run
is expected, not a broken setup. Do not go hunting for CI runs.

Verification gates are local + Vercel:
```bash
npx tsc --noEmit     # pnpm is not in PATH — use npx
npx eslint .
npx vitest run       # integration tests need Docker Desktop started (Postgres :5433 + Redis)
```
Plus the Vercel / Vercel Preview Comments checks on the PR.
