# Session Summary — อบต.หัวงัว Citizen Help / Traffy-style Web App

> Snapshot สถานะทุก task (DONE + PENDING) พร้อมชื่อ agent ผู้ทำ + timestamp
> สร้างเพื่อ recovery หลัง auto-compact — ต่อเนื่องจาก snapshot 04:41 และ 09:23

| ฟิลด์ | ค่า |
|------|-----|
| **Agent (main)** | Claude Code (Anthropic CLI) — main orchestrator |
| **Model** | `glm-5.2:cloud` ผ่าน Ollama proxy `http://localhost:11434` (effort xhigh baseline; `effort:'high'` สำหรับ fan-out agents) |
| **Output style** | learning / explanatory (มี `★ Insight` blocks) |
| **Generated at** | **2026-06-28 15:05:32 ICT (+07:00)** |
| **Session ID** | 02056b3d-ab21-4e58-870c-8a85dac6d90d (current); prior: 9bcaea06-37d4-41e8-9b81-d31bbf0c5170 |
| **Working dir** | `D:\toppublic\per` (greenfield — ยังไม่มี `package.json`) |
| **Log type** | Full session checkpoint — DONE + PENDING tasks (พร้อม agent + timestamp) |
| **Phase** | Brainstorming — **HARD-GATE ยังไม่ผ่าน** (ห้าม scaffold/code) |
| **Prior summaries** | `session-summary-2026-06-28-0441.md`, `session-summary-2026-06-28-0923.md` |
| **Context package (source-of-truth)** | `D:\toppublic\per\docs\context-package.md` (189 บรรทัด) |
| **Cost flag** | session total ~$22+ (PostToolUse informational warning) |

