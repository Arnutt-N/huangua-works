# Skill Collections — ภาคผนวก A–F (ตารางเปรียบเทียบละเอียด)

> ภาคผนวกของ `skill-collections-20261015.md` — catalog ใช้งานได้โดยไม่ต้องมีไฟล์นี้
> เนื้อหายกมาจาก §19 ของฉบับ 2026-08-15 ครอบ 7 core collections เดิม · ตัวเลข ⭐/pushed/license ย้ายไปไว้ที่ §3.0 ของ catalog ที่เดียว
> ชุดใหม่รอบ 10-15 (caveman · ponytail · pstack · orchestkit) และรอบ 10-16 (aidlc-workflows · CLI-Anything · ReMe) **ยังไม่ได้ทำ capability matrix ระดับนี้** — ดูตาราง §3.2 และโปรไฟล์ §4.12 / §6 ของ catalog แทน

> **เกณฑ์สัญลักษณ์:** `✓✓` แข็งแกร่ง/มีหลายตัว · `✓` มี · `△` บางส่วน/ทางอ้อม · `✗` ไม่มี

---

## ตาราง A — ข้อมูลพื้นฐาน (Identity)

| รายการ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|--------|----------|-------------|------------|------------|-----|---------|-------------|
| **เจ้าของ** | multica-ai (อิง A. Karpathy) | obra (Jesse Vincent) | Matt Pocock | Addy Osmani | affaan-m | sharpdeveye | Leonxlnx (sponsor: Vercel OSS) |
| **จำนวน skill** | 1 | ~14 | ~35 | 24 | หลายร้อย | 25 (1 core + 24 cmd) | 13 |
| **+ agents/commands** | ✗ | ✗ | ✗ | มี agents | ✓✓ | ✓✓ (24 cmd + 10 MCP tools + VS Code ext) | ✗ |
| **ขนาดต่อ skill** | ~2.5KB | กลาง | เล็ก-กลาง | กลาง | กลาง-ใหญ่ | กลาง (+ 7 reference หนัก) | 2.6KB–87KB |
| **โครงสร้าง** | ไฟล์เดียว | flat | 6 หมวด | flat 24 | namespace `ecc:*` + sub-plugins | 1 core + 7 refs + 24 cmd | flat 13 |
| **Multi-runtime** | ✓ | ✓✓ 14 install targets | ✓ (`skills.sh`) | ✓ (Gemini/opencode) | ✓✓ แต่ capability ต่างกันมาก (§12.1.1 ของ catalog) | ✓✓ 10 providers | ✓ (+ `gpt-taste`) |
| **ติดตั้ง** | copy / plugin / `npx skills add` | marketplace / `npx skills add` | `npx skills add` / copy | marketplace / `npx skills add` | marketplace / `npx skills add` | `npx skills add` / MCP / VS Code ext | `npx skills add` / plugin |
| **Namespace** | — | `superpowers:*` | — | `agent-skills` | `ecc:*` | `/diagnose` `/fortify` ... | — (ชื่อ frontmatter ≠ ชื่อโฟลเดอร์) |
| **Maturity** | อิงทวีต | ดู §3.0 | ต่อเนื่อง | ต่อเนื่อง | ดู §3.0 | v2.0.0, 37 tests · เงียบตั้งแต่ 2026-04-29 | v2 (เก็บ v1) |

## ตาราง B — ปรัชญาและตำแหน่ง (Positioning)

| มิติ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|------|----------|-------------|------------|------------|-----|---------|-------------|
| **แกน** | A | A | A | A | A (+แตะ B) | B | A (vertical) |
| **Altitude** | behavioral | กระบวนการ | engineering tools | full-SDLC | กว้างสุด | meta | domain vertical |
| **ปรัชญา** | ลด LLM mistakes | วินัย skill-first | small/composable | production-grade | ครอบคลุม + เฉพาะทาง | structure > improvisation | Design Read → 3 Dials |
| **ความเข้มงวด** | แนะนำ | rigid | flexible | flexible | varies | flexible + บังคับเก็บ context | pre-flight บังคับ |
| **ผู้ใช้เป้าหมาย** | ทุกคน | engineer จริงจัง | engineer คุมกระบวนการ | ทีม production | องค์กร/หลาย domain | คนสร้าง/จูน agent workflow | คนทำ landing/portfolio |
| **bias** | caution > speed | discipline > speed | control > automation | completeness | coverage | measurement > speed | intentional design > speed |
| **meta-router** | ✗ | `using-superpowers` ✓✓ | `ask-matt` ✓ | `using-agent-skills` ✓ | `ecc-guide` ✓ | `agent-workflow` ✓✓ | ✗ |

## ตาราง C — Capability Matrix แกน A (SDLC)

> maestro อยู่แกน B — ดูตาราง F · verticals สรุปไว้ในตาราง C-bis

