# Agent Skill Collections และเครื่องมือเสริม — ฉบับคัดเลือกใช้งาน

> เอกสารอ้างอิงข้ามโปรเจกต์และข้ามแพลตฟอร์ม
> แพลตฟอร์มเป้าหมาย: Claude Code · Codex (App/CLI) · Cursor · Antigravity · Gemini CLI · GitHub Copilot CLI · **Grok Build CLI** · **Factory Droid** · Devin CLI · Kimi Code · OpenCode · Pi · Hermes · Zed · Qwen · Cline · Kilo · **Qoder** · **Mistral Vibe** · **DeepSeek Harness** · **MiMo CLI** และ MCP clients — ดูระดับการรองรับจริงใน §12
> อัปเดต: 15 สิงหาคม 2026 (รอบ verify — ตรวจ repo จริงและแก้ตาม review · ดู §22 Change Log ท้ายเอกสาร)
>
> 📄 **เอกสารนี้ standalone — คัดลอกไปใช้โปรเจกต์ไหนก็ได้** ไม่ต้องพาไฟล์อื่นไปด้วย ทุกลิงก์ในเอกสารชี้ไป URL ภายนอกทั้งหมด
> เอกสารประกอบในชุดเดียวกัน (มีเฉพาะในโฟลเดอร์ต้นทาง `ai-settings/` — **ไม่จำเป็นต่อการใช้งานไฟล์นี้**):
> `skill-collections-20260712.md` (ฐานข้อมูลเดิม) · `skill-collections-comparison.md` (รุ่นแรก 2026-07-09) · `skill-collections-repo-analysis-20260815.md` (รายงานตรวจ 34 repos) · `skill-collections-claude-code-review-20260815.md` (review)

> ⚠️ **ก่อนใช้งาน:** ตัวเลขในเอกสารนี้ (จำนวน skill · ดาว · ฟีเจอร์) มาจากการตรวจครั้งล่าสุดของแต่ละรอบ — ระบบเหล่านี้อัปเดตบ่อย **ให้เช็ค repo ต้นทาง (§20) ก่อนตัดสินใจติดตั้งจริงเสมอ** · รายละเอียดว่าอะไร verify แล้ว/ยังไม่ verify ดู §3.0

---

## 1. TL;DR

Skill ecosystem ควรถูกจัดเป็นหลายชั้น ไม่ควรนำทุก repository ไปติดตั้งเป็น skill collection พร้อมกัน

```text
Layer 0 — Behavioral baseline
  karpathy-guidelines

Layer 1 — Process discipline
  superpowers

Layer 2 — เลือก SDLC collection หลักเพียงหนึ่งชุด
  mattpocock OR addyosmani OR ecc

Layer 3 — Agent-workflow engineering เฉพาะเมื่อจำเป็น
  maestro OR ruflo

Domain verticals — เปิดตามชนิดงาน
  founder-skills       business / GTM / pricing / SOP
  ui-skills            product UI / accessibility / motion audit
  taste-skill          landing / portfolio / premium redesign
  Infographic          data storytelling / structured infographic
  reverse-skill        authorized defensive security only

Product-specific packs — ใช้เฉพาะ runtime ที่รองรับ
  Codex Security skills
  Trigger.dev skills

Skill infrastructure — จัดการ collection ไม่ใช่ content collection
  autoskills
  SkillHub

Hybrid integrations — มี skill adapter/bundle แต่ไม่ใช่ baseline collection
  Graphify, Graft, Understand-Anything          (choose one)

Pure tool/MCP companions — เพิ่ม capability แต่ไม่มี router-facing skill
  headroom, world-intel-mcp, claude-context, TencentDB-Agent-Memory,
  MarkPDFdown, Morphik, Scrapy, Witr, Promptflow, TEN,
  paperless-gpt, Unstract
```

### 1.1 กรอบความคิด — "2 แกน + verticals"

Layer model ด้านบนบอก *ลำดับการติดตั้ง* ส่วนกรอบนี้บอก *ทำไมบางชุดถึงทับซ้อนกันน้อย* — ชุดที่อยู่คนละแกนโดยทั่วไปใช้ร่วมกันได้ เพราะเนื้อหาทับซ้อนต่ำ **แต่ยังต้องตรวจ routing/trigger, context budget, hooks และ project instructions ก่อนเปิดพร้อมกัน** — "คนละแกน" รับประกันแค่ว่าเนื้อหาไม่ซ้ำ ไม่ได้รับประกันว่า router จะไม่สับสนหรือ context จะพอ

**แกน A — สร้างซอฟต์แวร์ (SDLC):** จัดชั้นตาม altitude จากพฤติกรรมพื้นฐาน → กระบวนการ → playbook ครบวงจร

```text
ระดับสูง  ┌─────────────────────────────────────────────┐
(กว้าง)   │  ecc          — ทุกอย่าง + domain packs        │  หลายร้อย skill
          ├─────────────────────────────────────────────┤
          │  addyosmani   — full-SDLC playbook (spec→ship) │  24 skills
          │  mattpocock   — เครื่องมือคิด/engineering       │  ~35 skills
          ├─────────────────────────────────────────────┤
          │  superpowers  — วินัยกระบวนการ (how to work)    │  ~14 skills
          ├─────────────────────────────────────────────┤
ระดับล่าง  │  karpathy     — กฎพฤติกรรมพื้นฐาน (always-on)   │  1 skill
(แคบ/ลึก)  └─────────────────────────────────────────────┘
```

**แกน B — วิศวกรรมเวิร์กโฟลว์ของ AI agent เอง (meta-layer):** ทำงาน *บนตัว agent* ไม่ใช่บนโค้ดแอป

```text
          ┌─────────────────────────────────────────────┐
          │  maestro  — audit→fix เวิร์กโฟลว์ AI agent    │  1 core + 24 cmd
          │  (prompt · context · tool · architecture ·    │  + MCP + ext
          │   feedback · RAG · guardrails) + memory/audit │  (10 providers)
          ├─────────────────────────────────────────────┤
          │  ruflo    — orchestration/swarm platform      │  ทางเลือกแทน
          └─────────────────────────────────────────────┘
   ↑ ecc แตะแกนนี้บางส่วน (skill กระจัดกระจาย) แต่ maestro เป็น toolkit เฉพาะทางที่รวมศูนย์
   ↑ headroom เป็น "เครื่องจักร" บีบอัด context ตอน runtime — เสริมแกน B ไม่ใช่ skill
```

**Verticals — เจาะ domain เดียว เสียบข้าง stack ไหนก็ได้:** `taste-skill` (marketing design) · `ui-skills` (product UI/a11y) · `founder-skills` (business) · `Infographic` (data storytelling) · `reverse-skill` (security, restricted)

### 1.2 Stack แนะนำทั่วไป

```text
karpathy + superpowers + เลือก SDLC 1 ชุด
                         + vertical เฉพาะงานไม่เกิน 1-2 ชุด
                         + maestro เมื่อเป็น AI/agent workflow
```

### 1.3 กฎสำคัญ

- อย่า stack `addyosmani + ecc` เพราะ full-SDLC ทับซ้อนสูง (ของซ้ำ ~20 ตัว → routing noise)
- อย่าเปิด `maestro + ruflo + ECC orchestration` พร้อมกันเป็น baseline
- เลือก `taste-skill` หรือ `Hallmark` เป็น design-direction หลักเพียงตัวเดียว
- เลือก `Graphify`, `Graft` หรือ `Understand-Anything` เพียงตัวเดียวต่อโปรเจกต์
- `reverse-skill` ต้องใช้ allowlist, authorization gate และ sandbox
- MCP/framework/template ไม่ใช่ skill collection แม้ใช้ร่วมกับ agent ได้
- ถ้ามี design-quality rules / frontend-design skill อยู่แล้ว เลือกฝั่งเดียวเป็นหลัก อย่าเปิดคู่

**หลักการรวม:** เลือกชุดที่อยู่ **คนละ layer/แกน** ดีกว่าหลายชุดใน layer เดียวกัน — skill ที่ description ซ้ำกันทำให้ router เลือกยากและสิ้นเปลือง context

---

## 2. เกณฑ์ว่าอะไรนับเป็น Skill Collection

Repository จะถูกนับเป็น skill collection เมื่อ:

1. มีหนึ่งหรือหลาย `SKILL.md`
2. มี frontmatter อย่างน้อย `name` และ `description`
3. ติดตั้งแล้ว router สามารถเลือกโหลดเพื่อเปลี่ยนพฤติกรรม agent ได้
4. มีขอบเขตและ trigger ที่ชัดเจน
5. ไม่ใช่เพียง README, prompt reference, application, framework หรือ MCP server

### ประเภทที่ใช้ในเอกสารนี้

| ประเภท | ความหมาย | การจัดการ |
|---|---|---|
| Core collection | ชุดทั่วไปที่ใช้เป็นฐาน | เลือกอย่างระมัดระวังและ pin version |
| Domain vertical | ชุดเฉพาะชนิดงาน | เปิดเฉพาะเมื่อ task ตรง domain |
| Single skill | skill เดี่ยว | ใช้ได้ แต่ไม่เรียก collection |
| Hybrid pack | skill + plugin/MCP/framework | ใช้ผ่าน runtime ของผู้ผลิตหรือ pilot แยก |
| Infrastructure | registry/installer/governance | ใช้บริหาร collections ไม่ใช่ content |
| Tool companion | CLI/MCP/service/application | ทำ wrapper skill เมื่อมี use case |
| Reference | ตัวอย่างหรือความรู้ | ไม่ติดตั้งเข้า router โดยตรง |

---

## 3. ตารางเปรียบเทียบหลัก

### 3.0 สถานะการ verify ของข้อมูล

**✅ verify แล้วจาก GitHub API เมื่อ 2026-08-15:**

| Repository | ⭐ | License | pushed ล่าสุด | เลขเดิมในเอกสาร |
|---|---:|---|---|---|
| obra/superpowers | **272,293** | MIT | 2026-08-13 | 250,110 *(07-09)* |
| affaan-m/ECC | **240,201** | MIT | 2026-08-15 | 227,507 *(07-09)* |
| Leonxlnx/taste-skill | **76,663** | MIT | 2026-07-23 | ~62k *(07-12)* |
| ruvnet/ruflo | **67,888** | MIT | 2026-08-15 | — |
| zhaoxuya520/reverse-skill | **25,332** | MIT | 2026-08-15 | — |
| Nutlope/hallmark | **24,984** | MIT | 2026-08-06 | — |
| ibelick/ui-skills | **7,227** | MIT | 2026-08-13 | — |
| antvis/Infographic | **6,293** | MIT | 2026-06-01 | — |
| sharpdeveye/maestro | **412** | MIT | **2026-04-29** | — |
| ognjengt/founder-skills | **278** | MIT | 2026-05-18 | — |

> ⚠️ **ข้อสังเกตที่กระทบการเลือก stack:** `maestro` ซึ่งเอกสารนี้วางเป็นแกน B หลัก มี ⭐412 และไม่มี commit ใหม่ตั้งแต่ **2026-04-29 (~3.5 เดือน)** ขณะที่ `ruflo` ซึ่งจัดเป็นทางเลือกมี ⭐67,888 และ push วันเดียวกับที่ตรวจ · ดาวไม่ใช่ตัวชี้วัดคุณภาพ และ moat ของ maestro (memory/audit/cost/scorecard — ตาราง F) ยังไม่มีใครแทน แต่ **maintenance cadence ควรเข้าไปอยู่ในการตัดสิน choose-one ของแกน B** ไม่ใช่ดูเนื้อหาอย่างเดียว · เช่นเดียวกับ `founder-skills` (⭐278, pushed 2026-05-18) ที่ยังเป็น ADD ได้แต่ควรรู้ว่า community เล็ก

**⏳ ยังไม่ verify:**

| ข้อมูล | ตรวจล่าสุด | สถานะ |
|---|---|---|
| จำนวน skill ของ 7 core collections | 2026-07-12 | ยังไม่นับซ้ำ — ใช้เป็นตัวเลขโดยประมาณ |
| License ของ companions ที่เหลือ | — | 18 รายการยังเป็น `ต้องตรวจ` ในรายงาน repo-analysis §3 |
| Commit hash ของ 4 ADD candidates | — | ยังไม่ pin |

### 3.1 ตารางเปรียบเทียบ 7 core collections

| มิติ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|------|----------|-------------|------------|------------|-----|---------|-------------|
| **แกน** | A (สร้างซอฟต์แวร์) | A | A | A | A (+แตะ B) | **B (agent-workflow eng)** | **A (vertical: frontend design)** |
| **จำนวน** | 1 skill | ~14 | ~35 | 24 | หลายร้อย (skills+agents+commands) | 25 (1 core + 24 cmd) + MCP(10 tools) + VS Code ext | 13 skills (1 หลัก + 12 เสริม) |
| **ตัวตน** | กฎลด LLM mistakes | วินัยกระบวนการ | เครื่องมือคิดวิศวกรรม | playbook ครบ SDLC | เฟรมเวิร์ก/marketplace ครบจักรวาล | toolkit วิศวกรรม "เวิร์กโฟลว์ของ AI agent เอง" | anti-slop design taste สำหรับ landing/portfolio/redesign |
| **ปรัชญา** | think→simple→surgical→verify | skill-first, ทำตามเป๊ะ (rigid) | small/composable, anti-vibe-coding | production-grade, full lifecycle | ครอบคลุมสูงสุด + เฉพาะทาง | structure>improvisation · constraints=features · measure don't assume · graceful degradation | read the brief → "Design Read" → 3 Dials · anti-default discipline |
| **โครงสร้าง** | ไฟล์เดียว | flat | จัดกลุ่ม (eng/prod/misc/personal) | flat 24 | namespace `ecc:*` + sub-plugins | 1 core + 7 refs + 24 command-skills | flat 13 (หลัก + style variants + imagegen) |
| **จุดเด่นเฉพาะตัว** | surgical changes, goal-driven | systematic-debugging, executing-plans, worktrees | grilling, codebase-design, PRD→issues→triage | doubt-driven, source-driven | domain packs (healthcare/network/finance/crypto), ภาษา (py/go/rust/php/vue), orchestration | diagnose→fix loop, persistent memory/audit/cost, `/reflect` scorecard, delivery เป็น MCP/ext | 3 Dials + preset ต่อ use-case, style variant แยกไฟล์, imagegen→image-to-code |
| **จุดอ่อน** | แคบ (พฤติกรรมล้วน) | ไม่มี domain/ภาษา | เอนเอียง TS ecosystem | ทับ ecc เกือบหมด | ใหญ่จนเลือก skill ยาก, อาจ noise | ไม่แตะ SDLC/โค้ดแอป/ภาษา/domain; ต้อง `/teach-maestro` ก่อน | ตัวหลัก ~87KB (context แพงสุด); เฉพาะ marketing pages |
| **เหมาะเมื่อ** | ทุกโปรเจกต์ (baseline) | งาน eng จริงจัง ต้องการวินัย | อยากคุมกระบวนการคิด/วางแผน | อยากได้ playbook สำเร็จรูป | โปรเจกต์ใหญ่/หลายภาษา/domain เฉพาะ | สร้าง LLM/agent product **หรือ** จูนเวิร์กโฟลว์ coding agent | landing/portfolio/redesign ที่ design เป็นหัวใจ |
| **ทับซ้อน** | ~0 (orthogonal) | เสริม mattpocock | เสริม superpowers | ≈ ecc (สูง) | ครอบแกน A + แตะ B | ต่ำกับแกน A; กลางกับ ecc | กลางกับ addyosmani/ecc (เฉพาะ frontend); สูงกับ Hallmark/ui-skills |

### 3.2 ตารางเปรียบเทียบ 4 verticals ใหม่ (รอบ 2026-08-15)