> ⚠️ **Security:** `ANTHROPIC_AUTH_TOKEN` เป็น plaintext ใน `.claude\settings.local.json` (ค่าจริง = `<REDACTED>` รูปแบบ `<32-hex>.<base64>` — **ห้าม echo ค่าจริงใน output ใดๆ**) ไฟล์นี้ + `secrets\` ต้องอยู่ใน `.gitignore` เสมอเมื่อ git init

---

## 1. บริบทโปรเจกต์ (สั้น)

ออกแบบเว็บแอปสำหรับ **องค์การบริหารส่วนตำบลหัวงัว** (อ.ยางตลาด จ.กาฬสินธุ์) จัดการงาน **สรุปผลการช่วยเหลือประชาชน / ร้องเรียก ร้องทุกข์** อิงจาก `.docx` 2 ไฟล์ → ระบบ citizen-facing + admin full-stack ตามมาตรฐานราชการไทย (รหัส กก.ทร., บัตรประชาชน 13 หลัก, ปีงบพ.ศ., PDPA พ.ร.บ. 2562) เทียบเท่า Traffy Fondue แต่ท้องถิ่นจริง

---

## 2. Tasks — DONE (เสร็จแล้ว)

> ผู้ทำ = **Claude Code (main)** ทั้งหมด ยกเว้น fan-out workflow ระบุแยกใน §3

| ID | งาน | ผลลัพธ์ | ผู้ทำ | ~Timestamp |
|---|------|---------|------|------------|
| D1 | อ่าน + unpack docx 2 ไฟล์ (pandoc ไม่ได้ติดตั้ง → ใช้ Grep บน `unpacked*/word/document.xml`) | `unpacked1/`, `unpacked2/`, `_unp1/`, `_unp2/`; ดึง Thai text + ตารางจริง (เลขรับ 100/344/105/113/50/88/95/96) | Claude Code (main) | 2026-06-28 ~04:xx |
| D2 | ออกแบบ 6 ฟังก์ชัน + entity model + RBAC + state machine | รับเรื่อง→ตรวจสอบ→มอบหมาย→นัดเข้าพื้นที่→ดำเนินการ→เสร็จ→ปิดเรื่อง + สาขา รองบประมาณ/ส่งต่อภายนอก/ฉุกเฉิน | Claude Code (main) | ~04:xx |
| D3 | เสนอ 4 stack options + เปรียบเทียบ | ตารางเปรียบเทียบ | Claude Code (main) | ~04:xx |
| D4 | ออกแบบ DB ระดับชาติ (ที่อยู่ + หน่วยงาน + บุคลากร bitemporal) | รหัสกรมการปกครอง จว./อ./ต./ม. + กก.ทร. + บัตร 13 หลัก + เลขที่หนังสือรับ (natural key) | Claude Code (main) | ~04:xx |
| D5 | ศึกษา + เทียบฟีเจอร์ Traffy Fondue | 30 หมวด, LINE chatbot, AI classification, open data | Claude Code (main) | ~04:xx |
| D6 | เพิ่ม Live Chat หลังบ้าน + Telegram handoff | เจ้าหน้าที่รับเมื่อต้องการคนจริง | Claude Code (main) | ~04:xx |
| D7 | เพิ่ม LINE LIFF (citizen mini-app) | mini-app entry | Claude Code (main) | ~04:xx |
| D8 | ตรวจช่องว่าง 6 หมวด 34 ข้อ | completeness check | Claude Code (main) | ~04:xx |
| D9 | fan-out 4 agents brainstorm gap analysis + phasing | ขนาน + reviewer-critique | Claude Code (main) + sub-agents | ~04:xx |
| D10 | Synthesis phasing: P0/P0.5/P1/P2/P3 | go/no-go criteria + risk register | Claude Code (main) | ~04:xx |
| D11 | **PIVOT #1** remap architecture → Vercel + Supabase free | เปลี่ยนจาก self-host VPS | Claude Code (main) | ~04:xx |
| D12 | ถาม visual direction + milestone (AskUserQuestion) | ผู้ใช้เลือก **Radix + custom Tailwind** + **design system + Storybook ก่อน** (ปฏิเสธ Recommended ทั้ง 2) | Claude Code (main) + user | ~04:xx |
| D13 | **PIVOT #2** remap → Upstash Redis + QStash | แยก queue/cache/rate-limit ออกจาก DB | Claude Code (main) | ~04:xx |
| D14 | สำรวจ toolchain + dir | node v24.15.0, npm 11.14.0, pnpm 11.0.8, git 2.54.0; พบ `secrets\` (ห้ามแตะ) | Claude Code (main) | ~04:xx |
| D15 | สร้าง session log 0441 | `session-summary-2026-06-28-0441.md` | Claude Code (main) | 2026-06-28 04:41:17 |
| D16 | สร้าง context package (source-of-truth สำหรับ fan-out) | `docs\context-package.md` (189 บรรทัด) | Claude Code (main) | ~04:4x |
| D17 | ตัดสินใจความหมาย "implement issues" (AskUserQuestion) | = **Tracking issues (backlog md)** = planning artifact ไม่ใช่ code จริง — อยู่ใน HARD-GATE ได้ | Claude Code (main) + user | ~05:xx |
| D18 | ปิด auto-compact (ลบ `CLAUDE_CODE_AUTO_COMPACT_WINDOW` จาก `settings.local.json`) | env block เหลือ token + model overrides + BASE_URL ไม่มี var นี้ — *มีผลต่อเมื่อ restart session* | Claude Code (main) + user | ~05:xx |
| D19 | launch Workflow fan-out (PRD/PRP/Reviews/Issues) | Task ID `w9y7gdsn6`, Run ID `wf_0efc1e45-2a6` → **fail แล้ว (ดู §3)** | Claude Code (main) | ~05:xx |
| D20 | snapshot 0923 + root-cause analysis | `session-summary-2026-06-28-0923.md` (เพิ่ม: `vercel:deployment-expert` ถูกลบจาก registry) | Claude Code (main) | 2026-06-28 09:23:35 |
| D21 | ทำความสะอาด task list (mark #1 #2 completed, ลบ #3-#8 dup) | เหลือ #9-#14 ชุดเดียว | Claude Code (main) | ~09:2x |
| D22 | snapshot ไฟล์นี้ (ยืนยัน workflow fail หลัง ~10 ชม.) | `session-summary-2026-06-28-1505.md` | Claude Code (main) | **2026-06-28 15:05:32** |

---

## 3. Fan-out Workflow — สถานะ + Agent Roster (ประเด็นหลักของคำขอ verbatim)

### 3.1 คำขอ verbatim ของผู้ใช้
> `"fan out agents various expertise and cat involve ecc skills to create PRD, PRP-Plan, reviews prd and prp-plan and implement issues about ทำต่อเลย next step"`

(explicit opt-in สำหรับ Workflow tool — multi-agent orchestration)

### 3.2 สถานะ workflow ณ 15:05 (เช็คจริง — ยืนยัน fail)

| ตัวชี้ | ค่าที่เช็ค | ผล |
|---|---|---|
| Workflow Task ID | `w9y7gdsn6` | Run ID `wf_0efc1e45-2a6` |
| เวลา launch | ~05:xx ICT | — |
| เวลาเช็คล่าสุด | 2026-06-28 15:05:32 +0700 | — |
| ระยะเวลาที่ผ่านไป | **~10 ชม.** | — |
| Artifacts ใน `docs/` | Glob `docs/*.md` | **มีเพียง `context-package.md`** — PRD.md / PRP-Plan.md / reviews.md / tracking-issues.md **ยังไม่ลง disk ทั้ง 4 ไฟล์** |
| สรุปสถานะ | ❌ **FAIL ยืนยันแล้ว** — 10 ชม. ไม่มี output file ใด = workflow ตาย ไม่ใช่ stalled ที่จะกลับมาเสร็จ | — |

### 3.3 Root cause (ที่เพิ่งค้นพบ ~09:2x และยืนยันใน snapshot นี้)

**`vercel:deployment-expert` ถูกลบออกจาก agent registry ระหว่าง session** (ยืนยันจาก available agent types update — ปรากฏในรายการ "agent types no longer available")

→ Phase B ของ workflow ใช้ agent นี้ → เมื่อ agent type หายไป → Phase B fail → `.filter(Boolean)` ป้องกัน crash แต่ทำให้ `PRP-Plan.md` ไม่ถูกเขียน (เงียบ) → บล็อก Phase C/D ทั้งหมด (reviews/tracking-issues อ่าน PRP) → **อธิบายได้ว่าทำไมไม่มี artifact ใดลง disk เลย**

★ Insight ─────────────────────────────────────
- **Disk เป็น ground truth ไม่ใช่ task status** — synthesis agents ใช้ Write tool เขียน artifact ลง disk โดยตรง (survive compaction) → ถ้าเสร็จจริงไฟล์ต้องอยู่; "running" นาน 10 ชม. + ไม่มีไฟล์ = fail ไม่ใช่ in-progress
- **พึ่ง plugin-registry agent (เช่น `vercel:*`) มีความเสี่ยง** — registry เปลี่ยน mid-session → workflow break เงียบไม่มี error message ชัดเจน ควรใช้ built-in `general-purpose` (Tools:*) สำหรับจุดที่อาจถอดได้
- **`resumeFromRunId`** cache completed agents → แก้ agent ที่ fail แล้ว resume จะรันเฉพาะที่แก้ ประหยัด token (แต่กรณีนี้ fail ตั้งแต่ Phase B อาจ cache ได้น้อย → re-launch ใหม่อาจคุ้มกว่า)
`─────────────────────────────────────────────────`

### 3.4 Agent roster (ผู้ทำ fan-out + บทบาท) — 17 section-producers + 4 synthesis

| Phase | Agent | บทบาท | Agent type | ผลลัพธ์ที่คาด | สถานะ artifact |
|---|---|---|---|---|---|
| **A: PRD** | ecc:planner | product scope/ผู้มีส่วนได้ส่วนน้อย/success metrics | read-only | section ~700 คำ | ❌ ไม่มี |
| A | ecc:architect | system architecture | read-only | section | ❌ ไม่มี |
| A | ecc:a11y-architect | WCAG 2.2 AA ผู้สูงอายุ/อีสาน i18n | has Write | section | ❌ ไม่มี |
| A | ecc:database-reviewer | data model/entities/natural key/bitemporal | has Write | section | ❌ ไม่มี |
| A | ecc:security-reviewer | PDPA/secret/OWASP/บัตร 13 หลัก | has Write | section | ❌ ไม่มี |
| A (synthesis) | general-purpose | รวม 5 sections → **PRD.md** | Tools:* (Write) | `docs\PRD.md` | ❌ ไม่มี |
| **B: PRP-Plan** | ecc:planner | plan structure/milestone แตก deliverable | read-only | section | ❌ ไม่มี |
| B | ⚠️ **vercel:deployment-expert** (ถูกลบจาก registry) | deploy/CI/env/secret | ~~All tools~~ | section | ❌ ไม่มี → **root cause** |
| B (synthesis) | general-purpose | รวม → **PRP-Plan.md** | Tools:* (Write) | `docs\PRP-Plan.md` | ❌ ไม่มี |
| **C: Reviews** | ecc:security-reviewer | PDPA/RLS/auth/secret/OWASP/injection/บัตร 13 | has Write | verdicts | ❌ ไม่มี |
| C | ecc:code-reviewer | ความถูกต้อง/สถาปัตย์/cohesion/ขนาด | read-only | verdicts | ❌ ไม่มี |
| C | ecc:database-reviewer | schema/RLS/index/bitemporal/migration/pooler | has Write | verdicts | ❌ ไม่มี |
| C | ecc:a11y-architect | WCAG 2.2 AA/touch target/contrast/ฟอนต์/i18n | has Write | verdicts | ❌ ไม่มี |
| C | ecc:performance-optimizer | CWV/bundle/cold start/N+1/cache | has Write | verdicts | ❌ ไม่มี |
| C (synthesis) | general-purpose | รวม verdicts (CRITICAL/HIGH/MEDIUM/LOW + APPROVE/WARN/BLOCK) → **reviews.md** | Tools:* (Write) | `docs\reviews.md` | ❌ ไม่มี |
| **D: Tracking** | general-purpose | รวม PRP+reviews → backlog (ID/ชื่อ/milestone/priority/ประเภท/AC/dependency/estimate) → **tracking-issues.md** | Tools:* (Write) | `docs\tracking-issues.md` | ❌ ไม่มี |

### 3.5 Workflow script path (persisted)
`C:\Users\arnutt.n\.claude\projects\D--toppublic-per\02056b3d-ab21-4e58-870c-8a85dac6d90d\workflows\scripts\huangua-prd-prp-reviews-issues-wf_0efc1e45-2a6.js`

**หาก re-run:** แก้ script เปลี่ยน Phase B deploy/CI agent จาก `vercel:deployment-expert` → `general-purpose` แล้ว `Workflow({scriptPath: "...", resumeFromRunId: "wf_0efc1e45-2a6"})` (completed agents cache; เฉพาะ new/failed calls รันใหม่) — หรือ re-launch ใหม่ทั้งหมด

---

## 4. Tasks — PENDING (ค้างอยู่)

### 4.1 Fan-out recovery (บล็อกทันที — บล็อกทุกอย่างถัดไป)

| ID | งาน | สถานะ (ณ 15:05) | หมายเหตุ |
|----|------|-------|---------|
| #9 | สร้าง context package | ✅ completed (D16) | — |
| #10 | Phase A: สร้าง PRD | ⚠️ **failed** (artifact ไม่ลง disk) | ต้อง re-run |
| #11 | Phase B: สร้าง PRP-Plan | ❌ **failed — root cause** (`vercel:deployment-expert` ถูกลบ) | บล็อกโดย #10 + agent หายไป |
| #12 | Phase C: review PRD + PRP-Plan | ❌ **failed** (บล็อกโดย #10+#11) | — |
| #13 | Phase D: synthesize tracking-issues | ❌ **failed** (บล็อกโดย #11+#12) | — |
| #14 | นำเสนอผล + ขอ HARD-GATE approval | pending | หลัง artifacts ครบ + ตรวจคุณภาพ |

### 4.2 Brainstorming flow (หลัง artifacts พร้อม)

| ID | งาน | สถานะ | บล็อก? |
|----|------|-------|--------|
| #2 | Clarify visual direction + palette + typography | pending | บล็อก #3 |
| #3 | Present design system for approval | pending | **HARD-GATE** — ต้องได้ approval ก่อน scaffold |
| #4 | Write design doc + spec self-review | pending | บล็อก #5 |
| #5 | User reviews written spec | pending | บล็อก #6 |
| #6 | Invoke writing-plans skill | pending | terminal state ของ brainstorming |

### 4.3 หลังผ่าน HARD-GATE (phasing — ยังไม่เริ่ม)

- **Milestone 0 — Design system + Storybook:** Next.js+TS+Tailwind(tokens)+Radix(ร่างเอง)+tokens CSS custom properties (oklch, clamp typography, Thai-first, light+dark ตั้งใจ) + Storybook (a11y addon) + Vercel config + env placeholder + `secrets\`/`.claude` ใน `.gitignore`
- **P0 Foundation** (BLOCK go-live): DB schema, RLS, Auth+MFA, audit append-only, address/taxonomy seed, PDPA consent flow
- **P0.5 Dry-run & Training:** ข้อมูลจริง, อบรมเจ้าหน้าที่
- **P1 MVP Core:** รับเรื่อง/ติดตาม + admin + notification + SLA escalation (QStash)
- **P2 Growth:** LINE LIFF, Live Chat + Telegram, จองคิว/นัดช่าง, a11y ผู้สูงอายุ, PMQA
- **P3 Scale:** Field App offline, AI classification, e-Sign, Multi-tenant (shared schema+org_id+RLS), DR

---

## 5. การตัดสินใจสำคัญ (Pivots)

1. **PIVOT #1** — hosting self-host VPS → Vercel + Supabase Cloud free (managed) เน้น design system
2. **Design foundation = Radix + custom Tailwind** (ร่างเอง) ไม่ใช้ shadcn — ผู้ใช้เลือก (นานกว่า แต่ควบคุม identity)
3. **Milestone แรก = design system + Storybook ก่อน** (foundation-first, ยังไม่มี app logic)
4. **PIVOT #2** — queue/cache/rate-limit/scheduler จาก DB/edge → Upstash Redis + QStash (แยกจาก DB)
5. **ผู้ใช้ปฏิเสธ Recommended ทั้ง 2** → foundation-first, deliberate, custom identity — ต้องเคารพ
6. **"implement issues" = Tracking issues (backlog md)** = planning artifact ไม่ใช่ code จริง (อยู่ใน HARD-GATE ได้)
7. **ปิด auto-compact** — ลบ env var แล้ว แต่มีผลต่อเมื่อ restart session (PreCompact ยังยิงใน session เดิม)

---

## 6. Stack Decision (ปัจจุบัน)

| เลเยอร์ | เทคโนโลยี | หมายเหตุ |
|---------|----------|---------|
| Hosting / Edge / Serverless / Cron | **Vercel** | Hobby เริ่ม; Pro $25/ด go-live (ToS ห้ามเชิงพาณิชย์) |
| DB / Auth / Storage / Realtime / RLS / Edge Fn | **Supabase Cloud free** | pooler port 6543 (transaction mode); auto-pause 7 วัน → ping mitigation |
| Queue / Cache / Rate-limit / Scheduler | **Upstash Redis (REST) + QStash (HTTP push)** | REST fit serverless; แยก QStash จาก DB |
| Frontend | **Next.js App Router + TS + Tailwind (map tokens) + Radix UI headless** | ร่างเอง — ไม่ใช้ shadcn |
| Design validation | **Storybook + a11y addon + visual regression** | ทำก่อนเขียนหน้าจอจริง |

**Free-tier ธงแดง (go-live):** Supabase 500MB DB/1GB storage/50k MAU/auto-pause 7d; Upstash 10,000 cmd/day 256MB; QStash ~200 msg/day; Vercel Hobby ห้ามเชิงพาณิชย์

---

## 7. ข้อจำกัด / ข้อควรระวัง (Constraints — ต้องคงไว้หลัง compaction)

- **`D:\toppublic\per\secrets\`** — โฟลเดอร์ละเอียดอ่อน (มี `switch_claude_mode_*.ps1` อาจมี credential) → **ห้ามอ่าน/แก้/commit/รั่วไหล** ต้องอยู่ใน `.gitignore` เสมอ
- **`ANTHROPIC_AUTH_TOKEN`** plaintext ใน `.claude\settings.local.json` (ค่าจริง = `<REDACTED>` รูปแบบ `<32-hex>.<base64-suffix>`) → **ห้าม echo ค่าจริง**; `.claude\settings.local.json` ต้องอยู่ใน `.gitignore`
- **HARD-GATE (brainstorming skill):** ห้ามเขียนโค้ด/scaffold/invoke implementation skill จนกว่าจะนำเสนอ design + ผู้ใช้อนุมัติ; terminal state = invoke writing-plans; PRD/PRP-Plan/reviews/tracking-issues = planning artifacts อยู่ใน gate ได้
- **design-quality rules (บังคับ):** ห้ามหน้าตา default template; pick specific style direction (ไม่ใช่ "clean minimal"); required qualities ≥4 จาก 10; ไม่ default dark mode อัตโนมัติ
- **Thai-first + a11y ผู้สูงอายุ:** touch target ≥44px, contrast AA, ฟอนต์ใหญ่ (Sarabun/Noto Sans Thai, 16pt base), ภาษาอีสาน i18n-ready
- **ไม่ใช้ dangerously-skip-permissions** (ใช้ `allowedTools` ใน `~/.claude.json` แทน)
- **commit message:** conventional commits (feat/fix/refactor/...); attribution disabled ทั้งระบบผ่าน `~/.claude/settings.json`
- **ผู้ใช้ใจเร็ว** (pivot หลายรอบ, ปฏิเสธ Recommended ทั้ง 2) → ถามกระชับ + นำเสนอ compact + momentum แต่เคารพ HARD-GATE

---

## 8. ไฟล์ที่เกี่ยวข้องใน session

| พาธ | บทบาท | สถานะ |
|-----|-------|-------|
| `D:\toppublic\per\1.ถนน ระบบระบายน้ำ.docx` | ต้นฉบับ 1 | อ่าน/unpack แล้ว |
| `D:\toppublic\per\สรุปผลการให้ความช่วยเหลือประชาชน รวมประเ.docx` | ต้นฉบับ 2 | อ่าน/unpack แล้ว |
| `D:\toppublic\per\unpacked1\`, `unpacked2\`, `_unp1\`, `_unp2\` | XML unpack ของ docx | มีอยู่ (D1) |
| `D:\toppublic\per\docs\context-package.md` | source-of-truth สำหรับ fan-out (189 บรรทัด) | ✅ มี (D16) |
| `D:\toppublic\per\docs\PRD.md` | artifact Phase A | ❌ ยังไม่มี (workflow fail) |
| `D:\toppublic\per\docs\PRP-Plan.md` | artifact Phase B | ❌ ยังไม่มี (root cause fail) |
| `D:\toppublic\per\docs\reviews.md` | artifact Phase C | ❌ ยังไม่มี (blocked) |
| `D:\toppublic\per\docs\tracking-issues.md` | artifact Phase D | ❌ ยังไม่มี (blocked) |
| `D:\toppublic\per\secrets\` | **ห้ามแตะ/commit** — ต้องอยู่ใน `.gitignore` | — |
| `D:\toppublic\per\.claude\settings.local.json` | project-local Claude settings (มี credential) | ต้องอยู่ใน `.gitignore` |
| `D:\toppublic\per\project-log-md\claude-code\session-summary-2026-06-28-0441.md` | snapshot 04:41 | ✅ มี (D15) |
| `D:\toppublic\per\project-log-md\claude-code\session-summary-2026-06-28-0923.md` | snapshot 09:23 (+ root cause) | ✅ มี (D20) |
| `D:\toppublic\per\project-log-md\claude-code\session-summary-2026-06-28-1505.md` | **ไฟล์นี้** | ✅ มี (D22) |
| `...workflows\scripts\huangua-prd-prp-reviews-issues-wf_0efc1e45-2a6.js` | workflow script (persisted) | ✅ มี — ต้องแก้ Phase B agent |
| *(ยังไม่มี `package.json`)* | greenfield — จะ scaffold หลัง HARD-GATE approval | — |

---

## 9. Next Step (ขั้นถัดไป)

**workflow fan-out fail แล้ว — ต้อง re-run ก่อนจะนำเสนอผลได้:**

1. **แก้ workflow script** — เปลี่ยน Phase B deploy/CI agent จาก `vercel:deployment-expert` (ถูกลบจาก registry) → `general-purpose` (Tools:* เขียนไฟล์ได้)
2. **Re-run:** `Workflow({scriptPath: "C:\\Users\\arnutt.n\\.claude\\projects\\D--toppublic-per\\02056b3d-ab21-4e58-870c-8a85dac6d90d\\workflows\\scripts\\huangua-prd-prp-reviews-issues-wf_0efc1e45-2a6.js", resumeFromRunId: "wf_0efc1e45-2a6"})` (cache completed; รันเฉพาะ new/failed) — หรือ re-launch ใหม่ทั้งหมดหาก cache ไม่คุ้ม
3. เมื่อ 4 artifacts ลง disk → **Read ทั้งหมด + ตรวจคุณภาพ**
4. **Mark #10-#13 completed** หาก artifact ครบ + คุณภาพดี; หาก artifact ใดขาด/ต่ำ → re-run agent นั้น
5. **นำเสนอผล + ขอ HARD-GATE approval (#14)** — นำเสนอ PRD + PRP-Plan + reviews + tracking-issues แล้วขอ approval ก่อน scaffold ใดๆ
6. หลัง approval: สาน brainstorming flow (#2→#6) → invoke writing-plans → scaffold Milestone 0

> หมายเหตุ: ผู้ใช้ใจเร็ว → แจ้งตรงๆ ว่า workflow fail (agent ถูกลบจาก registry) แล้วเสนอทางแก้ compact + momentum แต่ยังเคารพ HARD-GATE ไม่ scaffold ก่อน approval

---

*สรุปนี้สร้าง 2026-06-28 15:05:32 ICT — checkpoint DONE+PENDING tasks พร้อม agent ผู้ทำ + timestamp; workflow fan-out **fail ยืนยันแล้ว** (artifacts ไม่ลง disk หลัง ~10 ชม. — root cause: `vercel:deployment-expert` ถูกลบจาก registry) ต้อง re-run ก่อนนำเสนอผล*