### Phase 0 — Foundational / Behavioral
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| กฎพฤติกรรม (think/simple/surgical) | ✓✓ | ✗ | ✗ | ✗ | ✗ |
| Adversarial verification | ✗ | ✓ `verification-before-completion` | ✗ | ✓✓ `doubt-driven-development` | ✓ `council` `verification-loop` |
| Source-grounding | ✗ | ✗ | ✗ | ✓✓ `source-driven-development` | ✓ `documentation-lookup` `search-first` |

### Phase 1 — Discovery
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| Brainstorm | ✗ | ✓✓ `brainstorming` | △ | ✓ `idea-refine` | ✓ `council` |
| Requirements interview | ✗ | △ | ✓✓ `grilling` `grill-with-docs` | ✓✓ `interview-me` | △ |
| Spec / PRD | ✗ | ✓ `writing-plans` | ✓ `to-prd` | ✓✓ `spec-driven-development` | ✓✓ `plan-prd` `prp-prd` `spec-miner` |
| Planning | ✗ | ✓✓ `writing-plans` `executing-plans` | ✓ `to-issues` | ✓✓ `planning-and-task-breakdown` | ✓✓ `plan` `epic-decompose` |

### Phase 2 — Build
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| TDD | ✓ | ✓✓ `test-driven-development` | ✓✓ `tdd` | ✓✓ `test-driven-development` | ✓✓ `tdd-workflow` |
| Implementation | ✗ | ✓ `subagent-driven-development` | ✓ `implement` | ✓✓ `incremental-implementation` | ✓✓ `prp-implement` `multi-execute` |
| Prototype | ✗ | ✗ | ✓ `prototype` | ✗ | ✓ `ui-demo` |

### Phase 3 — Quality
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| Debugging | ✗ | ✓✓ `systematic-debugging` | ✓✓ `diagnosing-bugs` | ✓✓ `debugging-and-error-recovery` | ✓ `agent-introspection-debugging` `build-fix` |
| Code review | ✗ | ✓✓ `requesting/receiving-code-review` | ✓ `review` | ✓✓ `code-review-and-quality` | ✓✓ `code-review` `quality-gate` |
| Simplify / refactor | ✓ | ✗ | ✓ `improve-codebase-architecture` | ✓✓ `code-simplification` | ✓ `refactor-clean` |
| Security (โค้ดแอป) | ✗ | ✗ | ✗ | ✓✓ `security-and-hardening` | ✓✓ `security-review` `security-scan` |

### Phase 4 — Frontend / Performance / API
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| Frontend / UI | ✗ | ✗ | △ | ✓✓ `frontend-ui-engineering` | ✓✓ `frontend-patterns` `vue/react-patterns` |
| Performance | ✗ | ✗ | ✗ | ✓✓ `performance-optimization` | ✓✓ `latency-critical-systems` |
| API design | ✗ | ✗ | ✓ `codebase-design` | ✓✓ `api-and-interface-design` | ✓ `api-design` |

### Phase 5 — Ship
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| CI/CD | ✗ | ✗ | ✓ `setup-pre-commit` | ✓✓ `ci-cd-and-automation` | ✓✓ `deployment-patterns` `docker-patterns` |
| Shipping / launch | ✗ | ✓ `finishing-a-development-branch` | ✗ | ✓✓ `shipping-and-launch` | ✓ `promote` `canary-watch` |
| Observability | ✗ | ✗ | ✗ | ✓✓ `observability-and-instrumentation` | △ `production-audit` |
| Browser / E2E | ✗ | ✗ | ✗ | ✓✓ `browser-testing-with-devtools` | ✓✓ `browser-qa` `e2e-testing` |

### Cross-cutting
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|---|:-:|:-:|:-:|:-:|:-:|
| Git guardrails | ✗ | ✓ | ✓✓ `git-guardrails-claude-code` | ✓ `git-workflow-and-versioning` | ✓ `git-workflow` `github-ops` |
| Merge conflict | ✗ | △ | ✓✓ `resolving-merge-conflicts` | ✗ | △ |
| Worktrees | ✗ | ✓✓ `using-git-worktrees` | ✗ | ✗ | △ |
| Docs / ADR | ✗ | ✗ | ✓ `edit-article` | ✓✓ `documentation-and-adrs` | ✓✓ `update-docs` `code-tour` |
| Context / handoff | ✗ | △ | ✓✓ `handoff` | ✓✓ `context-engineering` | ✓✓ `save/resume-session` `strategic-compact` |
| Orchestration | ✗ | ✓ `dispatching-parallel-agents` | △ `loop-me` | ✗ | ✓✓ `multi-workflow` `team-agent-orchestration` |
| Domain packs | ✗ | ✗ | ✗ | ✗ | ✓✓ |
| Language patterns | ✗ | ✗ | △ (TS) | ✗ | ✓✓ |
| Deprecation / migration | ✗ | ✗ | ✓ `migrate-to-shoehorn` | ✓✓ `deprecation-and-migration` | ✓ `legacy-modernizer` |

