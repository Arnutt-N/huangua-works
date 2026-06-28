# Session Summary — อบต.หัวงัว Citizen Help/Traffy-style Web App

| ฟิลด์ | ค่า |
|------|-----|
| **Agent** | Claude Code (Anthropic CLI) |
| **Model** | glm-5.2:cloud (max effort) |
| **Generated at** | 2026-06-28 04:41:17 ICT (+07:00) |
| **Session ID** | 9bcaea06-37d4-41e8-9b81-d31bbf0c5170 |
| **Working dir** | `D:\toppublic\per` |
| **Log type** | Mid-session checkpoint (compaction recovery) |
| **Phase** | Brainstorming — pre-approval (HARD-GATE ยังไม่ผ่าน) |

---

## 1. บริบทโปรเจกต์

ออกแบบเว็บแอปสำหรับ **องค์การบริหารส่วนตำบลหัวงัว (อ.ยางตลาด จ.กาฬสินธุ์)** เพื่อจัดการงานสรุปผลการช่วยเหลือประชาชน / ร้องเรียก ร้องทุกข์ โดยอิงจากเอกสารต้นฉบับ `.docx` 2 ไฟล์:

- `1.ถนน ระบบระบายน้ำ.docx` — unpack แล้ว; document.xml 3,848 บรรทัด; ตาราง 9 คอลัมน์ 8 รายการ (มี.ค. + ก.พ.)
- `สรุปผลการให้ความช่วยเหลือประชาชน รวมประเ.docx` — unpack แล้ว; document.xml 1,951 บรรทัด; ตาราง 8 คอลัมน์ 4 รายการซ้ำกับมี.ค.ของไฟล์ 1

เป้าหมายทางการ: ระบบรับเรื่องร้องเรียก/ร้องทุกข์แบบ citizen-facing + admin full-stack ตามมาตรฐานราชการไทย (รหัส กก.ทร., บัตรประชาชน 13 หลัก, ปีงบพ.ศ., PDPA พ.ร.บ. 2562) เทียบเท่า Traffy Fondue แต่ท้องถิ่นจริง

---

## 2. Stack Decision (ปัจจุบัน)

หลัง 2 ครั้ง pivot ของผู้ใช้:

| เลเยอร์ | เทคโนโลยี | หมายเหตุ |
|---------|----------|---------|
| Hosting / Edge / Serverless / Cron | **Vercel** | Hobby สำหรับเริ่ม; Pro ($25/ด) เมื่อ go-live (ToS ห้ามเชิงพาณิชย์บน Hobby) |
| DB / Auth / Storage / Realtime / RLS / Edge Fn | **Supabase Cloud free** | pooler URL port 6543 (transaction mode) บน serverless; **auto-pause หลัง 7 วันไม่มี activity** → mitigation ด้วย ping |
| Queue / Cache / Rate-limit / Scheduler | **Upstash Redis (REST) + QStash (HTTP push)** | REST (ไม่ใช่ RESP/TCP) fit serverless; แยก QStash ออกจาก DB เพื่อไม่กิน DB connection |
| Frontend | **Next.js App Router + TypeScript + Tailwind (map tokens) + Radix UI headless** | ร่าง primitive เอง — **ไม่ใช้ shadcn** (ตามตัวเลือกผู้ใช้) |
| Design validation | **Storybook + a11y addon + visual regression** | ทำก่อนเขียนหน้าจอจริง |

★ Insight Upstash: REST ไม่ใช่ RESP/TCP → fit Vercel serverless (connection ไม่ถาวร) แต่ latency สูงกว่า TCP Redis เล็กน้อย; QStash push-based (HTTP → Vercel route) ตรง model serverless ตรงข้าม Redis Streams แบบ pull — เหตุที่เลือก QStash ไม่ใช่ Redis list ธรรมดา

### Free-tier ธงแดง (ต้องตามตอน go-live)
- Supabase free: 500MB DB / 1GB storage / 50k MAU / **auto-pause 7 วัน** → ยก Pro เมื่อ go-live
- Upstash Redis free: 1 DB, **10,000 commands/day**, 256 MB, request ≤1MB → rate-limit ทุก request อาจเกิน; mitigation: in-memory cache ชั่วคราว + cache เฉพาะ hot lookup
- QStash free: ~200 messages/day, scheduled limit ต่ำ → job ถี่ต้องยก Pro

### Env placeholder (ใส่ใน `.env.example` ใน milestone design system — ยังไม่มี code เรียกใช้จริง)
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

---

## 3. Tasks — DONE (เสร็จใน session นี้)