| มิติ | founder-skills | ui-skills | Infographic | reverse-skill |
|---|---|---|---|---|
| **Domain** | Business / GTM / pricing / SOP | Product UI / a11y / motion perf | Data storytelling / infographic | Authorized security |
| **รูปแบบ** | skill collection (`skills/*/SKILL.md`) | collection + router/CLI | rendering library + skill pack | security router pack + scripts |
| **จำนวน** | ~9 กลุ่มงาน | ~7 skills | ~5 skills | หลายสิบโมดูล |
| **สถานะรับเข้า** | ADD · selective (3-6 skills) | ADD · opt-in | ADD · selective | ADD · **restricted** (allowlist เท่านั้น) |
| **ชนกับ** | ECC business, taste-skill (CRO/copy) | **taste-skill (สูง)**, ECC/Addy frontend | taste-skill (visual direction, กลาง) | ECC security, Addy hardening |
| **ติดตั้ง** | `npx skills add` | `npx ui-skills` | `npx skills add` | **ห้ามติดตั้งทั้ง repo อัตโนมัติ** |
| **ความเสี่ยงหลัก** | claims/marketing ต้อง verify, `FOUNDER_CONTEXT.md` อ่อนไหว | rules `MUST`/`NEVER` ชน design system | context สูง + ผูก DSL/renderer version | dual-use, tool auto-bootstrap, supply chain |

---

## 4. Core Collections เดิม

### 4.1 karpathy — `multica-ai/andrej-karpathy-skills`

- ประเภท: behavioral baseline · 1 skill (`karpathy-guidelines`) ~2.5KB
- **4 หลักการ:**
  1. **Think Before Coding** — บอก assumption, ถามเมื่อไม่ชัด
  2. **Simplicity First** — โค้ดน้อยสุดที่แก้ปัญหา ไม่เก็งอนาคต
  3. **Surgical Changes** — แตะเฉพาะที่จำเป็น ไม่ "ปรับปรุง" โค้ดข้างเคียง
  4. **Goal-Driven** — นิยาม success criteria ที่ verify ได้ แล้ว loop
- เหมาะกับ: ทุกโปรเจกต์ — **leverage ต่อ token สูงสุดในกลุ่ม**
- ความทับซ้อน: ต่ำมาก (orthogonal กับทุกชุด)
- คำแนะนำ: ติดตั้งเป็น baseline แต่ให้ user/project instructions มีลำดับสูงกว่าเสมอ
- Repository: <https://github.com/multica-ai/andrej-karpathy-skills> (อิงทวีตของ Andrej Karpathy)

### 4.2 superpowers — `obra/superpowers`

- ประเภท: process discipline · ~14 skills · เจ้าของ: **obra (Jesse Vincent)** · **MIT**
- **skill เด่น:** `brainstorming` · `systematic-debugging` · `test-driven-development` · `writing-plans` · `executing-plans` · `subagent-driven-development` · `using-git-worktrees` · `requesting/receiving-code-review` · `verification-before-completion` · `using-superpowers` (meta-router)
- เหมาะกับ: งานวิศวกรรมที่ต้องการขั้นตอนและ verification ชัดเจน; rigid — ทำตามเป๊ะ
- ความทับซ้อน: ปานกลางกับ Addy/ECC แต่เสริม Matt Pocock ได้ดี
- คำแนะนำ: ใช้เป็น process layer; deferred to user instructions เสมอ
- **ติดตั้ง:** marketplace `obra/superpowers-marketplace` → `plugin install superpowers` (Claude Code) หรือ `npx skills add` (แพลตฟอร์มอื่น — ได้เนื้อ skill แต่ไม่ได้ hooks/meta-router)
- Repository: <https://github.com/obra/superpowers> *(⭐ ที่บันทึกไว้ 2026-07-09: 250,110 — ยังไม่ verify ดู §3.0)*

### 4.3 mattpocock — `mattpocock/skills`

- ประเภท: engineering thinking tools · ~35 skills "Skills for Real Engineers" · small + composable, anti-vibe-coding
- **catalog 6 หมวด:**
  - **engineering:** `tdd` `implement` `diagnosing-bugs` `codebase-design` `domain-modeling` `improve-codebase-architecture` `prototype` `to-prd` `to-issues` `triage` `grill-with-docs` `resolving-merge-conflicts` `ask-matt`(router) `setup-matt-pocock-skills`
  - **productivity:** `grilling`/`grill-me` `handoff` `teach` `writing-great-skills`
  - **misc:** `git-guardrails-claude-code` `setup-pre-commit` `migrate-to-shoehorn` `scaffold-exercises`
  - **personal:** `edit-article` `obsidian-vault`
  - **in-progress:** `review` `decision-mapping` `loop-me` `writing-beats/fragments/shape`
  - **deprecated:** `design-an-interface` `qa` `request-refactor-plan` `ubiquitous-language`
- เหมาะกับ: engineer ที่ต้องการควบคุม reasoning/process โดยเฉพาะ TS/JS ecosystem; flow PRD→issues→implement→review
- ความทับซ้อน: ต่ำกับ Superpowers; ปานกลางกับ ECC
- Repository: <https://github.com/mattpocock/skills>

### 4.4 addyosmani — `addyosmani/agent-skills`

- ประเภท: lightweight full-SDLC playbook · 24 flat skills "Production-grade engineering skills"
- **catalog:**
  - **กระบวนการ:** `spec-driven-development` `planning-and-task-breakdown` `incremental-implementation` `test-driven-development` `source-driven-development` `doubt-driven-development`
  - **คุณภาพ:** `code-review-and-quality` `code-simplification` `debugging-and-error-recovery` `security-and-hardening`
  - **Frontend/Perf:** `frontend-ui-engineering` `performance-optimization` `browser-testing-with-devtools`
  - **Ops:** `ci-cd-and-automation` `shipping-and-launch` `observability-and-instrumentation` `deprecation-and-migration`
  - **ออกแบบ/เอกสาร:** `api-and-interface-design` `documentation-and-adrs`
  - **บริบท:** `context-engineering` `interview-me` `idea-refine` `using-agent-skills`(meta)
- **เด่นเฉพาะตัว:** `doubt-driven-development` (adversarial review ทุกการตัดสินใจ) · `source-driven-development` (อ้าง docs ทางการเสมอ)
- ความทับซ้อน: **สูงมากกับ ECC** — เลือกตัวเดียว
- Repository: <https://github.com/addyosmani/agent-skills>

### 4.5 ECC — `affaan-m/ECC`

- ประเภท: large SDLC/domain framework · หลายร้อย skills + agents + commands ใน namespace `ecc:*` · เจ้าของ: **affaan-m** · **MIT**
- **ครอบคลุม:** full SDLC + **domain packs** (healthcare, network, finance, crypto/DeFi, logistics, trade) + **ภาษา/เฟรมเวิร์ก** (python, go, rust, kotlin, swift, php, java, react, vue, django, laravel, springboot...) + **orchestration** (multi-agent, loops, epics)
- **เด่น:** ของเฉพาะทางที่ไม่มีในชุดอื่น เช่น `ecc:healthcare-phi-compliance`, `ecc:network-bgp-diagnostics`, `ecc:security-bounty-hunter`
- **แตะแกน B:** มี agent-eng skill กระจัดกระจาย — `ecc:agentic-engineering` `ecc:context-budget` `ecc:mcp-server-patterns` `ecc:eval-harness` `ecc:prompt-optimizer` `ecc:agent-harness-construction` `ecc:cost-aware-llm-pipeline` `ecc:agent-introspection-debugging` — แต่**ไม่รวมศูนย์**เป็น toolkit เดียวแบบ maestro และไม่มี memory/audit/cost layer
- คำแนะนำ: อย่าติดตั้งทุก skill; ใช้เฉพาะ namespace/domain ที่ต้องการ
- Repository: <https://github.com/affaan-m/ECC> *(⭐ ที่บันทึกไว้ 2026-07-09: 227,507 — ยังไม่ verify ดู §3.0)*

### 4.6 maestro — `sharpdeveye/maestro`

- ประเภท: agent-workflow engineering toolkit · v2.0.0 · MIT · 37 unit tests · npm + VS Code Marketplace
- **แกนกลาง = 1 core skill `agent-workflow`** (auto-load ทุกครั้งที่เรียก command, `user-invocable: false`) — คลังความรู้ DO/DON'T ครอบ 7 มิติ พร้อม **7 domain reference files:**
  1. `prompt-engineering` — โครงสร้าง prompt, few-shot, CoT, output schema
  2. `context-management` — จัดสรร context window, memory, state
  3. `tool-orchestration` — ออกแบบ/chain tool, error handling, sandboxing
  4. `agent-architecture` — topology, handoff, multi-agent patterns
  5. `feedback-loops` — evaluation, self-correction, regression
  6. `knowledge-systems` — RAG, chunking, embeddings, source attribution
  7. `guardrails-safety` — validation, prompt injection, cost ceilings
- **24 command-skills** (เรียกเป็น `/command`) 4 กลุ่ม:
  - **Analysis (อ่านอย่างเดียว):** `/diagnose` (audit 5 มิติ ให้คะแนน 1-5 + map ไป command แก้) · `/evaluate` · `/reflect` (effectiveness scorecard จาก audit log)
  - **Fix & Improve:** `/refine` `/streamline` `/calibrate` `/fortify` (error handling/retry/circuit breaker) `/zero-defect`
  - **Enhancement:** `/amplify` `/compose` (multi-agent) `/enrich` (RAG) `/accelerate` (speed/cost) `/chain` `/guard` (safety/cost ceiling) `/iterate` (feedback loop) `/temper` `/turbocharge`
  - **Utility:** `/extract-pattern` `/adapt-workflow` `/onboard-agent` `/specialize` (domain: legal/medical) `/teach-maestro` (เก็บ context → `.maestro.md`) `/capture` `/recap`
- **moat — ไม่มีในชุดอื่น:**
  - **Persistent memory layer** `.maestro/` → `context.md` + `decisions.jsonl` (append-only decision log) + `audit.jsonl` (ทุก command + duration + cost) + `sessions/` — อยู่ข้ามเซสชัน
  - **Cost estimation** ต่อ command (Claude/GPT-4/Gemini/o3, ±20%) + `/reflect` สรุปว่า command ไหนเวิร์ก/ล้มเหลว
  - **"Workflow Slop Test"** — checklist symptom→command (เช่น "prompt เป็นกำแพงข้อความ → `/refine`", ">10 tools → `/streamline`") ทำตัวเหมือน *linter ของเวิร์กโฟลว์*
  - **Delivery 3 แบบ:** static skills (`npx skills add`) · live MCP server (`maestro-workflow-mcp`: 10 tools/25 prompts/8 resources) · VS Code extension (sidebar + token budget + wave engine)
  - **10 providers** (Cursor, Claude Code, Gemini, Codex, Copilot/Antigravity, Kiro, Trae, Trae-CN, OpenCode, Pi) — กว้างสุดในกลุ่ม
  - ทุก command แนะนำ next step เสมอ (ไม่มีทางตัน) + combo ได้ เช่น `/diagnose /calibrate /refine`
- **ปรัชญา 5 ข้อ:** structure over improvisation · constraints are features · measure don't assume · appropriate complexity · graceful degradation
- **จุดอ่อน:** ไม่แตะ SDLC/โค้ดแอป/ภาษา/domain แอปเลย · ผลลัพธ์ดีต้องรัน `/teach-maestro` ตั้ง context ก่อน
- Repository: <https://github.com/sharpdeveye/maestro>

### 4.7 taste-skill — `Leonxlnx/taste-skill`

- ประเภท: frontend design vertical · 13 skills · MIT · sponsor: Vercel OSS Program + Emil Kowalski (animations.dev) · เว็บ: tasteskill.dev
- **ขอบเขตที่ประกาศเอง:** "Landing pages, portfolios, and redesigns. **Not** dashboards, not data tables, not multi-step product UI"
- **โครงสร้าง** (⚠️ **ชื่อ skill จริงจาก frontmatter ≠ ชื่อโฟลเดอร์ใน repo** — สำคัญตอนติดตั้งรายตัว):
  - **ตัวหลัก:** `design-taste-frontend` (โฟลเดอร์ `taste-skill`, ~87KB) — Brief Inference (บังคับประกาศ "Design Read" 1 บรรทัดก่อนเขียนโค้ด) → **3 Dials** (`DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`) พร้อมตาราง signal→dial + preset ต่อ use-case + pre-flight checklist + Anti-Default Discipline (แบน AI-purple gradient, hero กลางจอบน dark mesh, 3 การ์ดเท่ากัน, Inter+slate-900 ฯลฯ)
  - `design-taste-frontend-v1` (~21KB) — รุ่นเก่า **อย่าติดตั้งคู่กับตัวหลัก**
  - **Style variants (8–16KB เลือกโหลดเฉพาะทาง):** `industrial-brutalist-ui` · `minimalist-ui` · `high-end-visual-design` · `stitch-design-taste` · `redesign-existing-projects` (audit-first) · `brandkit`
  - **Image pipeline (36–40KB/ตัว):** `imagegen-frontend-web` · `imagegen-frontend-mobile` · `image-to-code`
  - **อื่น:** `full-output-enforcement` (กัน truncation/placeholder, 2.6KB) · `gpt-taste`
  - **โบนัส:** `research/laziness/` — งานวิจัยสาเหตุ+วิธีแก้อาการ LLM ตัดมุม
- **ผ่านการ vet (2026-07-12):** เนื้อหาเป็น design guidance ล้วน ไม่มี shell command / network call / credential handling; `skill.sh` เป็นแค่ registry lookup; repo ดูแลต่อเนื่อง มี CHANGELOG
- คำแนะนำ: โหลดเฉพาะตัวหลักหรือ style variant ที่ใช้จริง — **อย่าเปิดทั้ง 13 ตัวพร้อมกัน** (routing noise + description ชนกับ frontend skill ชุดอื่น)
- Repository: <https://github.com/Leonxlnx/taste-skill> *(⭐ ที่บันทึกไว้ 2026-07-12: ~62k — ยังไม่ verify)*

---

## 5. Collections และ Verticals ที่เพิ่มในฉบับนี้

### 5.1 founder-skills — Business/Founder Vertical

- Repository: <https://github.com/ognjengt/founder-skills>
- สถานะ: **ADD · selective**
- รูปแบบ: collection จริง มี `skills/*/SKILL.md` และ references
- ขอบเขตหลัก: strategic planning · go-to-market planning · pricing strategy · competitor intelligence · CRO optimization · outreach · PRD generation · SOP creation · brand/content writing
- เหมาะกับ: founder, product, marketing และ business operations
- ความทับซ้อน: ECC business/product บางส่วน; taste-skill เฉพาะ CRO/copy
- ติดตั้งแนะนำ: เลือก 3-6 skills ตามงาน ไม่ติดตั้ง content-writing ทั้งหมดเป็น global
- Governance: ตรวจ claims/ข้อมูลตลาดจากแหล่งปัจจุบัน · แยก fact ออกจาก marketing framework · ปกป้องข้อมูลใน `FOUNDER_CONTEXT.md`

### 5.2 ui-skills — UI Engineering/Audit Vertical

- Repository: <https://github.com/ibelick/ui-skills>
- สถานะ: **ADD · opt-in**
- รูปแบบ: collection จริง พร้อม router/CLI
- ขอบเขตหลัก: baseline UI · accessibility fixes · metadata fixes · motion performance · UI improvement · design documentation
- เหมาะกับ: product UI, accessibility audit และ frontend-quality pass
- ความทับซ้อน: สูงกับ taste-skill; ทับบางส่วนกับ ECC/Addy frontend
- **Routing:** `ui-skills` = product UI/usability/a11y/performance · `taste-skill` = landing/portfolio/marketing design direction
- ข้อควรระวัง: ตรวจว่า rules (`MUST`/`NEVER`, bias ต่อ Tailwind/React/motion) รองรับ stack/design system ของโปรเจกต์ก่อนใช้

### 5.3 AntV Infographic — Infographic/Data-Storytelling Vertical

- Repository: <https://github.com/antvis/Infographic>
- สถานะ: **ADD · selective**
- รูปแบบ: rendering framework พร้อม skill pack (~5 ตัว)
- ขอบเขตหลัก: infographic creation · syntax/structure generation · item generation · template authoring/updating
- ความทับซ้อน: ต่ำกับ SDLC; ปานกลางกับ taste-skill เฉพาะ visual direction
- ติดตั้งแนะนำ: runtime use = creator + syntax/structure skills · developer use = template updater เฉพาะผู้ดูแล renderer
- Verification: ต้อง render และตรวจ visual, SVG, responsive behavior และ accessibility จริง

### 5.4 reverse-skill — Authorized Cybersecurity Vertical