### ตาราง C-bis — verticals ครอบแถวไหนของแกน A

| Vertical | แถวที่ครอบ | ระดับ |
|---|---|:-:|
| taste-skill | Phase 4 / Frontend (landing/portfolio/redesign) | ✓✓ |
| ui-skills · ux-ui-agent-skills | Phase 4 / Frontend (product UI) + a11y | ✓✓ |
| Infographic · diagram (archify / fireworks / diagram-design) | Phase 4 / visual output | ✓ |
| founder-skills | นอกแกน A | — |
| reverse-skill · rea | Phase 3 / Security (restricted) | ✓✓ (gated) |
| security-audit-skill | Phase 3 / Security (defensive) | ✓ |

## ตาราง D — จุดแข็ง / จุดอ่อน / เหมาะกับใคร

| | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|--|--|--|--|--|--|--|--|
| **จุดแข็ง** | leverage/token สูงสุด | วินัยแน่น, debugging + plans | คิด/วางแผน, grilling | ครบ SDLC แบบเบา | กว้างสุด, domain + ภาษา | agent-eng 7 มิติ + memory/audit/cost | design depth, style variants |
| **จุดอ่อน** | แคบ | ไม่มี domain/ภาษา | เอน TS | ทับ ecc | routing สับสน | ไม่แตะ SDLC; ต้อง `/teach-maestro` | ~87KB; เฉพาะ marketing pages |
| **เหมาะกับ** | ทุกโปรเจกต์ | งาน eng จริงจัง | engineer คุมกระบวนการ | ทีม production | โปรเจกต์ใหญ่/หลายภาษา | สร้าง/จูน agent | landing/portfolio |
| **ไม่เหมาะกับ** | — | งาน ad-hoc | ทีมที่อยาก automate | ถ้ามี ecc แล้ว | โปรเจกต์เล็ก | โปรเจกต์ที่ไม่ใช่ AI | dashboard/product UI |

## ตาราง E — ความทับซ้อนรายคู่

อยู่ที่ §15 ของ catalog

## ตาราง F — Capability Matrix แกน B (Agent-Workflow Engineering)

| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | ruflo | headroom |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Prompt engineering | ✗ | ✗ | ✗ | △ | ✓ `prompt-optimizer` | ✓✓ `/refine` | ✓ | ✗ |
| Context budget | ✗ | △ | ✓ `handoff` | ✓✓ `context-engineering` | ✓ `context-budget` | ✓✓ `/streamline` | ✓ | ✓✓ (runtime) |
| Tool orchestration | ✗ | △ | ✗ | △ | ✓ `mcp-server-patterns` | ✓✓ `/chain` `/calibrate` | ✓✓ | △ |
| Multi-agent topology | ✗ | ✓ | △ | ✗ | ✓✓ | ✓✓ `/compose` | ✓✓ | ✗ |
| Feedback / eval | ✗ | ✓ | ✗ | △ | ✓✓ `eval-harness` | ✓✓ `/iterate` | ✓ | ✗ |
| RAG / grounding | ✗ | ✗ | ✗ | ✗ | ✓ `iterative-retrieval` | ✓✓ `/enrich` | ✓ | ✓ |
| Guardrails / cost ceiling | ✗ | ✗ | ✗ | △ | ✓ `safety-guard` `gateguard` `cost-*` | ✓✓ `/guard` `/fortify` | ✓ | △ |
| Workflow slop linter | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ `/diagnose` | △ | ✗ |
| Persistent memory + decision log | ✗ | ✗ | △ | ✗ | △ | ✓✓ `.maestro/` | ✓ | ✗ |
| Audit trail + per-command cost | ✗ | ✗ | ✗ | ✗ | △ `cost-tracking` | ✓✓ `audit.jsonl` | ✓ | △ |
| Effectiveness scorecard | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ `/reflect` | ✗ | ✗ |
| Live MCP server | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ | ✓✓ | ✓✓ |

**วิธีอ่าน:** ตัวที่ใกล้ maestro ที่สุดในแกน B คือ ruflo (platform เต็มรูปแบบ จึงเป็น choose-one) และ ecc (agent-eng กระจัดกระจาย ไม่มี memory/audit/cost/scorecard) · headroom เด่นแถวเดียวแต่ทำได้จริงตอน runtime จึงใช้คู่กับ maestro · 4 แถวล่างคือ moat ของ maestro · แถวที่ `✗` ทั้งแถวในตาราง C คือ capability ที่ไม่มีชุดไหนครอบ