| # | งาน | ผลลัพธ์ |
|---|------|---------|
| D1 | อ่าน + unpack docx 2 ไฟล์ | `unpacked1/`, `unpacked2/`, `_unp1/`, `_unp2/`; วิเคราะห์ตาราง DXA/w:tbl ครบ |
| D2 | ออกแบบเว็บแอป 6 ฟังก์ชัน + entity model + RBAC + state machine | รับเรื่อง→ตรวจสอบ→มอบหมาย→นัดเข้าพื้นที่→ดำเนินการ→เสร็จ→ปิดเรื่อง + สาขา รองบประมาณ/ส่งต่อภายนอก/ฉุกเฉิน |
| D3 | เสนอ 4 stack options | เปรียบเทียบก่อนเลือก |
| D4 | ออกแบบ DB ระดับชาติ (ที่อยู่ + หน่วยงาน + บุคลากร bitemporal) | รหัสกรมการปกครอง จว./อ./ต./ม. + กก.ทร. |
| D5 | ศึกษา + เทียบฟีเจอร์ Traffy Fondue | 30 หมวด, LINE chatbot, AI classification, open data |
| D6 | เพิ่ม Live Chat หลังบ้าน + Telegram handoff | เจ้าหน้าที่รับเมื่อผู้ใช้ต้องการคนจริง |
| D7 | เพิ่ม LINE LIFF | citizen-facing mini-app |
| D8 | ตรวจสอบช่องว่าง 6 หมวด 34 ข้อ | completeness check |
| D9 | fan-out 4 agents (planner/architect/security/database) brainstorm gap analysis + phasing | ขนาน + reviewer-critique |
| D10 | Synthesis phasing: P0 Foundation / P0.5 Dry-run / P1 MVP Core / P2 Growth / P3 Scale | go/no-go criteria + risk register |
| D11 | (PIVOT #1) remap architecture → Vercel + Supabase free | เปลี่ยนจาก self-host VPS |
| D12 | ถาม visual direction + milestone (AskUserQuestion) | ผู้ใช้เลือก **Radix + custom Tailwind** + **design system + Storybook ก่อน** (ปฏิเสธ Recommended ทั้ง 2) |
| D13 | (PIVOT #2) remap architecture รวม Upstash Redis + QStash | แทน queue/cache/rate-limit บน DB |
| D14 | สำรวจ toolchain + dir | node v24.15.0, npm 11.14.0, pnpm 11.0.8, git 2.54.0; greenfield (ไม่มี package.json); พบ `secrets\` (ห้ามแตะ) |
| D15 | สร้าง session log ไฟล์นี้ | `project-log-md\claude-code\session-summary-2026-06-28-0441.md` |

---

## 4. Tasks — PENDING (ค้างอยู่)

### 4.1 Brainstorming flow (task list ปัจจุบัน — ทั้งหมดยัง pending)

| ID | งาน | สถานะ | บล็อก? |
|----|------|-------|--------|
| #1 | Explore project context | pending | ส่วนใหญ่ทำแล้ว (D14) — รอ mark completed + set dependencies |
| #2 | Clarify visual direction + palette + typography | pending | บล็อก #3 |
| #3 | Present design system design for approval | pending | **HARD-GATE** — ต้องได้ approval ก่อน scaffold |
| #4 | Write design doc + spec self-review | pending | บล็อก #5 |
| #5 | User reviews written spec | pending | บล็อก #6 |
| #6 | Invoke writing-plans skill | pending | terminal state ของ brainstorming |

### 4.2 หลังผ่าน HARD-GATE (phasing เดิม, ยังไม่เริ่ม)

- **Milestone 0 — Design system + Storybook:** Next.js + TS + Tailwind(tokens) + Radix primitives(ร่างเอง) + tokens CSS custom properties (oklch, clamp typography, Thai-first, light+dark ตั้งใจ) + Storybook (a11y addon) + config deploy Vercel + env var Supabase/Upstash (placeholder) + **`secrets\` ใน `.gitignore`**
- **P0 Foundation** (BLOCK go-live): DB schema, RLS, Auth+MFA, audit append-only, address/taxonomy seed, PDPA consent flow
- **P0.5 Dry-run & Training:** ข้อมูลจริง, อบรมเจ้าหน้าที่
- **P1 MVP Core:** รับเรื่อง/ติดตาม + admin + notification + SLA escalation (QStash)
- **P2 Growth:** LINE LIFF, Live Chat + Telegram, จองคิว/นัดช่าง, a11y ผู้สูงอายุ, PMQA
- **P3 Scale:** Field App offline, AI classification, e-Sign, Multi-tenant (shared schema + org_id + RLS), DR

---

## 5. การตัดสินใจสำคัญ (Key Decisions)

1. **PIVOT #1** — hosting เปลี่ยนจาก self-host VPS → Vercel + Supabase Cloud free (managed) เน้น frontend design system
2. **Design System foundation = Radix + custom Tailwind** — ร่าง primitive เองจาก Radix headless ควบคุม identity ละเอียดสุด ไม่ใช้ shadcn (นานกว่า แต่ผู้ใช้เลือก)
3. **Milestone แรก = design system + Storybook ก่อน** — วางราก design system อย่างเดียว ยังไม่มี application logic ดู tokens/primitives พร้อมก่อนเขียนหน้าจอจริง
4. **PIVOT #2** — queue/cache/rate-limit/scheduler เปลี่ยนจาก DB/edge → Upstash Redis + QStash (แยกออกจาก Supabase DB)
5. **ผู้ใช้ปฏิเสธ Recommended ทั้ง 2 ตัวเลือก** ของผม → สัญญาณ foundation-first, deliberate, custom identity → ต้องเคารพในทุกขั้นต่อไป

---

## 6. ข้อจำกัด / ข้อควรระวัง (Constraints)

- **`D:\toppublic\per\secrets\`** — โฟลเดอร์ละเอียดอ่อน มี `switch_claude_mode_*.ps1` (อาจมี credential) → **ห้ามอ่าน/แก้/commit/รั่วไหล** ต้องอยู่ใน `.gitignore` เสมอเมื่อ git init/scaffold
- **HARD-GATE (brainstorming skill):** ห้ามเขียนโค้ด/scaffold จนกว่าจะนำเสนอ design + ผู้ใช้อนุมัติ; terminal state = invoke writing-plans (ไม่ใช่ frontend-design ตรงๆ)
- **design-quality rules (บังคับ):** ห้ามหน้าตา default template; ต้อง pick specific style direction (ไม่ใช่ "clean minimal"); required qualities ≥4 จาก 10; ไม่ default dark mode อัตโนมัติ
- **Thai-first + a11y ผู้สูงอายุ:** touch target ≥44px, contrast AA, ฟอนต์ใหญ่ (Sarabun/Noto Sans Thai, 16pt base), ภาษาอีสาน i18n-ready
- **ไม่ใช้ dangerously-skip-permissions** (ใช้ `allowedTools` ใน `~/.claude.json` แทน)
- **commit message:** conventional commits (feat/fix/refactor/...); attribution disabled ทั้งระบบผ่าน `~/.claude/settings.json`

---

## 7. Next Step (ขั้นถัดไป)

ปฏิบัติตาม brainstorming flow หลัง explore context (task #1 → mark completed):

1. mark task #1 completed; task #2/#3 in_progress
2. **ถาม visual direction** (keystone — design-quality rules บังคับให้ deliberate) — เสนอ recommend "Civic Light / Editorial-Thai" (light-first high-contrast editorial typography hierarchy + semantic color, fit ราชการไทย + ผู้สูงอายุ + admin) พร้อม alt (Swiss/International, Neo-brutalism) ผ่าน AskUserQuestion
3. นำเสนอ design sections (architecture / tokens / primitives inventory / Storybook+a11y / Vercel+Supabase+Upstash env setup) แล้วขอ approval — **HARD-GATE ก่อน scaffold**
4. เขียน spec → self-review → user review → invoke writing-plans
5. scaffold หลัง approval: Next.js + TS + Tailwind + Radix + tokens + Storybook + Vercel config + env placeholder + `secrets\` ใน `.gitignore`

> หมายเหตุ: ผู้ใช้ใจเร็ว (pivot หลายรอบ, ปฏิเสธ Recommended) → ถามกระชับ + นำเสนอ compact + ให้ momentum แต่ยังเคารพ HARD-GATE ไม่ scaffold ก่อน approval

---

## 8. ไฟล์ที่เกี่ยวข้องใน session

| พาธ | บทบาท |
|-----|-------|
| `D:\toppublic\per\1.ถนน ระบบระบายน้ำ.docx` | ต้นฉบับ 1 |
| `D:\toppublic\per\สรุปผลการให้ความช่วยเหลือประชาชน รวมประเ.docx` | ต้นฉบับ 2 |
| `D:\toppublic\per\unpacked1\`, `unpacked2\`, `_unp1\`, `_unp2\` | XML unpack ของ docx |
| `D:\toppublic\per\secrets\` | **ห้ามแตะ/commit** — ต้องอยู่ใน `.gitignore` |
| `D:\toppublic\per\.claude\settings.local.json` | project-local Claude settings |
| `D:\toppublic\per\project-log-md\claude-code\session-summary-2026-06-28-0441.md` | ไฟล์นี้ |
| *(ยังไม่มี `package.json`)* | greenfield — จะ scaffold หลัง approval |

---

*สรุปนี้สร้างกลาง session (หลัง compaction) เพื่อ snapshot สถานะ ณ 2026-06-28 04:41 ICT ก่อนเข้าสู่ HARD-GATE approval*