- Repository: <https://github.com/zhaoxuya520/reverse-skill>
- สถานะ: **ADD · restricted (allowlist เท่านั้น)**
- รูปแบบ: security router pack พร้อม modules, scripts และ tool bootstrap
- ขอบเขต: reverse engineering, pentest, CTF และ security research
- เหมาะกับ: defensive testing หรือ security research ที่ได้รับอนุญาตอย่างชัดเจน
- ความทับซ้อน: สูงกับ ECC security และ Addy hardening
- **ข้อบังคับก่อนใช้:**
  1. ระบุ owner, target และ authorization scope
  2. allowlist เฉพาะโมดูลที่ต้องการ
  3. pin commit และ dependency
  4. review scripts/network/tool installation
  5. ใช้ sandbox และ audit log
  6. ห้าม global auto-trigger
- ไม่ควรรับ: modules ที่เน้น bypass, malware, credential abuse หรือ uncontrolled exploitation ใน environment ทั่วไป

---

## 6. Hybrid Collections และ Product-Specific Packs

| Package | รูปแบบ | ใช้เมื่อ | คำแนะนำ |
|---|---|---|---|
| [Ruflo](https://github.com/ruvnet/ruflo) | Meta-harness + MCP + plugins + large skill catalog | ต้องการ swarm/orchestration platform เต็มรูปแบบ | Pilot เป็น alternative stack; อย่าซ้อน Maestro/ECC orchestration |
| [claude-code-guide](https://github.com/zebbern/claude-code-guide) | Large skill/agent catalog | ต้องการค้นหา specialist skills เพิ่ม | ใช้เป็น source catalog แล้ว allowlist รายตัว |
| [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | Plugin + skills + agents + knowledge graph | ต้องการ persistent codebase understanding | เลือกแทน Graphify/Graft และวัด token/hook side effects |
| [OpenAI Codex Security](https://github.com/openai/codex-security) | Security CLI/SDK + bundled skills (Apache-2.0) | ใช้ official Codex Security runtime | ติดตั้งผ่าน official product workflow ไม่ copy nested skills |
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | Durable workflow platform + versioned skills | โปรเจกต์ใช้ Trigger.dev | ติดตั้ง skills ให้ตรง SDK version และ isolate secrets |

### 6.1 Ruflo

- มี skill/plugin catalog ขนาดใหญ่และ orchestration runtime
- technically ใช้เป็น collection ได้ แต่ operationally เป็น platform choice
- risk หลัก: tool discovery overload, hook/config mutation, dependency surface
- verdict: **Pilot — do not baseline**

### 6.2 claude-code-guide

- มี skill จำนวนมากและมีทั้ง Claude/Codex agent definitions
- คุณภาพและ provenance อาจต่างกันราย skill
- overlap สูงกับทุก collection หลัก และมี security content แบบ dual-use
- verdict: **Curate/allowlist — never import all**

### 6.3 Understand-Anything

- สร้าง `.ua/` knowledge graph/dashboard และรองรับหลาย agent
- มี hook, shell และ multi-agent assumptions
- verdict: **Pilot against Graphify/Graft**

### 6.4 Codex Security bundled skills

- มี security workflow skills เช่น scan, threat model, finding triage, validation และ fix
- ผูกกับ plugin artifacts, preflight และ access contract
- verdict: **Use only through official runtime**

### 6.5 Trigger.dev skills

- skills ผูกกับ Trigger.dev SDK/runtime และควร pin version
- verdict: **Install per project, not globally**

---

## 7. Single Skills และ Specialist Integrations

### 7.1 Hallmark — Design Alternative

- Repository: <https://github.com/Nutlope/hallmark>
- ประเภท: single anti-slop frontend skill (Claude Code, Cursor, Codex)
- เหมาะกับ: build, audit, redesign และ design study
- ความทับซ้อน: **สูงมากกับ taste-skill**
- กฎ: benchmark ด้วย brief เดียวกันแล้วเลือก `Hallmark` หรือ `taste-skill` เพียงตัวเดียว
- verdict: **Useful alternative, not an additional default layer**

### 7.2 claude-code-prompt-improver

- Repository: <https://github.com/severity1/claude-code-prompt-improver>
- ประเภท: Claude plugin/hooks + single skill
- ความทับซ้อน: Karpathy, Superpowers, Matt Pocock และ Maestro
- verdict: **A/B test only; Claude-specific hooks are not portable**

### 7.3 Graphify

- Repository: <https://github.com/Graphify-Labs/graphify>
- ประเภท: graph CLI/framework + single integration skill
- verdict: **Optional specialist; benchmark before adoption**

### 7.4 Graft

- Repository: <https://github.com/NanoNets/Graft>
- ประเภท: code graph/context CLI + MCP + single skill adapter
- verdict: **Optional specialist; inspect config changes and data egress**

### 7.5 Claude Code Sub-agents

- Repository: <https://github.com/lst97/claude-code-sub-agents>
- ประเภท: agent definitions ไม่ใช่ standard Agent Skills (ไม่มี `SKILL.md`)
- verdict: **Source catalog only; port agent/tool contracts manually**

### 7.6 CCPlugins

- Repository: <https://github.com/notlikeDev/CCPlugins>
- ประเภท: legacy Claude slash commands (ไม่มี `SKILL.md`)
- verdict: **Reference only; inspect Git side effects before reusing any command**

---

## 8. Skill Infrastructure และ Governance

### 8.1 autoskills — Discovery/Installer Layer

- Repository: <https://github.com/midudev/autoskills>
- ทำหน้าที่ scan tech stack → เลือก curated skills → verify hash → เขียน lockfile
- ไม่ใช่ content collection

```bash
npx autoskills --dry-run
```

- ตรวจผลเลือก, source, hash และ file diff ก่อนยืนยันติดตั้ง
- เก็บ `skills-lock.json` ใน version control เมื่อเหมาะสม
- verdict: **Useful local installer with mandatory review gate**

### 8.2 SkillHub — Team Registry/Governance Layer

- Repository: <https://github.com/iflytek/skillhub>
- ทำหน้าที่ publish, version, search, RBAC, audit และ self-hosted distribution
- ขั้น pilot: deploy ใน isolated environment → เปลี่ยน default credentials → กำหนด publisher/reviewer roles → บังคับ hash/signature/provenance → scan prompt injection และ scripts ก่อน publish
- verdict: **Strong governance candidate, but operationally heavier**

---

## 9. MCP, Memory และ Context Companions

| Tool | Capability | ใช้เมื่อ | ความเสี่ยงหลัก |
|---|---|---|---|
| [headroom](https://github.com/headroomlabs-ai/headroom) | **Runtime context compression** (tool outputs/logs/files/RAG chunks) ลด token 60–95% · library + proxy + MCP + plugin hooks · Apache-2.0 | ต้องการลด token จริงตอน runtime — **เสริม Maestro ไม่ทับ** (Maestro = ความรู้เรื่อง context budgeting, headroom = เครื่องจักรบีบอัด) | Compression loss, พฤติกรรมเปลี่ยนเมื่อ compress ผิดจุด, เพิ่มชั้นใน pipeline |
| [world-intel-mcp](https://github.com/marc-shade/world-intel-mcp) | Global intelligence MCP หลาย domain | Research, markets, geopolitical/cyber intelligence | Tool noise, public API freshness, rate limits, provenance |
| [TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | Shared chat/skill/wiki/code-graph memory | ต้องการ team-level persistent memory | ACL, retention, poisoning, stale memory, adapter maturity |
| [claude-context](https://github.com/zilliztech/claude-context) | Semantic code search MCP | Large-codebase retrieval | Embedding cost, code egress, vector-store operations |
| [Graphify](https://github.com/Graphify-Labs/graphify) | Code/knowledge graph | Architecture traversal | Hooks/config mutation, generated artifacts, model calls |
| [Graft](https://github.com/NanoNets/Graft) | Repository code graph/context | Code navigation and context compression | Stale index, provider data egress, project/global config writes |
| [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | Multi-agent codebase knowledge graph | Deep onboarding/architecture understanding | Token cost, semantic errors, post-commit hooks |

### Choose-one: Codebase Knowledge Layer

```text
Graphify             เมื่อเน้น graph traversal และหลาย input types
Graft                เมื่อเน้น CLI/MCP repository context
Understand-Anything  เมื่อยอมรับ plugin/multi-agent workflow และ persistent artifacts
```

ก่อนเลือกให้ benchmark ด้วย repository เดียวกัน: setup time · files/configs modified · indexing time · query precision/recall · stale-update behavior · token/API cost · data sent outside machine · uninstall/rollback completeness

---

## 10. Document, RAG และ Extraction Tools

| Tool | Capability | คำแนะนำ |
|---|---|---|
| [MarkPDFdown](https://github.com/MarkPDFdown/markpdfdown) | PDF/image to Markdown ผ่าน multimodal LLM | ทำ thin wrapper skill; benchmark ภาษาไทย ตาราง สูตร และ PII policy |
| [Morphik Core](https://github.com/morphik-org/morphik-core) | Multimodal document ingestion/retrieval | ใช้เป็น backend; ตรวจ **BSL 1.1**/commercial terms |
| [Unstract](https://github.com/Zipstack/unstract) | Prompt-based document-to-JSON platform/MCP | สร้าง schema-specific wrapper; validate output และตรวจ **AGPL** |
| [paperless-gpt](https://github.com/icereed/paperless-gpt) | OCR/metadata enrichment สำหรับ paperless-ngx | วางหลัง reverse-proxy auth และ human approval; ห้าม expose API ตรง |
| [knowledge_graph](https://github.com/rahulnyk/knowledge_graph) | Corpus-to-concept graph notebook/pipeline | ใช้เป็น reference implementation ไม่ใช่ production collection |
| [Local_Knowledge_Graph](https://github.com/punnerud/Local_Knowledge_Graph) | Local Ollama reasoning/RDF graph | ทดลองเป็น local backend หลัง legal review ของ **custom license** |

### Wrapper Skill Contract สำหรับ Document Tools

Wrapper ที่สร้างภายในควรระบุ:

1. input types และ maximum size/page count
2. local vs external model path
3. PII/confidential-document policy
4. prompt-injection handling
5. output schema และ validation
6. checksum/provenance ของ source document
7. human approval ก่อน ingest/publish/replace
8. retry, timeout, cost และ partial-failure behavior

---

## 11. Engineering และ Domain Tool Companions

| Tool | ประเภท | ใช้ร่วมกับ skill ใดได้ | หมายเหตุ |
|---|---|---|---|
| [Witr](https://github.com/pranshuparmar/witr) | Process/port/container diagnostic CLI | diagnose, production-ops | ทำ wrapper ที่ sanitize paths/env และขอสิทธิ์เมื่อจำเป็น |
| [Scrapy](https://github.com/scrapy/scrapy) | Web crawling framework | data scraping/research | ต้องมี domain allowlist, robots/ToS, rate limit และ output sanitization |
| [CodeVibes](https://github.com/danish296/codevibes) | AI code-review application | review/evaluation | ใช้หลัง benchmark false positives, privacy และ score validity |
| [Promptflow](https://github.com/microsoft/promptflow) | LLM flow/evaluation framework | Maestro/ECC eval workflows | ใช้เฉพาะทีมที่มี dependency อยู่แล้วและติดตาม migration direction |
| [TEN Framework](https://github.com/TEN-framework/ten-framework) | Realtime voice/multimodal framework | voice-agent domain skill | กำกับ audio privacy, consent, latency, credentials และ license additions |
| [full-stack-ai-agent-template](https://github.com/vstorm-co/full-stack-ai-agent-template) | FastAPI/Next.js agent template | prototype/architecture reference | ไม่ถือว่า generated output production-ready โดยอัตโนมัติ |
| [Dive](https://github.com/OpenAgentPlatform/Dive) | Desktop MCP/skills host | portability testing | เป็น delivery/test platform ไม่ใช่ skill source |
| [prompt-forge](https://github.com/insaaniManav/prompt-forge) | Prompt generation/evaluation workbench | prompt QA | ระวัง **GPL**, provider keys และ stale model assumptions |

---

## 12. การใช้ข้ามแพลตฟอร์ม (Portability)

> ตัว skill เป็น markdown จึง "พกไปได้" เกือบทุกแพลตฟอร์ม — สิ่งที่ต่างคือ **กลไกโหลด** (plugin / `npx skills add` / rules file / MCP) และของแถมที่ผูกกับแพลตฟอร์ม (hooks · agents · commands · meta-router) ซึ่งมักทำงานเฉพาะบน Claude Code

### 12.1 ตาราง Portability

> **ตรวจจาก repo จริงเมื่อ 2026-08-15** — เอกสารรุ่นก่อนระบุว่า superpowers/ECC ทำงานเต็มเฉพาะ Claude Code ซึ่ง **ล้าสมัยแล้ว** ทั้งสอง repo เพิ่ม platform adapter จำนวนมาก
> แยกเป็น 4 แกนแทน verdict เหมารวม: **Content** (ตัว skill) · **Plugin** (ติดตั้งแบบ native) · **Hooks** (session-start/compaction ฯลฯ) · **Commands** (slash command/namespace)
>
> **นิยามสัญลักษณ์ในตารางนี้** — capability status แบ่งเป็น 3 กลุ่ม และมี evidence marker แยกต่างหาก:
> **Documented** (upstream ระบุไว้ในเอกสาร): `✓✓` = มี coverage กว้าง/หลายองค์ประกอบ · `✓` = มี capability แบบจำกัดหรือเฉพาะจุด · `△` = มีแต่ upstream ยอมรับข้อจำกัดเอง · `✗` = เอกสารระบุว่าไม่มี
> **Unknown/unconfirmed:** `?` = ยังไม่พบเอกสารยืนยัน — ไม่ใช่ documented absence
> **Not applicable:** `—` = ไม่เกี่ยวข้องหรือไม่มีแกนนี้ให้ประเมิน — ไม่ใช่ข้อมูลที่ขาดหาย
> **Evidence marker:** `T` = **runtime-tested โดยผู้จัดทำ catalog** — *ยังไม่มีช่องใดเป็น `T` เพราะยังไม่ได้ทดสอบจริงสักตัว*
>
> ⚠️ การมี adapter directory **ไม่เท่ากับ feature parity เต็ม** — `✓` ในตารางนี้แปลว่า "เอกสารบอกว่ามี" ไม่ใช่ "เราเห็นมันทำงาน"

| ชุด | Content | Plugin | Hooks | Commands | สรุป |
|---|:---:|:---:|:---:|:---:|---|
| karpathy | ✓✓ ทุกที่ | — | — | — | 1 ไฟล์ copy เป็น rules ได้ตรงๆ (`.cursorrules` / `.clinerules` / `AGENTS.md`) — portable สูงสุด |
| **superpowers** | ✓✓ **14 install targets** *(13 harness families — Codex App/CLI นับแยก)* | ✓✓ marketplace หลายเจ้า | △ **บางส่วน** | ✗ (ใช้ skills เป็น entrypoint; ไม่มี slash-command namespace แยก) | Claude Code · Antigravity · **Codex App · Codex CLI** · Cursor · Devin CLI · Factory Droid · Gemini CLI · Copilot CLI · Grok Build CLI · Kimi Code · OpenCode · Pi · Hermes · **hooks: Antigravity รัน session-start hook ได้ / Hermes ไม่มี post-compaction hook / ที่เหลือยังไม่ยืนยัน** |
| mattpocock | ✓✓ | — | — | — | `npx skills add` รองรับหลาย agent / copy เป็น rules ได้ |
| addyosmani | ✓✓ | ✓ marketplace | ✗ | — | README รองรับ Gemini CLI / opencode |
| **ecc** | ✓✓ หลาย harness | ✓✓ CC (stable) · Codex (native plugin) · OpenCode (beta plugin); **Cursor เป็น project adapter ไม่ใช่ plugin** | △ **CC (native) · Cursor (adapter, hook set ไม่เท่ากัน) · Codex native plugin (provider-specific subset; ต่างจาก legacy sync — ดู §12.1.1)** — **Copilot ไม่มี hooks** | △ namespace เฉพาะ CC | **ระดับต่างกันมาก — ดูตารางย่อย §12.1.1** · upstream matrix ให้ parity ของ Codex/Cursor/OpenCode = *Partial* แต่ส่วน Codex ใน matrix ล้าหลัง native-plugin docs |
| maestro | ✓✓ 10 providers | ✓ + **MCP server** | — | ✓ commands | MCP ใช้ได้กับทุก client ที่รองรับ MCP + VS Code ext |
| taste-skill | ✓✓ | ✓ plugin | — | — | + มี skill ที่เจาะปลายทางเฉพาะ (§12.2) |
| founder-skills | ✓✓ | — | — | — | เนื้อหาเป็น business guidance ล้วน — พกได้ทุกที่ |
| ui-skills | ? | CLI ของตัวเอง | ? | ? | `npx ui-skills` — **ยังไม่ได้ตรวจว่ารองรับ agent ใดบ้าง** จึงเป็น `?` ตามนิยามด้านบน |
| Infographic | △ | — | — | — | ผูกกับ renderer/DSL — ต้องมี runtime ปลายทาง |
| reverse-skill | △ (governed) | ✗ | ✗ | — | scripts/tool bootstrap ผูก OS มากกว่าผูก agent |
| Ruflo | ✓ | ✓ + MCP | △ | ✓ | MCP ใช้ข้ามได้ แต่ hooks/config mutation ผูกแพลตฟอร์ม |
| Hallmark | ✓✓ | — | — | — | ประกาศรองรับ Claude Code / Cursor / Codex |
| prompt-improver | ✓ | Claude only | ✗ | — | **hooks ไม่ portable** |

#### 12.1.1 ECC — ระดับ capability ต่อแพลตฟอร์ม (จาก README + `.codex-plugin/README.md`, ตรวจ 2026-08-15)

> **แหล่งข้อมูล:** สังเคราะห์จาก `Install ECC` / `Codex App and CLI` / `Platform Support` / `Cross-tool capability map` / ส่วน support เชิงลึกใน README และ `.codex-plugin/README.md` ของ ECC — ไม่ใช้ matrix เพียงส่วนเดียว เพราะส่วน Codex ใน matrix ยังอธิบาย legacy sync ขณะที่ native-plugin docs ใหม่กว่าและมี capability คนละชุด · **ไม่ระบุจำนวน platform รวมโดยเจตนา** เพราะ README จัดกลุ่มไม่คงที่และมี directory ที่ไม่มี guide กำกับ

| Status ตาม upstream | Platform | การติดตั้ง | ได้อะไร | ข้อจำกัดที่ upstream ระบุเอง |
|---|---|---|---|---|
| **Stable primary** | Claude Code | plugin หรือ selective installer | skills · agents · commands · **hooks (native)** · rules · `/ecc:` | plugin โฆษณา catalog ทั้งหมดให้ model — ใช้ selective profile เมื่อ context footprint สำคัญ |
| **Native repo-marketplace plugin** *(ทางหลักปัจจุบัน)* | Codex (App/CLI) | `codex plugin marketplace add affaan-m/ECC` → `codex plugin add ecc@ecc` · ใน Codex เรียก `$configure-ecc` | manifest · **281 skills** · **1 default MCP** (Chrome DevTools) · Codex lifecycle-hook projection · scripts · assets | ⚠️ hooks ต้อง **explicit trust decision** ผ่าน `/hooks` · synchronous `SessionStart` ผ่านการ verify กับ Codex 0.146 · handlers ที่ block tools, ใช้ event ที่ไม่รองรับ, async หรือผิด Codex hook protocol ถูกตัดออก · ไม่ใช้ ECC hook profiles 4 แบบของ Claude · plugin state เดียวใน `CODEX_HOME` |
| **Sync path** *(deprecated compatibility)* | Codex (App/CLI) | `scripts/sync-ecc-to-codex.sh` | config 1 · `AGENTS.md` 2 · skills 32 · MCP 6 (7 เมื่อเพิ่ม Supabase) · profiles 2 · agent roles 3 · copied/merged config ใน `~/.codex` | upstream ระบุว่า **deprecated** — ไม่จำเป็นเมื่อใช้ native plugin · ไม่สร้าง marketplace registration หรือ native-plugin hook runtime · enforcement ผ่าน instructions/config/sandbox |
| **Beta project adapter** | **Cursor** | `install.sh --target cursor <lang>` *(full)* หรือ `--profile minimal` *(ย่อ)* | **15 hook events · 16 hook scripts · 34 rules · 48 agents · skills · commands · MCP config** ผ่าน `.cursor/hooks/adapter.js` | agent discovery ต่างกันตาม Cursor build · installer paths **ยังไม่ expose hook set เท่ากัน** ([#2419](https://github.com/affaan-m/ECC/issues/2419)) · parity = **partial** |
| **Beta built plugin** | OpenCode | build plugin → selective installer | skills (subset) · agents · plugin events | ships **เพียง subset** ของ catalog · reference config pin Anthropic models ([#2617](https://github.com/affaan-m/ECC/issues/2617)) |
| **Instruction-only** | GitHub Copilot | checked-in instructions + prompt files | instructions + prompt files | ⚠️ **ไม่มี hooks, runtime agents, delegation หรือ native skill discovery** |
| **Experimental / minimal** | Gemini · Zed · Antigravity · Qwen · Hermes · OpenClaw · **Kimi** · CodeBuddy · JoyCode | harness-specific selective target | file placement + instruction portability | **ไม่เคลม full parity** — ทดสอบแค่ว่าไฟล์ไปถูกที่และ instruction พกได้ |
| **Directory only** | Trae · Kiro · Pi | — | มี `.trae/` `.kiro/` `.pi/` ใน repo แต่ยังไม่พบ guide กำกับ | ยังไม่ยืนยัน |

**อ่านอย่างไร:**

- **Cursor ไม่ใช่ "skills + rules เท่านั้น"** — เป็น adapter ที่ครบเกือบทุกองค์ประกอบ (`--profile minimal` เป็น *ตัวเลือกติดตั้ง* ไม่ใช่เพดานความสามารถของแพลตฟอร์ม) แต่ก็ยัง **ไม่ใช่ full parity** เพราะ upstream ระบุเองว่าเป็น Beta และ hook set ยังไม่เท่ากัน
- **Codex ต้องดูเป็นราย distribution path** ไม่ใช่ราย platform — native plugin มี Codex-specific hook projection จริง (ปัจจุบันยืนยัน synchronous `SessionStart`) แต่เป็น subset ไม่ใช่ Claude hook parity; legacy sync ไม่มี native-plugin hook runtime
- **Kimi อยู่กลุ่ม experimental/minimal** ไม่ใช่ native
- `/ecc:` namespace ทำงานเฉพาะ Claude Code · Parity column ของ upstream ให้ Codex/Cursor/OpenCode = **Partial** ทั้งหมด — *แต่ช่อง Codex ของ matrix อธิบาย sync generation จึงล้าหลัง native-plugin docs (ดูกล่อง ⚠️ ด้านล่าง)*

> ⚠️ **README ของ ECC ยังใช้ข้อมูล Codex คนละ generation ปะปนกัน (ตรวจ 2026-08-15)** — ต้องแยก native plugin ออกจาก legacy sync ห้ามหยิบ matrix เพียงส่วนเดียวมาสรุป:
>
> | ที่ | ข้อความ |
> |---|---|
> | §`Codex App and CLI` | native marketplace plugin ส่ง *"skills, MCP configuration, **hook runtime**, scripts, and assets"* · native hooks ต้อง explicit trust |
> | `.codex-plugin/README.md` | native plugin = **281 skills + 1 default MCP + Codex lifecycle hooks**; synchronous `SessionStart` verified บน Codex 0.146 และตัด handlers ที่ protocol ไม่รองรับ |
> | §`Platform Support` + `Cross-tool capability map` | ยังอธิบาย repo/sync generation: **"No ECC hook runtime"** / hooks = **"Not supported"** |
> | §`Codex macOS app + CLI support in depth` → `What's included for Codex` / `Key limitation` | repo/sync setup = skills 32 + MCP 6 + roles/profiles; ไม่มี Claude-style parity และ enforcement ผ่าน `AGENTS.md`/config/sandbox |
>
> **การอ่านที่สอดคล้องที่สุด:** native plugin มี provider-specific hook projection จริงและต้อง trust แต่รองรับเพียง subset ของ Claude workflows; legacy sync เป็น instruction/config-based และไม่มี native-plugin hook runtime · matrix ที่เขียนว่า "No ECC hook runtime" อธิบาย sync generation และล้าหลัง install/plugin docs (matrix ยังเรียก marketplace ว่า *experimental* และ sync ว่า *supported* ขณะที่ install section เรียก sync ว่า **deprecated**) · **อย่าเอาจำนวนหรือข้อจำกัดของสอง path มารวมกัน**

⚠️ ตารางนี้เป็น **documented** (จาก README) ไม่ใช่ **tested** — ยังไม่ได้ทดสอบ command/hook parity จริงบนแต่ละ harness

### 12.2 taste-skill — จับคู่ skill กับปลายทาง

| ปลายทาง | ตัวที่เกี่ยวข้อง |
|---------|-----------------|
| ทุก coding agent (Claude Code / Codex / Cursor / Cline / Zcode / OpenCode / Kilo / Qwen / Kimi / Antigravity) | `design-taste-frontend` (หลัก) · style variants (`industrial-brutalist-ui` / `minimalist-ui` / `high-end-visual-design`) · `redesign-existing-projects` · `full-output-enforcement` |
| Codex (เพิ่มจากชุดพื้นฐาน) | `image-to-code` (เขียนมาเจาะ Codex โดยตรง — generate ภาพ design เองก่อนแล้ว implement ตามภาพ) |
| ChatGPT / GPT models | `gpt-taste` |
| Google Stitch | `stitch-design-taste` |
| เครื่องมือ generate ภาพ (ChatGPT Images ฯลฯ) | `imagegen-frontend-web` / `imagegen-frontend-mobile` / `brandkit` |

### 12.3 ข้อสรุปเชิงเลือกใช้

ชุดที่ **ใช้เนื้อหาชุดเดียวกันข้ามหลายแพลตฟอร์มได้** คือ karpathy · mattpocock · maestro · taste-skill · founder-skills · Hallmark

> ⚠️ "ใช้เนื้อหาเดียวกันได้" **ไม่ได้แปลว่าติดตั้งครั้งเดียวจบ** — แต่ละ harness ต้องติดตั้งและตรวจ integration แยกกันเสมอ (README ของ superpowers ระบุเรื่องนี้ชัด)

**superpowers และ ecc ไม่ใช่ Claude-Code-only อีกต่อไป** (ตรวจ 2026-08-15) — แต่หลักฐานของสองตัวนี้**ไม่เหมือนกัน** จึงต้องอ่านแยก:

```text
Superpowers
  content/plugin   รองรับ 14 install targets ตามที่ README ระบุ
  hook parity      ยืนยันเฉพาะ Antigravity (session-start hook)
                   Hermes ไม่มี post-compaction hook
                   ที่เหลือยังไม่ยืนยัน — อย่าอนุมานว่ามี

ECC  (สังเคราะห์จาก upstream install/plugin/support docs; แยกตาม distribution path)
  stable primary   Claude Code        skills+agents+commands+hooks+rules
  Codex — แยกตาม distribution path:
    native plugin  Codex App/CLI      skills(281)+MCP default(1)+scripts/assets+
                                      trusted hook subset (SessionStart verified)
    sync (deprecated)                 skills(32)+MCP(6)+roles/profiles+config
                                      — ไม่มี native-plugin hook runtime
  beta adapter     Cursor             hooks(15 events)+rules(34)+agents(48)+
                                      skills+commands+MCP — hook set ยังไม่เท่า CC
  beta plugin      OpenCode           subset ของ catalog + plugin events
  instruction-only GitHub Copilot     instructions/prompts เท่านั้น
  experimental     Gemini · Zed · Antigravity · Qwen · Hermes ·
                   OpenClaw · Kimi · CodeBuddy · JoyCode
                                      file placement + instruction portability
  namespace /ecc:  Claude Code เท่านั้น
```

> `--profile minimal` เป็น **ตัวเลือกตอนติดตั้ง** (ลด context/capability) ไม่ใช่เพดานของแพลตฟอร์ม — อย่าอ่าน quick-install entry เป็น classification ของ harness

ส่วน **prompt-improver ยังเป็น Claude-only จริง** (hooks ไม่ portable) และ **Ruflo** พึ่ง MCP/hook mutation จึงต้องตรวจต่อแพลตฟอร์ม

**การ prune skill ที่ "ไม่ใช้" ต้องตัดสิน *ต่อแพลตฟอร์ม* ไม่ใช่ตัดจากเอกสารกลาง** — เช่น `image-to-code` ไร้ประโยชน์บน Claude Code แต่เป็นตัวหลักบน Codex

### 12.4 Harness ที่อ่าน SKILL.md ได้เอง (ฝั่งผู้บริโภค skills)

> **มุมมองที่ §12.1–12.3 มองไม่เห็น:** ตารางด้านบนตอบว่า *"upstream repo ประกาศรองรับ harness ไหน"* — ส่วน harness ที่อ่าน `SKILL.md` ได้ถือว่า **รองรับโครงสร้างเนื้อหาเบื้องต้น** แม้ upstream ของ collection จะไม่เคยประกาศชื่อ harness นั้น อย่างไรก็ตาม การอ่านไฟล์ได้ยังไม่เท่ากับใช้งานได้ครบ: ต้องตรวจ frontmatter, tool names, scripts/dependencies, paths, permissions และทำ smoke test ราย collection สองมุมนี้จึงต้องดูคู่กัน
> ตรวจ 2026-08-15 · **documented ไม่ใช่ runtime-tested** ตามนิยาม §12.1

| Harness | อ่าน `SKILL.md` เอง | หลักฐาน / กลไก | หมายเหตุ |
|---|:---:|---|---|
| **Qoder** (IDE + CLI) | ✓ native | [docs.qoder.com/extensions/skills](https://docs.qoder.com/extensions/skills) · [cloud-agents/skills](https://docs.qoder.com/cloud-agents/skills) — แต่ละ skill เป็น `SKILL.md` + auxiliary files · model เลือกโหลดเองจาก description | รองรับทั้ง user-level และ project-level · ทำงานเหมือนกันทั้ง IDE และ CLI |
| **Mistral Vibe** | ✓ native | [mistralai/mistral-vibe](https://github.com/mistralai/mistral-vibe) (Apache-2.0) — `SkillManager` crawl หา directory ที่มี `SKILL.md` · project config มาก่อน global | รองรับ project instructions · skills · **MCP · hooks · permissions · saved sessions** ครบชุด · community catalog/installer: [agentskill.sh/vibe](https://agentskill.sh/vibe) (ไม่ใช่ upstream evidence) |
| **DeepSeek Harness** | ✓ compatible | [deepseek.com/harness](https://deepseek.com/harness/en/) · [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — *"everything is a plugin"* (models · tools · **skills** · sessions · sandboxes · loops) · repo ใช้ `SKILL.md` ผ่าน `.agents/skills/` | developer preview · มี Web UI + `dsh` command-line launcher/runtime + Python SDK |
| **Grok Build CLI** | ✓ ผ่าน plugin | superpowers รองรับ native: `grok plugin install superpowers@xai-official --trust` ([xAI plugin marketplace](https://github.com/xai-org/plugin-marketplace)) | อยู่ในตาราง §12.1 (1 ใน 14 install targets ของ superpowers) แล้ว |
| **Factory Droid** | ✓ ผ่าน plugin | superpowers รองรับ native: `droid plugin install superpowers@superpowers` | อยู่ในตาราง §12.1 แล้ว |
| **MiMo CLI** (Xiaomi) | △ **คนละรูปแบบ** | [KoinaAI/MiMo-CLI](https://github.com/KoinaAI/MiMo-CLI) — มีระบบ skills จริงแต่เป็น **flat `*.md`** ใน `.mimo/skills/` (project) หรือ `~/.mimo-code/skills/` (global) · frontmatter ใช้ `name` · `description` · **`triggers` (array ของ keyword)** · `always` (bool) · ต้องประกาศใน `~/.mimo-code/config.json` หรือ `.mimo-code.json` | ⚠️ **ไม่ใช่ drop-in** — spec มาตรฐานคือ *โฟลเดอร์ที่มี `SKILL.md`* + routing จาก description ส่วน MiMo เป็น *ไฟล์เดี่ยว* + routing จาก keyword ต้อง **แปลงรูปแบบก่อนใช้** · แต่มี `AGENTS.md` · **hooks** (`session_start`, `user_prompt`, `after_tool`) · **MCP stdio** · subagents (`.mimo/agents/*.md`) ครบ |
| **Freebuff** | ? | [CodebuffAI/freebuff](https://github.com/CodebuffAI/freebuff) — จาก repo/docs ที่ตรวจ ณ 2026-08-15 **ยังไม่พบหลักฐานยืนยันการรองรับ `SKILL.md` โดยตรง** · ใช้ `AGENTS.md` + custom agents ผ่าน `@codebuff/sdk` · พบ 9 operational agent folders ใน snapshot ที่ตรวจ | สถานะยังไม่ยืนยัน; กลไกที่ตรวจพบในปัจจุบันต้องแปลง collection เป็น `AGENTS.md` หรือ Codebuff agent |
| **Ollama** | — (คนละชั้น) | เป็น **model runner** ไม่ใช่ agent harness — ไม่มี skill router ของตัวเอง · แต่ harness ที่อ่าน `SKILL.md` (เช่น DeepSeek Harness, ollama-agent-harness ของบุคคลที่สาม) ต่อ Ollama เป็น backend ได้ | อย่าจัด Ollama เป็น "แพลตฟอร์มที่รองรับ skills" — มันเป็นชั้น model ไม่ใช่ชั้น harness |

**ผลต่อการเลือกใช้:**

- Collection ที่เป็น **markdown ล้วน** (karpathy · mattpocock · addyosmani · founder-skills · taste-skill · Hallmark) เป็น **candidate สำหรับ pilot** บน Qoder / Mistral Vibe / DeepSeek Harness เมื่อวางไฟล์ใน path ที่รองรับ แต่ยังต้องตรวจ frontmatter, tool names, scripts/dependencies, paths, permissions และทำ smoke test ราย collection
- Collection ที่พึ่ง **hooks/agents/commands/namespace** (superpowers · ecc · Ruflo · prompt-improver) ได้เฉพาะ *เนื้อ skill* ส่วน automation ต้องดูราย harness ตาม §12.1
- **Mistral Vibe มี integration surface ค่อนข้างกว้างตามเอกสาร upstream** โดยรองรับ hooks + MCP + permissions; การจัดอันดับเทียบ harness อื่นต้องอาศัย benchmark/runtime test แยกต่างหาก
- **ระวังการเหมาว่า "รองรับ skills" = "ใช้ collection ได้เลย"** — `MiMo CLI` รองรับ skills เต็มรูปแบบ (มี hooks/MCP/subagents ด้วยซ้ำ) แต่ใช้ **flat `*.md` + `triggers` keyword** คนละ spec กับ *โฟลเดอร์ + `SKILL.md` + description routing* จึงต้องเขียน converter หรือแปลงมือก่อน · เกณฑ์ที่ควรถามคือ **"อ่านไฟล์รูปแบบไหน และ route ด้วยอะไร"** ไม่ใช่แค่ "มีระบบ skills หรือเปล่า"

---

## 13. Decision Guide ตามชนิดงาน

| สถานการณ์ | Stack/เครื่องมือที่แนะนำ |
|---|---|
| โปรเจกต์ทั่วไปขนาดเล็ก / solo | Karpathy + Superpowers |
| เน้น reasoning/design ก่อน coding | Karpathy + Matt Pocock (grilling, codebase-design, domain-modeling) |
| ต้องการ full SDLC เบา | Karpathy + Addy Osmani |
| โปรเจกต์ใหญ่/หลาย domain/หลายภาษา | Karpathy + ECC แบบ selective |
| TypeScript / frontend หนัก | Matt Pocock + Superpowers |
| เน้นความถูกต้องสูง (prod/security) | Karpathy + `addyosmani:doubt-driven-development` + `superpowers:systematic-debugging` |
| สร้าง LLM/RAG/agent product | SDLC stack + Maestro (+ headroom ถ้า token เป็นคอขวด) |
| จูน/ฮาร์เดนเวิร์กโฟลว์ coding agent เอง | Maestro (`/diagnose` → `/fortify` → `/refine`) — เพิ่มบน stack เดิมได้เลย |
| ต้องการ orchestration platform เต็ม | ประเมิน Ruflo แทน Maestro/ECC orchestration |
| Founder/GTM/pricing/SOP | founder-skills แบบ selective |
| Product UI/a11y/performance | ui-skills |
| Landing/portfolio/premium redesign | taste-skill หรือ Hallmark (เลือกตัวเดียว) |
| Infographic/data storytelling | AntV Infographic |
| Authorized defensive security | reverse-skill allowlist หรือ Codex Security official runtime |
| Durable background AI workflows | Trigger.dev skills เฉพาะโปรเจกต์ |
| Codebase graph/context | เลือก Graphify, Graft หรือ Understand-Anything |
| Team skill registry/governance | SkillHub |
| Auto-select skills ตาม tech stack | autoskills dry-run + human review |
| PDF/document ingestion | MarkPDFdown/Morphik/Unstract wrapper + governance gates |
| Web crawling | Scrapy wrapper + legal/robots/rate-limit controls |
| Process/port/container diagnosis | Witr wrapper |

---

## 14. Routing และ Collision Rules

### 14.1 SDLC collision

```text
เลือกหนึ่งตัว:
  mattpocock     thinking/control
  addyosmani     lightweight production playbook
  ecc            broad domain/language framework
```

### 14.2 Agent workflow collision

```text
เลือกหนึ่งแกนหลัก:
  maestro        audit/refine/context/tools/RAG/guardrails
  ruflo          orchestration/meta-harness/swarm platform
  ECC subset     เมื่อใช้งาน ECC อยู่แล้วและต้องการเพียงบาง agent skills
```

### 14.3 Frontend collision

```text
product UI / accessibility / motion performance  -> ui-skills
marketing page / landing / portfolio             -> taste-skill OR Hallmark
infographic / structured visual narrative        -> AntV Infographic
```

### 14.4 Code-context collision

```text
เลือก Graphify OR Graft OR Understand-Anything
อย่าเปิด hooks/indexers หลายชุดกับ repository เดียวก่อน benchmark
```

### 14.5 Security routing

- security skill ต้องไม่ auto-trigger จากข้อความกำกวม
- ต้องยืนยัน defensive/authorized scope
- แยก scan/review จาก exploit/remediation actions
- network, install, privilege escalation และ destructive actions ต้องมี approval
- เก็บ evidence, command log และ target boundaries

---

## 15. ความสัมพันธ์เชิงทับซ้อนรายคู่ (Pairwise Overlap)

| คู่ | ทับซ้อน | คำแนะนำ |
|-----|:-------:|---------|
| addyosmani ↔ ecc | **สูงมาก** | เลือกตัวเดียว (ecc ครอบ addyosmani) |
| superpowers ↔ addyosmani | กลาง | TDD/debug/review/plan ซ้ำ — superpowers เข้มกว่าด้านวินัย |
| mattpocock ↔ ecc | กลาง | คิด/วางแผนซ้ำ — ecc กว้างกว่า, mattpocock ลึกด้าน thinking |
| superpowers ↔ mattpocock | ต่ำ | เสริมกัน (process ↔ thinking-tools) |
| superpowers ↔ ecc | กลาง | process ซ้ำ — superpowers rigid กว่า |
| karpathy ↔ ทุกตัว | ~0 | orthogonal — เนื้อหาไม่ชน (ยังต้องนับ context/routing ตามปกติ) |
| maestro ↔ ecc | กลาง (subset) | เฉพาะ agent-eng — ecc กระจัดกระจาย, maestro รวมศูนย์+memory/audit |
| maestro ↔ superpowers | ต่ำ | process-for-coding vs engineering-the-agent — เสริมกัน |
| maestro ↔ addyosmani/mattpocock | ต่ำ–~0 | subject ต่าง; แตะ context-engineering เล็กน้อย |
| maestro ↔ karpathy | ~0 | orthogonal |
| **maestro ↔ ruflo** | **สูง** | คนละปรัชญาแต่ subject เดียวกัน — **เลือกตัวเดียว** |
| **maestro ↔ headroom** | **~0 (เสริมกัน)** | ความรู้เรื่อง context budget vs เครื่องจักรบีบอัดจริง — ใช้คู่กันได้ |
| taste-skill ↔ addyosmani | กลาง (เฉพาะ frontend) | `frontend-ui-engineering` กว้างแต่ตื้นกว่า; taste-skill ลึกด้าน taste |
| taste-skill ↔ ecc | กลาง (เฉพาะ frontend) | ecc มี `frontend-design-direction`/`design-system`/`frontend-patterns` — เลือกฝั่งเดียว |
| **taste-skill ↔ Hallmark** | **สูงมาก** | subject เดียวกัน (anti-slop frontend) — **เลือกตัวเดียว** |
| **taste-skill ↔ ui-skills** | **สูง (คนละ surface)** | taste-skill = marketing page · ui-skills = product UI — แยก routing ให้ชัด ไม่เปิดคู่แบบ global |
| **ui-skills ↔ addyosmani/ecc** | กลาง | `frontend-ui-engineering` / `frontend-patterns` / a11y skills ซ้ำบางส่วน |
| **founder-skills ↔ ecc** | ต่ำ–กลาง | ecc มี business/product บางตัว — founder-skills ลึกกว่าด้าน GTM/pricing |
| **founder-skills ↔ taste-skill** | ต่ำ (เฉพาะ CRO/copy) | เสียบร่วมกันได้ |
| **Infographic ↔ taste-skill** | ต่ำ–กลาง | structured infographic vs page design — คนละ output |
| **reverse-skill ↔ ecc security** | สูง | ecc มี `security-review`/`security-scan`/`bounty-hunter` — reverse-skill ลึกกว่าแต่เสี่ยงกว่า |
| **Graphify ↔ Graft ↔ Understand-Anything** | **สูงมาก (ทั้งสามคู่)** | subject เดียวกัน — **เลือกตัวเดียว** |
| karpathy/superpowers/mattpocock ↔ verticals ทุกตัว | ~0 | คนละ subject — เนื้อหาทับซ้อนต่ำ แต่ยังต้องตรวจ routing, context budget, hooks และ project instructions |

---

## 16. Installation Guidance

> ตรวจ README และ pin revision ก่อนติดตั้งจริง คำสั่ง upstream อาจเปลี่ยนตามเวลา

### Core collections

```bash
npx skills add multica-ai/andrej-karpathy-skills          # karpathy
npx skills add https://github.com/obra/superpowers        # superpowers (มี native plugin สำหรับ Codex/Cursor/Kimi/OpenCode ด้วย — ดู §12.1)
npx skills@latest add mattpocock/skills                   # mattpocock
npx skills add addyosmani/agent-skills                    # addyosmani
npx skills add https://github.com/affaan-m/ECC            # ecc (เฉพาะเนื้อ skill นอก Claude Code)
npx skills add sharpdeveye/maestro                        # maestro
npx skills add https://github.com/Leonxlnx/taste-skill    # taste-skill
```

**Claude Code (native plugin):** superpowers ใช้ marketplace `obra/superpowers-marketplace` → `plugin install superpowers` · ecc/addyosmani ใช้ marketplace plugin (`enable`)

### New vertical candidates

```bash
npx skills add https://github.com/ognjengt/founder-skills
npx ui-skills start
npx skills add https://github.com/antvis/Infographic
```

สำหรับ `reverse-skill` **ไม่ควรใช้คำสั่งติดตั้งทั้ง repo แบบอัตโนมัติ** ให้ clone/inspect → เลือกโมดูล → pin revision → ติดตั้งผ่าน governed process เท่านั้น

### Alternatives and infrastructure

```bash
npx skills add nutlope/hallmark
npx autoskills --dry-run
```

สำหรับ Ruflo, Codex Security, Trigger.dev, SkillHub, Graphify, Graft, Understand-Anything และ headroom ให้ใช้ installation path ของผลิตภัณฑ์และตรวจ side effects ก่อนทุกครั้ง

---

## 17. Acceptance Gate ก่อนรับ Skill/Pack ใหม่

### Structure

- [ ] มี `SKILL.md` และ frontmatter ถูกต้อง
- [ ] ชื่อ, description, trigger และ scope สอดคล้องกัน
- [ ] references/scripts ใช้ progressive loading
- [ ] ไม่มี duplicate router description กับ skill ที่ติดตั้งอยู่

### Quality

- [ ] มี representative tasks และ expected outputs
- [ ] มี negative/non-trigger tests
- [ ] ผ่าน regression test บน runtime เป้าหมาย
- [ ] ไม่มี claims ที่ไม่มีหลักฐานหรือ technical references ที่ล้าสมัย

### Security and governance

- [ ] ระบุ upstream, commit/version, license และ checksum
- [ ] review scripts, hooks, network calls และ dependency installation
- [ ] มี credential/data-egress policy
- [ ] มี human approval สำหรับ destructive, security, ingestion และ publish actions
- [ ] มี rollback/uninstall path

### Cost and operations

- [ ] วัดขนาด `SKILL.md` และ references
- [ ] วัด token/tool discovery overhead
- [ ] ตรวจ files/configs ที่ installer แก้ไข
- [ ] กำหนด timeout/retry/cost ceiling
- [ ] ไม่เปิด overlapping collections เกินความจำเป็น

---

## 18. สถานะ Catalog

| กลุ่ม | รายการ | สถานะ |
|---|---|---|
| Behavioral baseline | Karpathy | Keep |
| Process discipline | Superpowers | Keep |
| SDLC choice | Matt Pocock / Addy Osmani / ECC | Choose one |
| Agent workflow | Maestro | Keep when relevant |
| Existing design vertical | taste-skill | Keep; compare Hallmark |
| New business vertical | founder-skills | Add selective |
| New UI vertical | ui-skills | Add opt-in |
| New infographic vertical | AntV Infographic | Add selective |
| New security vertical | reverse-skill | Restricted allowlist |
| Alternative orchestration | Ruflo | Pilot separately |
| Large external catalog | claude-code-guide | Curate only |
| Product-specific security | Codex Security | Official runtime only |
| Product-specific workflows | Trigger.dev skills | Per-project only |
| Design alternative | Hallmark | Choose against taste-skill |
| Code graph/context | Graphify / Graft / Understand-Anything | Choose one after benchmark |
| Skill installer | autoskills | Dry-run + review |
| Team registry | SkillHub | Governance pilot |
| Runtime context compression | headroom | Companion — เสริม Maestro |
| MCP/tools/frameworks | รายการใน §9–§11 | Track as companions, not collections |

### สรุปสั้น (1 บรรทัด/ชุด)

- **karpathy** → "นิสัยเขียนโค้ดที่ดี" 1 ไฟล์ ใส่ทุกโปรเจกต์
- **superpowers** → "ระเบียบวินัยกระบวนการ" ที่บังคับทำตามเป๊ะ
- **mattpocock** → "เครื่องมือคิด/วางแผน" สำหรับ engineer ที่อยากคุมกระบวนการเอง
- **addyosmani** → "playbook ครบ SDLC แบบเบา" spec→ship
- **ecc** → "ซูเปอร์มาร์เก็ต" ครบทุกภาษา/domain/orchestration เลือกหยิบเฉพาะที่ใช้
- **maestro** → "โค้ชเวิร์กโฟลว์ของ AI agent" — audit→fix + memory/audit/cost · คนละแกนกับ SDLC stack
- **taste-skill** → "รสนิยม design ของ frontend" — anti-slop สำหรับ landing/portfolio · ระวัง context ตัวหลัก ~87KB
- **founder-skills** → "ที่ปรึกษาธุรกิจ" GTM/pricing/SOP — นอกแกน SDLC ทั้งหมด
- **ui-skills** → "ผู้ตรวจ product UI" a11y/motion/metadata — คนละ surface กับ taste-skill
- **Infographic** → "โรงงาน infographic" ผูก renderer/DSL ของ AntV
- **reverse-skill** → "ชุดเครื่องมือ security" ที่ต้องมีใบอนุญาตและ allowlist ก่อนแตะ
- **headroom** → "เครื่องบีบอัด context" ตอน runtime — ไม่ใช่ skill แต่ลด token จริง

---

## 19. ภาคผนวก — ตารางเปรียบเทียบละเอียด (A–F)

> **เกณฑ์สัญลักษณ์:** `✓✓` แข็งแกร่ง/มีหลายตัว · `✓` มี · `△` บางส่วน/ทางอ้อม · `✗` ไม่มี

### ตาราง A — ข้อมูลพื้นฐาน (Identity)

| รายการ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|--------|----------|-------------|------------|------------|-----|---------|-------------|
| **เจ้าของ** | multica-ai (อิง A. Karpathy) | **obra (Jesse Vincent)** | Matt Pocock | Addy Osmani | **affaan-m** | sharpdeveye | Leonxlnx (sponsor: Vercel OSS) |
| **จำนวน skill** | 1 | ~14 | ~35 | 24 | หลายร้อย | 25 (1 core + 24 cmd) | 13 |
| **+ agents/commands** | ✗ | ✗ | ✗ | มี agents | ✓✓ (agents+commands เยอะ) | ✓✓ (24 cmd + 10 MCP tools + VS Code ext) | ✗ (skills ล้วน) |
| **ขนาดต่อ skill** | เล็กมาก (~2.5KB) | กลาง | เล็ก-กลาง | กลาง | กลาง-ใหญ่ | กลาง (+ 7 reference หนัก) | 2.6KB–87KB (ตัวหลักใหญ่สุดในทุกชุด) |
| **โครงสร้าง** | ไฟล์เดียว | flat | จัดกลุ่ม 6 หมวด | flat 24 | namespace `ecc:*` + sub-plugins | 1 core + 7 refs + 24 cmd (4 หมวด) | flat 13 |
| **Multi-runtime** | ✓ (Cursor/Codex...) | **✓✓ 14 install targets** *(13 harness families; นับ Codex App/CLI แยก — documented 08-15)* | ✓ (`skills.sh`) | ✓ (Gemini/opencode) | **✓✓ หลาย harness แต่ capability ต่างกันมาก** (stable / native plugin / beta / experimental — ดู §12.1.1) | ✓✓ (10 providers) | ✓ (Claude/Codex/Cursor + `gpt-taste`) |
| **ติดตั้ง** | copy 1 ไฟล์ / plugin / `npx skills add` | **marketplace `obra/superpowers-marketplace` → `plugin install superpowers`** / `npx skills add` | `npx skills add` / copy | marketplace plugin / `npx skills add` | marketplace plugin / `npx skills add` | `npx skills add` / **MCP server** / **VS Code ext** | `npx skills add` / plugin |
| **Namespace** | ไม่มี | `superpowers:*` | ไม่มี (personal) | (plugin) `agent-skills` | `ecc:*` | commands `/diagnose`,`/fortify`... | ไม่มี (⚠️ ชื่อ frontmatter ≠ ชื่อโฟลเดอร์) |
| **License** | — | **MIT ✓** | — | — | **MIT ✓** | **MIT ✓** | **MIT ✓** |
| **Maturity** *(verify 2026-08-15)* | อิงทวีต | ⭐ **272,293** · pushed 08-13 | ต่อเนื่อง | ต่อเนื่อง | ⭐ **240,201** · pushed 08-15 | v2.0.0, 37 tests · ⭐ **412** · **pushed 04-29 (เงียบ ~3.5 เดือน)** | v2 (เก็บ v1) · ⭐ **76,663** · pushed 07-23 |

### ตาราง B — ปรัชญา & ตำแหน่ง (Positioning)

| มิติ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|------|----------|-------------|------------|------------|-----|---------|-------------|
| **แกน** | A | A | A | A | A (+แตะ B) | **B** | **A (vertical)** |
| **Altitude** | ล่างสุด (behavioral) | กระบวนการ | engineering tools | full-SDLC | สูงสุด (กว้าง) | คนละแกน (meta) | domain vertical (แคบ/ลึกสุดด้าน design) |
| **ปรัชญาแกน** | ลด LLM mistakes | วินัย skill-first | small/composable | production-grade | ครอบคลุม + เฉพาะทาง | structure>improvisation, measure don't assume | Design Read → 3 Dials, anti-default |
| **ความเข้มงวด** | แนะนำ (ใช้วิจารณญาณ) | **rigid** | flexible | flexible | varies | flexible + บังคับ context-gathering | pre-flight บังคับ แต่ contextual |
| **เป้าหมายผู้ใช้** | ทุกคน | engineer จริงจัง | engineer คุมกระบวนการ | ทีม production | องค์กร/หลาย domain | คนสร้าง/จูน AI agent workflow | คนสร้าง landing/portfolio |
| **bias** | caution > speed | discipline > speed | control > automation | completeness | coverage | reliability/measurement > speed | intentional design > speed |
| **meta-router** | ✗ | `using-superpowers` ✓✓ | `ask-matt` ✓ | `using-agent-skills` ✓ | `ecc-guide` ✓ | `agent-workflow` (auto-load) ✓✓ | ✗ (เลือก variant เอง) |

### ตาราง C — Capability Coverage Matrix: แกน A (SDLC)

> **หมายเหตุ:** maestro อยู่แกน B จึงเป็น `✗`/`△` เกือบทั้งแถวในตารางนี้ — ดูขีดความสามารถจริงใน **ตาราง F**
> **taste-skill / ui-skills / founder-skills / Infographic** เป็น vertical ที่ครอบเพียง 1–2 แถว — สรุปไว้ใน **ตาราง C-bis** ท้ายหมวดนี้ แทนการเพิ่มคอลัมน์ที่จะเป็น `✗` เกือบทั้งตาราง

#### Phase 0 — Foundational / Behavioral
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| กฎพฤติกรรมเขียนโค้ด (think/simple/surgical) | ✓✓ | ✗ | ✗ | ✗ | ✗ |
| Adversarial verification | ✗ | ✓ `verification-before-completion` | ✗ | ✓✓ `doubt-driven-development` | ✓ `council`,`verification-loop` |
| Source-grounding (docs-first) | ✗ | ✗ | ✗ | ✓✓ `source-driven-development` | ✓ `documentation-lookup`,`search-first` |

#### Phase 1 — Discovery (ideate → spec → plan)
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| Brainstorm / ideation | ✗ | ✓✓ `brainstorming` | △ | ✓ `idea-refine` | ✓ `council` |
| Requirements interview / grilling | ✗ | △ | ✓✓ `grilling`,`grill-with-docs` | ✓✓ `interview-me` | △ |
| Spec / PRD | ✗ | ✓ `writing-plans` | ✓ `to-prd` | ✓✓ `spec-driven-development` | ✓✓ `plan-prd`,`prp-prd`,`spec-miner` |
| Planning / task breakdown | ✗ | ✓✓ `writing-plans`,`executing-plans` | ✓ `to-issues`,`decision-mapping` | ✓✓ `planning-and-task-breakdown` | ✓✓ `plan`,`epic-decompose` |

#### Phase 2 — Build (TDD → implement)
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| TDD | ✓ (goal-driven) | ✓✓ `test-driven-development` | ✓✓ `tdd` | ✓✓ `test-driven-development` | ✓✓ `tdd-workflow` + lang tests |
| Implementation | ✗ | ✓ `subagent-driven-development` | ✓ `implement` | ✓✓ `incremental-implementation` | ✓✓ `prp-implement`,`multi-execute` |
| Prototype | ✗ | ✗ | ✓ `prototype` | ✗ | ✓ `ui-demo` |

#### Phase 3 — Quality (debug → review → secure)
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| Debugging | ✗ | ✓✓ `systematic-debugging` | ✓✓ `diagnosing-bugs` | ✓✓ `debugging-and-error-recovery` | ✓ `agent-introspection-debugging`,`build-fix` |
| Code review | ✗ | ✓✓ `requesting/receiving-code-review` | ✓ `review` | ✓✓ `code-review-and-quality` | ✓✓ `code-review`,`quality-gate` |
| Simplify / refactor | ✓ (simplicity-first) | ✗ | ✓ `improve-codebase-architecture` | ✓✓ `code-simplification` | ✓ `refactor-clean` |
| Security / hardening (โค้ดแอป) | ✗ | ✗ | ✗ | ✓✓ `security-and-hardening` | ✓✓ `security-review`,`security-scan`,`bounty-hunter` |

#### Phase 4 — Frontend / Performance / API
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| Frontend / UI | ✗ | ✗ | △ `prototype` | ✓✓ `frontend-ui-engineering` | ✓✓ `frontend-patterns`,`vue/react-patterns` |
| Performance | ✗ | ✗ | ✗ | ✓✓ `performance-optimization` | ✓✓ `latency-critical-systems`,perf agents |
| API / interface design | ✗ | ✗ | ✓ `codebase-design`,`design-an-interface` | ✓✓ `api-and-interface-design` | ✓ `api-design` |

#### Phase 5 — Ship (CI/CD → launch → observe → test)
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| CI/CD automation | ✗ | ✗ | ✓ `setup-pre-commit` | ✓✓ `ci-cd-and-automation` | ✓✓ `deployment-patterns`,`docker-patterns` |
| Shipping / launch | ✗ | ✓ `finishing-a-development-branch` | ✗ | ✓✓ `shipping-and-launch` | ✓ `promote`,`canary-watch` |
| **Observability / logging** | ✗ | ✗ | ✗ | ✓✓ `observability-and-instrumentation` | △ `production-audit`,`canary-watch` |
| Browser / E2E testing | ✗ | ✗ | ✗ | ✓✓ `browser-testing-with-devtools` | ✓✓ `browser-qa`,`e2e-testing` |

#### Cross-cutting (git · docs · context · orchestration · domain)
| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|
| Git workflow / guardrails | ✗ | ✓ `finishing-a-development-branch` | ✓✓ `git-guardrails-claude-code` | ✓ `git-workflow-and-versioning` | ✓ `git-workflow`,`github-ops` |
| Merge conflict resolution | ✗ | △ | ✓✓ `resolving-merge-conflicts` | ✗ | △ |
| Worktrees | ✗ | ✓✓ `using-git-worktrees` | ✗ | ✗ | △ |
| Documentation / ADR | ✗ | ✗ | ✓ `edit-article` | ✓✓ `documentation-and-adrs` | ✓✓ `update-docs`,`code-tour` |
| Context engineering / handoff | ✗ | △ | ✓✓ `handoff` | ✓✓ `context-engineering` | ✓✓ `save/resume-session`,`strategic-compact` |
| Orchestration / multi-agent | ✗ | ✓ `dispatching-parallel-agents`,`subagent-driven` | △ `loop-me` | ✗ | ✓✓ `multi-workflow`,`team-agent-orchestration` |
| Domain packs (healthcare/network/finance...) | ✗ | ✗ | ✗ | ✗ | ✓✓ มากมาย |
| Language/framework patterns | ✗ | ✗ | △ (TS) | ✗ | ✓✓ (py/go/rust/php/vue...) |
| Deprecation / migration | ✗ | ✗ | ✓ `migrate-to-shoehorn` | ✓✓ `deprecation-and-migration` | ✓ `legacy-modernizer` |

#### ตาราง C-bis — verticals ครอบแถวไหนของแกน A

| Vertical | แถวที่ครอบ | ระดับ | แถวอื่น |
|---|---|:---:|:---:|
| taste-skill | Phase 4 / Frontend-UI (เฉพาะ landing/portfolio/redesign) | ✓✓ ลึกสุดในทุกชุด | ✗ |
| ui-skills | Phase 4 / Frontend-UI (product UI) + a11y + motion performance | ✓✓ | ✗ |
| Infographic | Phase 4 / Frontend-UI (เฉพาะ structured infographic output) | ✓ | ✗ |
| founder-skills | **นอกแกน A ทั้งหมด** (business/GTM/pricing/SOP) | — | ✗ |
| reverse-skill | Phase 3 / Security (offensive+defensive, restricted) | ✓✓ (แต่ gated) | ✗ |

### ตาราง D — จุดแข็ง / จุดอ่อน / เหมาะกับใคร

| | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|--|----------|-------------|------------|------------|-----|---------|-------------|
| **จุดแข็ง** | leverage/token สูงสุด, orthogonal | วินัยแน่น, debugging+plans เยี่ยม | คิด/วางแผน, grilling, composable | ครบ SDLC เบาๆ, doubt+source-driven | กว้างสุด, domain+ภาษา, orchestration | agent-eng ครบ 7 มิติ + memory/audit/cost + MCP | design depth เชิงปฏิบัติ, style variants, imagegen→code |
| **จุดอ่อน** | แคบ (แค่พฤติกรรม) | ไม่มี domain/ภาษา | เอน TS, บาง skill in-progress | ทับ ecc เกือบหมด | ใหญ่จน routing สับสน | ไม่แตะ SDLC/ภาษา/domain; ต้อง `/teach-maestro` | ~87KB context หนักสุด; เฉพาะ marketing pages |
| **เหมาะกับ** | ทุกโปรเจกต์ | งาน eng จริงจัง | นัก eng คุมกระบวนการ + TS | ทีม production playbook | โปรเจกต์ใหญ่/หลายภาษา/domain | สร้าง LLM/agent app; จูน agent workflow | landing/portfolio/redesign |
| **ไม่เหมาะกับ** | (ใช้ได้หมด) | งานเล็ก/ad-hoc | ทีมอยาก automate มาก | ถ้ามี ecc แล้ว | โปรเจกต์เล็ก (overkill) | โปรเจกต์ที่ไม่ใช่ AI | dashboard/data-heavy/product UI; backend ล้วน |

### ตาราง E — ความทับซ้อนรายคู่

ย้ายไป **§15** (Pairwise Overlap) ซึ่งขยายครอบ verticals ใหม่และ choose-one groups ทั้งหมดแล้ว

### ตาราง F — Capability Matrix: แกน B (Agent-Workflow Engineering)

> วัดขีดความสามารถด้าน "วิศวกรรมเวิร์กโฟลว์ของ AI agent เอง" — แถวล่าง (memory/audit/cost/delivery) คือ **moat** ที่ maestro มีเด่นเดี่ยว · verticals ทั้ง 4 ตัวไม่แตะแกนนี้เลย (`✗` ทุกแถว) จึงไม่อยู่ในตาราง

| ความสามารถ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | ruflo | headroom |
|------------|:--------:|:-----------:|:----------:|:----------:|:---:|:-------:|:-----:|:--------:|
| Prompt engineering (structure/schema/few-shot) | ✗ | ✗ | ✗ | △ `context-engineering` | ✓ `prompt-optimizer` | ✓✓ core + `/refine` | ✓ | ✗ |
| Context-window management / budget | ✗ | △ | ✓ `handoff` | ✓✓ `context-engineering` | ✓ `context-budget`,`strategic-compact` | ✓✓ core + `/streamline` | ✓ | **✓✓ (runtime)** |
| Tool orchestration / design (MCP, schemas) | ✗ | △ `dispatching` | ✗ | △ | ✓ `mcp-server-patterns` | ✓✓ core + `/chain`,`/calibrate` | ✓✓ | △ |
| Agent architecture / multi-agent topology | ✗ | ✓ `subagent-driven`,`dispatching` | △ `loop-me` | ✗ | ✓✓ `team-agent-orchestration` | ✓✓ core + `/compose` | ✓✓ (swarm) | ✗ |
| Feedback loops / evaluation / regression | ✗ | ✓ `verification-before-completion` | ✗ | △ | ✓✓ `eval-harness`,`benchmark` | ✓✓ core + `/iterate` | ✓ | ✗ |
| Knowledge systems / RAG / grounding | ✗ | ✗ | ✗ | ✗ | ✓ `iterative-retrieval`,`rag` skills | ✓✓ core + `/enrich` | ✓ | ✓ (chunk compression) |
| Guardrails: injection / cost ceiling / validation | ✗ | ✗ | ✗ | △ (app-level) | ✓ `safety-guard`,`gateguard`,`cost-*` | ✓✓ core + `/guard`,`/fortify` | ✓ | △ (cost ทางอ้อม) |
| **Workflow "slop" linter (symptom→fix)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ `/diagnose` (5-dim scored) | △ | ✗ |
| **Persistent memory + decision log** | ✗ | ✗ | △ `handoff` | ✗ | △ `save/resume-session` | ✓✓ `.maestro/` (decisions.jsonl) | ✓ | ✗ |
| **Audit trail + per-command cost** | ✗ | ✗ | ✗ | ✗ | △ `cost-tracking` | ✓✓ `audit.jsonl` + estimator | ✓ | △ (วัด token ที่ลดได้) |
| **Effectiveness scorecard** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ `/reflect` | ✗ | ✗ |
| **Delivery เป็น live MCP server** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ `maestro-workflow-mcp` (10 tools) | ✓✓ | ✓✓ |

**วิธีอ่าน:** ในแกน B ตัวที่ใกล้เคียง maestro สุดคือ **ruflo** (platform เต็มรูปแบบ — จึงเป็น choose-one) และ **ecc** (agent-eng กระจัดกระจาย ไม่มี memory/audit/cost/scorecard layer) · **headroom** เด่นแถวเดียวแต่เป็นแถวที่ไม่มีใครทำได้จริงตอน runtime — จึงใช้ *คู่* กับ maestro ไม่ใช่แทน

**วิธีอ่านตาราง C/F:** (1) แถวที่มี `✗` ทั้งแถวในตาราง C = capability ที่ไม่มีชุดไหนครอบ ต้องหาเพิ่มเอง · (2) แถวที่ `✓✓` กระจุกที่ ecc ตัวเดียว = moat ของแกน A (domain packs, language patterns) · (3) แถว **Observability/logging** มีแค่ addyosmani ที่ `✓✓` · (4) 5 แถวล่างของตาราง F = moat ของ maestro บนแกน B

---

## 20. แหล่งอ้างอิง

### Core collections

- karpathy — <https://github.com/multica-ai/andrej-karpathy-skills>
- superpowers — <https://github.com/obra/superpowers> · marketplace: `obra/superpowers-marketplace`
- mattpocock — <https://github.com/mattpocock/skills>
- addyosmani — <https://github.com/addyosmani/agent-skills>
- ecc — <https://github.com/affaan-m/ECC> (namespace `ecc:*`)
- maestro — <https://github.com/sharpdeveye/maestro> · MCP: `maestro-workflow-mcp` · VS Code: `sharpdeveye.maestro-workflow`
- taste-skill — <https://github.com/Leonxlnx/taste-skill> · เว็บ: <https://tasteskill.dev>

### New collections, packs and candidates

- <https://github.com/ognjengt/founder-skills>
- <https://github.com/ibelick/ui-skills>
- <https://github.com/antvis/Infographic>
- <https://github.com/zhaoxuya520/reverse-skill>
- <https://github.com/ruvnet/ruflo>
- <https://github.com/zebbern/claude-code-guide>
- <https://github.com/Egonex-AI/Understand-Anything>
- <https://github.com/NanoNets/Graft>
- <https://github.com/Graphify-Labs/graphify>
- <https://github.com/openai/codex-security>
- <https://github.com/triggerdotdev/trigger.dev>
- <https://github.com/Nutlope/hallmark>
- <https://github.com/severity1/claude-code-prompt-improver>
- <https://github.com/lst97/claude-code-sub-agents>
- <https://github.com/notlikeDev/CCPlugins>

### Infrastructure and tools

- <https://github.com/midudev/autoskills>
- <https://github.com/iflytek/skillhub>
- <https://github.com/headroomlabs-ai/headroom>
- <https://github.com/marc-shade/world-intel-mcp>
- <https://github.com/TencentCloud/TencentDB-Agent-Memory>
- <https://github.com/zilliztech/claude-context>
- <https://github.com/MarkPDFdown/markpdfdown>
- <https://github.com/morphik-org/morphik-core>
- <https://github.com/Zipstack/unstract>
- <https://github.com/icereed/paperless-gpt>
- <https://github.com/rahulnyk/knowledge_graph>
- <https://github.com/punnerud/Local_Knowledge_Graph>
- <https://github.com/pranshuparmar/witr>
- <https://github.com/scrapy/scrapy>
- <https://github.com/danish296/codevibes>
- <https://github.com/microsoft/promptflow>
- <https://github.com/TEN-framework/ten-framework>
- <https://github.com/vstorm-co/full-stack-ai-agent-template>
- <https://github.com/OpenAgentPlatform/Dive>
- <https://github.com/insaaniManav/prompt-forge>

### References (ไม่ติดตั้ง)

- <https://github.com/asgeirtj/system_prompts_leaks> — คลัง system prompt จาก vendor (ศึกษา prompt engineering)

---

## 21. Repositories ที่ประเมินแล้วแต่ไม่เข้าเกณฑ์ Collection

| Repository | ประเภทจริง | เหตุผลที่ไม่เป็น collection |
|---|---|---|
| `rahulnyk/knowledge_graph` | Notebook/Python pipeline | ไม่มี installable Agent Skills |
| `marc-shade/world-intel-mcp` | MCP server | เพิ่ม tools ไม่ได้เพิ่ม skill behavior content |
| `danish296/codevibes` | Full-stack application | เป็น external evaluator |
| `TencentDB-Agent-Memory` | Memory service/framework | setup adapter ไม่ทำให้ทั้ง repo เป็น collection |
| `full-stack-ai-agent-template` | Generator/template | เป็น application scaffold |
| `MarkPDFdown` | CLI/API tool | ต้องสร้าง wrapper skill แยก |
| `autoskills` | Installer/registry client | จัดการ skills แต่ไม่ใช่ content collection |
| `Local_Knowledge_Graph` | Python/Ollama framework | ไม่มี standard Agent Skills และมี custom license |
| `claude-code-sub-agents` | Agent definitions | ไม่มี standard `SKILL.md` collection |
| `Dive` | Desktop MCP host | เป็น runtime/delivery platform |
| `claude-context` | Semantic-search MCP | เป็น retrieval service |
| `prompt-forge` | Prompt workbench | เป็น QA application |
| `CCPlugins` | Slash-command pack | ไม่ใช่ standard Agent Skills |
| `Witr` | Diagnostic CLI | เป็น executable dependency |
| `Morphik Core` | Retrieval platform | เป็น service/framework |
| `Scrapy` | Crawling framework | เป็น code library/framework |
| `Promptflow` | LLM workflow framework | เป็น flow/evaluation platform |
| `TEN Framework` | Realtime agent framework | เป็น domain runtime |
| `paperless-gpt` | Document application | ผูกกับ paperless-ngx |
| `Unstract` | Document extraction platform | เป็น service/MCP/framework |
| `SkillHub` | Registry/governance platform | เป็น infrastructure ไม่ใช่ content |
| **`headroomlabs-ai/headroom`** *(ประเมิน 2026-07-12)* | Runtime context compression (lib/proxy/MCP/hooks, Apache-2.0) | ไม่มี `SKILL.md` เลย — **แต่ใช้เป็นเครื่องมือเสริมแกน B ได้** ดู §9 · ติดตั้งเป็น tool ไม่ใช่ skill |
| **`asgeirtj/system_prompts_leaks`** *(ประเมิน 2026-07-12)* | คลัง system prompt จาก vendor (CC0) | เป็น reference ให้มนุษย์ศึกษา ไม่ใช่ skill ที่เปลี่ยนพฤติกรรม agent · ส่วนที่หน้าตาเป็น skill (`bundled-skills/`) **ติดมากับ Claude Code อยู่แล้ว 100%** — เพิ่มไปก็ซ้ำ · เป็น proprietary prompt ที่หลุดมา ไม่เหมาะ copy ไปใช้จริง |

**เกณฑ์ที่ใช้ตัดสิน:** skill collection ต้อง "ติดตั้งแล้วเปลี่ยนพฤติกรรม agent ได้" (มี `SKILL.md` + frontmatter `name`/`description` ให้ router เลือกโหลด) — passive reference ไม่นับ

---

## 22. Change Log

### 2026-08-15 (รอบ verify-7 — แก้ตาม review portability และ evidence taxonomy)

- ลดถ้อยคำจาก “อ่าน `SKILL.md` แล้วใช้ collection ใดก็ได้ทันที” เป็น **structural candidate สำหรับ pilot** และกำหนดให้ตรวจ frontmatter, tool names, scripts/dependencies, paths, permissions และ smoke test ราย collection
- แก้ Freebuff จาก `✗` เป็น `?` ตาม legend เพราะหลักฐานเป็นเพียง “ยังไม่พบการยืนยันใน repo/docs ที่ตรวจ” ไม่ใช่ upstream ประกาศว่าไม่รองรับ
- แยก **Qoder/Mistral Vibe = native** ออกจาก **DeepSeek Harness = compatible** ให้ Change Log ตรงกับตารางหลัก และระบุ `dsh` เป็น command-line launcher/runtime
- ติดป้าย `agentskill.sh/vibe` เป็น community source, ถอน comparative superlative ของ Mistral Vibe และเลิกใช้จำนวนบรรทัด README เป็นหลักฐานที่เปลี่ยนง่าย

### 2026-08-15 (รอบ verify-6 — เพิ่มมุมมอง "harness ฝั่งผู้บริโภค skills")

ที่มา: ผู้ใช้ทักรายชื่อ grok · qoder · deepseek harness · mistral vibe · ollama · factory · freebuff — การตรวจ upstream พบผลแบบผสม: บางรายการรองรับ Agent Skills, บางรายการมีอยู่แล้วแต่หัวเอกสารตกหล่น, บางรายการใช้คนละ spec หรืออยู่คนละชั้น และ Freebuff ยังไม่มีหลักฐานยืนยันการรองรับ `SKILL.md` โดยตรง

- **ช่องว่างที่พบ:** §12.1–12.3 ตอบเฉพาะ *"upstream repo ประกาศรองรับ harness ไหน"* แต่ยังขาดมุมมองฝั่ง harness ที่อ่าน `SKILL.md` ได้เอง → เพิ่ม **§12.4 Harness ที่อ่าน SKILL.md ได้เอง** พร้อมระบุว่าความเข้ากันได้เชิงโครงสร้างไม่ใช่หลักฐานว่า runtime ใช้งานได้ครบ
- **ตรวจแล้วรองรับ native:** **Qoder** (IDE+CLI, `SKILL.md` + auxiliary files) · **Mistral Vibe** (Apache-2.0, `SkillManager` crawl หา `SKILL.md`, ครบทั้ง MCP/hooks/permissions)
- **ตรวจแล้ว compatible:** **DeepSeek Harness** (plugin-based, repo ใช้ `SKILL.md` ผ่าน `.agents/skills/`; developer preview)
- **ตรวจแล้วมีอยู่ในเอกสารแต่หัวเอกสารตกหล่น:** **Grok Build CLI** (`grok plugin install superpowers@xai-official --trust`) และ **Factory Droid** (`droid plugin install superpowers@superpowers`) — อยู่ในตาราง §12.1 มาตลอดแต่ไม่มีในรายการแพลตฟอร์มเป้าหมายบรรทัดแรก
- **ตรวจแล้วรองรับ skills แต่คนละ spec:** **MiMo CLI** (Xiaomi, [KoinaAI/MiMo-CLI](https://github.com/KoinaAI/MiMo-CLI)) — มี skills + hooks + MCP + subagents ครบ แต่ใช้ **flat `*.md` + `triggers` keyword** ใน `.mimo/skills/` แทน *โฟลเดอร์ + `SKILL.md` + description routing* → **ไม่ใช่ drop-in ต้องแปลงรูปแบบก่อน** · เพิ่มบทเรียนลง §12.4: เกณฑ์ที่ต้องถามคือ *"อ่านไฟล์รูปแบบไหน route ด้วยอะไร"* ไม่ใช่แค่ *"มีระบบ skills ไหม"*
- **ยังไม่ยืนยัน:** **Freebuff** — จาก repo/docs ที่ตรวจ ณ 2026-08-15 ยังไม่พบหลักฐานยืนยัน `SKILL.md` โดยตรง; กลไกที่พบใช้ `AGENTS.md` + `@codebuff/sdk`
- **ตรวจแล้วเป็นคนละชั้น:** **Ollama** = model runner ไม่ใช่ agent harness — ไม่มี skill router ของตัวเอง แต่เป็น backend ให้ harness ที่อ่าน `SKILL.md` ได้
- **แก้หัวเอกสาร** — รายการแพลตฟอร์มเป้าหมายเดิม (Claude Code · Codex · Cursor · Cline · Zcode · OpenCode · Kilo · Qwen · Kimi · Antigravity) ล้าสมัยและไม่ตรงกับตาราง §12.1 → เพิ่ม Gemini CLI · Copilot CLI · Grok · Factory Droid · Devin · Pi · Hermes · Zed · Qoder · Mistral Vibe · DeepSeek Harness
- **ปิดงานค้างเรื่อง superpowers:** ตรวจ README upstream snapshot ณ 2026-08-15 แล้วพบ **14 install targets** และรายชื่อตรงกับตาราง §12.1 ทุกตัว; จำนวนบรรทัดไม่ใช้เป็นหลักฐานเพราะเปลี่ยนตาม commit

### 2026-08-15 (รอบ verify-5 — แยก native Codex plugin payload ออกจาก legacy sync)

อ้างอิง: Codex review หลังรอบ verify-4 + `.codex-plugin/README.md` ของ ECC — แก้โดยตรงตามคำสั่งผู้ใช้

- **แก้ Medium — native plugin ผสมข้อมูล legacy sync:** ย้ายตัวเลข `skills 32 · MCP 6 · agent roles 3 · profiles 2` กลับไปอยู่แถว deprecated sync และแก้ native plugin เป็น **281 skills · 1 default MCP (Chrome DevTools) · Codex lifecycle-hook projection · scripts/assets** ตาม `.codex-plugin/README.md`
- **แก้ Medium — hook semantics ข้าม path:** upstream `.codex-plugin/README.md` รายงานว่า native plugin มี provider-specific hook subset โดย synchronous `SessionStart` ผ่านการ verify กับ Codex 0.146 และต้อง trust ผ่าน `/hooks`; handlers ที่ block tools/async/unsupported protocol ไม่ถูก bundle · legacy sync จึงเป็น path ที่ instruction/config-based และไม่มี native-plugin hook runtime
- **แก้ Low — source declaration:** §12.1.1 ระบุว่าเป็นการสังเคราะห์จาก install section, platform matrix, support-in-depth และ `.codex-plugin/README.md` ไม่เรียก matrix เดียวว่า canonical สำหรับ Codex
- **แก้ Low — Superpowers count:** เปลี่ยนคำเรียกจำนวนแพลตฟอร์มแบบเดิมเป็น **14 install targets (13 harness families; นับ Codex App และ CLI แยก)** และแจกแจง Codex App/CLI แยกในตาราง
- **เก็บ consistency เพิ่มเติม:** นิยาม `—` ว่าไม่เกี่ยวข้อง, แกน Commands ของ Superpowers เป็น `✗` เพราะใช้ skills เป็น entrypoint และแยก Cursor เป็น project adapter ไม่ใช่ plugin
- คงสถานะ **documented ไม่ใช่ runtime-tested โดยผู้จัดทำ catalog** สำหรับ positive capability claims ที่อัปเดตในรอบ verify-5; ช่อง `?` และข้อความ “ยังไม่ยืนยัน” ยังคงเป็น unknown/unconfirmed ตามนิยาม §12.1

**ตรวจทานเอกสารรอบ verify-5 (Claude Code; read-only, ไม่ได้ runtime-test):** เทียบตัวเลขกับ `.codex-plugin/README.md` ต้นฉบับแล้ว — upstream ระบุ **281 skills · 1 default MCP (Chrome DevTools) · lifecycle-hook projection · `SessionStart` verified บน Codex 0.146 · trust ผ่าน `/hooks` · handlers ที่ block tools/async/ผิด protocol ถูกตัดออก** และการย้าย `skills 32 · MCP 6 · roles 3 · profiles 2` กลับไป sync path ตรงกับ README หลัก (ส่วน `Codex macOS app + CLI support in depth` ซึ่งอธิบาย repo/sync path) · MCP 6 ตัวดังกล่าวเป็น **former native-plugin defaults** ที่ถูก retire ใน connector audit มิ.ย. 2026 และเหลือเป็น opt-in สำหรับ native plugin แต่ยังคงอยู่ใน legacy sync path
แก้เพิ่มหลังตรวจ: อ้างชื่อ section ให้ตรงต้นฉบับ (`Codex macOS app + CLI support in depth`) · heading §12.1.1 ระบุ `.codex-plugin/README.md` เป็นแหล่งด้วย · เติม caveat matrix-ล้าหลังในบรรทัด parity · ใส่ `(13 harness families)` ในตารางให้ตรงกับที่ change log อ้าง
**รอบตรวจถัดมา:** ยืนยัน 4 การแก้ของ Codex (นิยาม documented แยก positive claims ออกจาก `?` · qualifier `read-only` ของ paragraph ตรวจทาน · ความกำกวมของ MCP 6 → *former native-plugin defaults ที่ยังอยู่ใน legacy sync* · §12.3 เพิ่มบล็อก Codex สอง path) — **ถูกต้องทั้งหมด** · แก้ legend ต่อให้เป็น taxonomy ที่ไม่ปะปนสถานะ: **Documented** (`✓✓` = broad/multi-component, `✓` = limited/specific, `△`, `✗`) · **Unknown** (`?`) · **Not applicable** (`—`) และแยก `T` เป็น evidence marker สำหรับ runtime test

### 2026-08-15 (รอบ verify-4 — แยก capability ตาม distribution path + นิยามสัญลักษณ์)

อ้างอิง: `skill-collections-codex-followup-review-3-20260815.md` — **ทั้ง 2 Medium + 2 Low ถูกต้อง** ตรวจ README ต้นฉบับยืนยันแล้ว

- **แก้ Medium 1 — การเหมารวม Codex hook capability:** README มีหัวข้อ `Codex App and CLI` ระบุว่า native repo-marketplace plugin ส่ง *"skills, MCP configuration, **hook runtime**, scripts, and assets"* และ *"native hooks require an **explicit trust decision**"* → **แยกแถว Codex เป็น 2 distribution paths** (native marketplace plugin = ทางหลักปัจจุบัน / sync = **deprecated** ตามที่ upstream ระบุเอง) ทั้งใน §12.1, §12.1.1 และ §12.3
- **บันทึกความไม่สอดคล้องของ upstream** เป็นตารางเปรียบเทียบ 4 แหล่งใน §12.1.1: `Codex App and CLI` (มี hook runtime) ↔ `Platform Support` matrix (No ECC hook runtime) ↔ `Cross-tool capability map` (Not supported) ↔ `Key limitation` (*"not yet provide Claude-style hook execution parity — enforcement is instruction-based via AGENTS.md"*) · รอบ verify-4 เคยนำ `Key limitation` ของ repo/sync section ไปอธิบาย native plugin กว้างเกินไป; **แก้การตีความและ payload counts แล้วใน verify-5**
- **แก้ Medium 2 — ตาราง A ตกค้าง:** เปลี่ยนการนับ native tier แบบเดิมเป็น `หลาย harness แต่ capability ต่างกันมาก (stable / native plugin / beta / experimental)` — เลิกนับ `native N` จนกว่าเกณฑ์จะนิ่ง
- **แก้ Low 1 — ตัวเลข hook events สามนิยาม:** เพิ่ม qualifier ว่า **20** = event types ที่ Cursor platform เปิดให้ · **15** = ที่ ECC adapter รองรับ · **8** = ของ Claude Code ที่ใช้เทียบ
- **แก้ Low 2 — นิยามสัญลักษณ์:** ประกาศนิยามชัดที่หัวตาราง §12.1 — `✓✓`/`✓` = documented · `△` = documented + มีข้อจำกัด · `?` = unknown · `✗` = documented ว่าไม่มี · **`T` = runtime-tested โดยเรา (ยังไม่มีช่องใดเป็น `T`)** และเปลี่ยนช่องของ `ui-skills` ที่ยังไม่ได้ตรวจเป็น `?`

### 2026-08-15 (รอบ verify-3 — ยกเครื่องตาราง ECC portability จาก README ต้นฉบับ)

อ้างอิง: `skill-collections-codex-followup-review-2-20260815.md` — finding เรื่อง Cursor **ถูกต้อง** และการตรวจ README ต้นฉบับ (2,117 บรรทัด) เพื่อยืนยัน ทำให้พบข้อผิดพลาดเพิ่มอีก 2 จุดที่ review ไม่ได้ชี้

- **แก้ finding (Medium) — Cursor ถูกจัดผิดเป็น minimal adapter:** README มีหัวข้อ `Cursor IDE support in depth` ระบุ **15 hook events · 16 hook scripts · 34 rules · 48 agents · skills · commands · MCP config** ผ่าน `.cursor/hooks/adapter.js` — *(ตัวเลข hook มีสามนิยาม อย่าสับสน: **20** = event types ที่ Cursor platform เปิดให้ · **15** = จำนวนที่ ECC adapter รองรับ · **8** = event types ของ Claude Code ที่ upstream ใช้เทียบ)* · สาเหตุที่ผิดคือนำคำว่า `--profile minimal` จาก quick-install entry ไปตีความเป็น *เพดานความสามารถของแพลตฟอร์ม* ทั้งที่เป็น **ตัวเลือกตอนติดตั้ง**
- **แต่ไม่รับข้อเสนอให้จัดเป็น "Full adapter" ตรง ๆ** — `Platform Support` matrix ของ upstream ระบุ Cursor = **"Beta project adapter"** พร้อมข้อจำกัด *"installer paths do not yet expose identical hook sets"* ([#2419](https://github.com/affaan-m/ECC/issues/2419)) และ parity = **Partial** · จัดเป็น "Beta project adapter" พร้อมแสดงทั้ง capability และ limitation จึงตรงหลักฐานกว่าทั้งสองทาง
- **พบเพิ่มเอง #1 — Codex hooks:** ตารางรอบก่อนเขียนว่า Codex ได้ `skills · agents · hooks` ขณะที่ `Platform Support` matrix ระบุ **"No ECC hook runtime"** → แก้เป็นฝั่ง matrix ในรอบนั้น **แต่ยังเหมารวมเกินไป — แก้ต่อในรอบ verify-4 ให้แยกตาม distribution path**
- **พบเพิ่มเอง #2 — Kimi ไม่ใช่ native:** รอบก่อนจัด Kimi Code เป็น Native tier แต่ `Platform Support` matrix จัดอยู่กลุ่ม **Experimental/minimal adapters** ร่วมกับ Gemini/Zed/Antigravity/Qwen/Hermes/OpenClaw/CodeBuddy/JoyCode → แก้แล้ว
- **เปลี่ยนแหล่งอ้างอิงของตาราง §12.1.1** จาก summary ของ README เป็น **`Platform Support` + `Cross-tool capability map` ต้นฉบับ** ซึ่ง upstream ระบุเองว่าเป็น canonical — เพิ่มคอลัมน์ "ข้อจำกัดที่ upstream ระบุเอง" และ issue number อ้างอิง
- คงสถานะ **documented ไม่ใช่ tested** ตามเดิม

### 2026-08-15 (รอบ verify-2 — แก้ตาม Codex follow-up review)

อ้างอิง: `skill-collections-codex-followup-review-20260815.md` — ตรวจกับ upstream แล้วพบว่า **ทั้ง 3 findings + change-log claim ถูกต้อง**

- **แก้ Finding 1 (Medium) — ECC platform list ไม่ครบ:** ตรวจ README ซ้ำพบ target ที่ตกหล่นจริง — **Antigravity · CodeBuddy · JoyCode** (และมี `.trae/` `.kiro/` `.pi/` ใน repo ที่ยังไม่มี guide) → **ถอดตัวเลข "11 platforms" ออกทั้งเอกสาร** และเปลี่ยน §12.1.1 เป็นตารางแบ่งตาม *ระดับ* (Native / Full build / Minimal adapter / Managed / Config files / Directory only) เพราะเกณฑ์นับไม่นิ่งพอจะอ้างเป็นตัวเลขเดียว
- **แก้ Finding 2 (Medium) — ข้อสรุปรวม superpowers กับ ECC:** §12.3 เดิมวางบล็อก capability ของ ECC ไว้ใต้ประโยคที่พูดถึงทั้งสองตัว ทำให้อ่านเหมือน superpowers มี hook parity เท่ากัน → **แยกเป็นสองบล็อกชัดเจน** โดยฝั่ง superpowers ระบุตรงว่า hook parity ยืนยันเฉพาะ Antigravity และ Hermes ไม่มี post-compaction hook
- **แก้ "ติดตั้งครั้งเดียวใช้ได้ทุกที่"** → "ใช้เนื้อหาชุดเดียวกันข้ามแพลตฟอร์มได้ แต่ต้องติดตั้ง/ตรวจ integration แยกต่อ harness"
- **แก้ Finding 3 (Low):** "เพิ่มได้โดยไม่ชน" ในตาราง Pairwise Overlap แถวสุดท้าย — รอบก่อนแก้ไม่ครบ เหลือตกค้าง 1 จุด
- **แก้ change-log claim:** entry รอบก่อนอ้างว่า "เปลี่ยนเป็น Markdown anchor" ซึ่งไม่ตรงกับไฟล์จริง (anchor ถูกตัดออกภายหลังตอนทำ standalone portability) → แก้ให้ตรงกับสิ่งที่ทำจริง
- เพิ่มการแยก **documented vs tested** ในตาราง portability ตามข้อเสนอ P2 ของ review

### 2026-08-15 (รอบ verify — ตรวจ repo จริง + แก้ตาม Codex review)

อ้างอิง review: `skill-collections-claude-code-review-20260815.md` (Codex, อยู่ในโฟลเดอร์ต้นทาง) — ตรวจสอบแล้วพบว่า **ทั้ง 5 findings ถูกต้อง**

- **แก้ Finding 2 (Medium) — portability ล้าสมัย:** ตรวจ repo จริงพบว่า superpowers รองรับ **14 install targets (13 harness families; นับ Codex App/CLI แยก)** (มี `.codex-plugin`, `.cursor-plugin`, `.devin-plugin`, `.hermes-plugin`, `.kimi-plugin`, `.opencode`, `.pi`, `GEMINI.md`) และ ECC รองรับหลายแพลตฟอร์มพร้อมระดับ capability ต่างกัน → เขียน §12.1 ใหม่ **แยก 4 แกน (Content/Plugin/Hooks/Commands)** แทน verdict เหมารวม + เพิ่มตารางย่อย §12.1.1 ระดับ capability ของ ECC ต่อแพลตฟอร์ม + แก้ข้อสรุป §12.3 ที่เคยระบุว่า "ให้คุณค่าเต็มเฉพาะ Claude Code"
  *(รอบนี้เคยระบุจำนวน ECC เป็น "11 platforms" ซึ่งนับไม่ครบ — แก้แล้วในรอบ verify-2 ด้านบน)*
- **แก้ Finding 3 (Low):** cross-reference `§21 Change Log` → **`§22`** (ภายหลังตัด Markdown anchor ออกเป็น plain text ตอนทำ standalone portability — ดู entry ถัดไป)
- **แก้ Finding 4 (Low):** แยก TL;DR เป็น **Hybrid integrations** (Graphify/Graft/Understand-Anything — มี skill adapter จริง) ออกจาก **Pure tool/MCP companions**
- **แก้ Finding 5 (Low):** "ชุดคนละแกนใส่พร้อมกันได้เสมอ" → คำแนะนำแบบมีเงื่อนไข (ต้องตรวจ routing/context/hooks/instructions ก่อน)
- **verify ตัวเลขจริงจาก GitHub API** (§3.0): superpowers **272,293** · ECC **240,201** · taste-skill **76,663** — เลขเดิมต่ำกว่าจริงทั้งหมด (ไม่ใช่สูงเกินอย่างที่เคยตั้งข้อสงสัย) · license ของ 10 repo **MIT ทั้งหมด**
- **เพิ่มข้อสังเกตที่กระทบการเลือก stack:** maestro ⭐412 · pushed 2026-04-29 (เงียบ ~3.5 เดือน) vs ruflo ⭐67,888 · pushed 2026-08-15 → maintenance cadence ควรเข้าไปอยู่ในการตัดสิน choose-one ของแกน B

*ไม่ได้แก้ตาม review:* Finding 1 (verdict count) อยู่ในไฟล์ `repo-analysis` — แก้แล้วที่นั่น (TOOL 17 / REFERENCE 6)

### 2026-08-15 (รอบ merge — กู้เนื้อหาที่ตกหล่นจาก 3 รุ่นก่อน)

พบว่าเนื้อหาถูกตัดหายสะสมข้ามรุ่น (`comparison 07-09` → `07-12` → `08-15`) โดยไม่ได้ย้ายไปที่ใด จึงกู้กลับทั้งหมด:

**กู้จากรุ่น 2026-07-09 (หายไปตั้งแต่รุ่น 07-12):**
- เจ้าของจริงของ superpowers (**obra / Jesse Vincent**) และ ecc (**affaan-m**) — เดิมถูกลดเป็น "community plugin" / "ECC framework"
- License **MIT** ของ superpowers/ecc และตัวเลข ⭐ ที่บันทึกไว้ (พร้อม flag ว่ายังไม่ verify — ดู §3.0)
- Marketplace path ของ superpowers (`obra/superpowers-marketplace` → `plugin install superpowers`)
- คำเตือน staleness ของตัวเลขที่หัวเอกสาร

**กู้จากรุ่น 2026-07-12 (หายไปในรุ่น 08-15 รอบแรก):**
- **กรอบ "2 แกน + verticals"** พร้อมผัง altitude (§1.1)
- **ตารางเปรียบเทียบหลัก** 7 core collections (§3.1)
- รายละเอียดโปรไฟล์ที่ถูกย่อจนเสียสาระ (§4): karpathy 4 หลักการ · superpowers รายชื่อ skill · mattpocock catalog 6 หมวด · addyosmani catalog 24 ตัว · ecc รายชื่อ agent-eng skill · maestro 7 reference files + 24 commands + moat 6 ข้อ + ปรัชญา 5 ข้อ · taste-skill โครงสร้าง 13 skills + 3 Dials + ⚠️ naming mismatch + ผล vet
- **§12 การใช้ข้ามแพลตฟอร์ม** — ตาราง Portability + taste-skill platform mapping + ข้อสรุปเรื่อง prune ต่อแพลตฟอร์ม (สำคัญมาก เพราะเอกสารประกาศตัวเป็น cross-platform แต่ไม่มีข้อมูลนี้เลย)
- **§15 Pairwise Overlap** (เดิมมีแค่ collision rules เชิงเลือก)
- **§19 ภาคผนวก A–F** capability matrix ทั้งหมด
- **สรุป 1 บรรทัด/ชุด** (§18)
- `headroom` + `system_prompts_leaks` ในหมวดประเมินแล้วไม่เข้าเกณฑ์ (§21) — กันประเมินซ้ำ

**เพิ่มใหม่ในรอบนี้:**
- §3.0 ตารางความน่าเชื่อถือของตัวเลขแยกตามวันตรวจ
- §3.2 ตารางเปรียบเทียบ 4 verticals ใหม่แบบ side-by-side
- ขยาย §12 Portability ให้ครอบ verticals/hybrid ใหม่ทั้งหมด
- ขยาย §15 ให้ครอบคู่ใหม่: maestro↔ruflo (สูง) · taste-skill↔Hallmark (สูงมาก) · taste-skill↔ui-skills (สูง คนละ surface) · maestro↔headroom (เสริมกัน) · Graphify↔Graft↔Understand-Anything (สูงมากทั้งสามคู่)
- เพิ่ม **ตาราง C-bis** — verticals ครอบแถวไหนของแกน A (แทนการเพิ่มคอลัมน์ที่จะเป็น `✗` เกือบทั้งตาราง)
- ขยาย **ตาราง F** เพิ่มคอลัมน์ `ruflo` และ `headroom`
- เพิ่ม `headroom` เข้า §9 companions และ §18 catalog status

### 2026-08-15 (รอบแรก)

- สร้างเอกสารใหม่จาก `skill-collections-20260712.md`
- คง 7 collections เดิมและจัด layer ใหม่ให้ชัดเจน
- เพิ่ม `founder-skills`, `ui-skills`, AntV `Infographic` และ restricted `reverse-skill`
- เพิ่ม hybrid/product-specific packs: Ruflo, claude-code-guide, Understand-Anything, Codex Security และ Trigger.dev
- เพิ่ม single-skill alternatives: Hallmark, prompt-improver, Graphify และ Graft
- เพิ่ม infrastructure: autoskills และ SkillHub
- เพิ่ม MCP/memory/context/document/engineering companions
- เพิ่ม choose-one rules, collision rules, security gates และ acceptance checklist
- แยก repositories ที่ใช้เป็นเครื่องมือได้แต่ไม่เข้าเกณฑ์ collection
