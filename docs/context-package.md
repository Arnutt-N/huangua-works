# Context Package — อบต.หัวงัว Citizen Help / Complaint Web App

> Source-of-truth context file สำหรับ fan-out agents (PRD / PRP-Plan / reviews / tracking-issues)
> Generated 2026-06-28. Snapshot การตัดสินใจ + ข้อมูลต้นฉบับจริงที่ extract จาก .docx
> Full session history: `D:\toppublic\per\project-log-md\claude-code\session-summary-2026-06-28-0441.md`
> **สำคัญ:** ผลลัพธ์ทุกอย่างเป็น **planning artifact (markdown)** — ห้ามเขียนโค้ด/scaffold (HARD-GATE)

---

## 1. โครงการ

ออกแบบเว็บแอปสำหรับ **องค์การบริหารส่วนตำบลหัวงัว** (อำเภอยางตลาด จังหวัดกาฬสินธุ์) เพื่อจัดการงาน **สรุปผลการให้ความช่วยเหลือประชาชน / ร้องเรียก ร้องทุกข์** อิงจากเอกสารต้นฉบับ `.docx` 2 ไฟล์

**เป้าหมาย:** ระบบรับเรื่องร้องเรียก/ร้องทุกข์แบบ **citizen-facing + admin full-stack** ตามมาตรฐานราชการไทย (รหัส กก.ทร., บัตรประชาชน 13 หลัก, ปีงบพ.ศ., PDPA พ.ร.บ. 2562) เทียบเท่า **Traffy Fondue** แต่ท้องถิ่นจริง

---

## 2. ข้อมูลต้นฉบับ (extract จาก .docx จริง)

### ไฟล์ 1: `1.ถนน ระบบระบายน้ำ.docx`
- หัวเรื่อง: **สรุปผลการให้ความช่วยเหลือประชาชนและการแก้ไขปัญหาความเดือดร้อน**
- หมวดงาน: **ถนน ระบบระบายน้ำ** (เรื่องร้องเรียน ร้องทุกข์ ขอความอนุเคราะห์)
- หน่วยงาน: องค์การบริหารส่วนตำบลหัวงัว อำเภอยางตลาด จังหวัดกาฬสินธุ์
- มี 2 ตาราง: เดือนกุมภาพันธ์ + เดือนมีนาคม พ.ศ. 2569
- **คอลัมน์ (9):** ลำดับที่ | เลขหนังสือรับ | วัน/เดือน/ปี | ชื่อผู้ร้องทุกข์/หมู่ที่ | รายละเอียดปัญหา/คำร้อง | ผู้รับผิดชอบ | การดำเนินการช่วยเหลือ | ผลการดำเนินงาน | หมายเหตุ

**ตาราง มี.ค. 2569 (4 รายการ):**

| ลำดับ | เลขรับ | วันที่ | ผู้ร้องทุกข์ | หมู่ที่ | ปัญหา/คำร้อง | ผู้รับผิดชอบ | การดำเนินการ/ผล |
|---|---|---|---|---|---|---|---|
| 1 | 100 | 2 มี.ค. 2569 | นายวิชิต ภูตีนผา | บ้านเสียว ม.6 | ซ่อมแซมไหล่ทางชำรุด | — | — |
| 2 | 344 | 27 ก.พ. 2569 | อำเภอยางตลาด *(หน่วยงานส่งต่อ)* | — | ขอให้เร่งรัดผลการดำเนินการ; ปรับปรุงซ่อมแซมคลองส่งน้ำ; ขุดลอกคลองดิน คลองไส้ไก่ | — | จ่ายขาดเงินสะสมเพื่อดำเนินโครงการ ซ่อมแซมคลองไส้ไก่ สายโนนแดง บ้านเสียว ม.2 → บ้านโคกคันจ้อง ม.11 **งบ 100,000 บาท** |
| 3 | 105 | 5 มี.ค. 2569 | นางกุหลาบ จันทราช | บ้านหนองกุง ม.13 | ตรวจสอบท่อน้ำอุดตัน | — | — |
| 4 | 113 | 5 มี.ค. 2569 | น.ส.ปรายวิณี ภูมั่น | บ้านเสียว ม.5 | — | — | — |

**ตาราง ก.พ. 2569 (4 รายการ):**

| ลำดับ | เลขรับ | วันที่ | ผู้ร้องทุกข์ | หมู่ที่ | ปัญหา/คำร้อง | ผู้รับผิดชอบ | การดำเนินการ/ผล |
|---|---|---|---|---|---|---|---|
| 1 | 50 | 6 ก.พ. 2569 | นายวิชิต ภูตีนผา | บ้านเสียว ม.6 | แก้ไขปัญหาน้ำรางระบายและน้ำเน่าเสีย | **กองช่าง** | — |
| 2 | 88 | 26 ก.พ. 2569 | น.ส.วลัยพร แก้วมงคล | เส้นหนองกุดเสียว | ซ่อมแซมไหล่ทาง | **หลายคน:** 1.นายอัครพล เจริญขุน 2.น.ส.ยฎา เบญญพรพรรณ 3.น.ส.กนกภรณ์ โพธิ์สิงห์ | — |
| 3 | 95 | 27 ก.พ. 2569 | น.ส.ปรายวิณี ภูมั่น | บ้านเสียว ม.5 | ซ่อมแซมถนนชำรุดเสียหาย | — | — |
| 4 | 96 | 27 ก.พ. 2569 | น.ส.ปรายวิณี ภูมั่น | บ้านเสียว ม.5 | ซ่อมแซมรางระบายน้ำ | — | — |

### ไฟล์ 2: `สรุปผลการให้ความช่วยเหลือประชาชน รวมประเ.docx`
- หัวเรื่อง/หน่วยงาน/หมวดงาน/เดือน: ตรงกับไฟล์ 1 (มี.ค. 2569)
- **คอลัมน์ (10) — เพิ่ม "ประเภทปัญหา":** ลำดับที่ | เลขหนังสือรับ | วัน/เดือน/ปี | ชื่อผู้ร้องทุกข์/หมู่ที่ | **ประเภทปัญหา** | รายละเอียดปัญหา/คำร้อง | ผู้รับผิดชอบ | การดำเนินการช่วยเหลือ | ผลการดำเนินงาน | หมายเหตุ
- 4 รายการซ้ำกับมี.ค.ของไฟล์ 1 แต่แยก "ประเภทปัญหา" ออกจาก "รายละเอียด" → **เป็น taxonomy seed** (เช่น ประเภท = "ซ่อมแซมไหล่ทางชำรุด" แยกจากรายละเอียด)

### Insight ข้อมูลต้นฉบับ (สำคัญต่อ data model)
- **"เลขหนังสือรับ"** (100/344/105/113/50/88/95/96) = รหัสเอกสารรับเข้ากลางของราชการ → **natural key** สำหรับ tracking
- **"ผู้ร้องทุกข์"** บางรายการเป็น "อำเภอยางตลาด" (หน่วยงานส่งเรื่องมา) ไม่ใช่ปัจเจก → entity ต้องรองรับทั้ง **ประชาชน + หน่วยงานส่งต่อ**
- **"ผู้รับผิดชอบ"** เป็น list (หลายคนต่อเรื่อง — รายการ 88 มี 3 คน) → **many-to-many** relationship
- **"การดำเนินการ/ผล"** มี free-text ยาว + **จำนวนเงิน** (งบประมาณ 100,000 บาท) → ต้องมี structured field + free-text
- **วันที่** ใช้ **พ.ศ. + เดือนไทย** (2 มี.ค. 2569) → date lib ต้องรองรับพุทธศักราช (พ.ศ. = ค.ศ. + 543)
- **ที่อยู่** "บ้านเสียว ม.6" / "บ้านหนองกุง ม.13" → แมปกับ **รหัสกรมการปกครอง** (จว./อ./ต./ม.)
- **"ประเภทปัญหา"** ในไฟล์ 2 = taxonomy ที่จะขยายเป็น ~30 หมวดแบบ Traffy

---

## 3. Stack Decision

| เลเยอร์ | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Hosting / Edge / Serverless / Cron | **Vercel** | Hobby เริ่ม; Pro $25/ด go-live (ToS ห้ามเชิงพาณิชย์บน Hobby) |
| DB / Auth / Storage / Realtime / RLS / Edge Fn | **Supabase Cloud free** | pooler URL port 6543 (transaction mode) serverless; **auto-pause 7 วัน** → ping mitigation |
| Queue / Cache / Rate-limit / Scheduler | **Upstash Redis (REST) + QStash (HTTP push)** | REST (ไม่ใช่ RESP/TCP) fit serverless; แยก QStash จาก DB |
| Frontend | **Next.js App Router + TypeScript + Tailwind (map tokens) + Radix UI headless** | ร่าง primitive เอง — **ไม่ใช้ shadcn** (ตามตัวเลือกผู้ใช้) |
| Design validation | **Storybook + a11y addon + visual regression** | ทำก่อนเขียนหน้าจอจริง |

★ Insight Upstash: REST ไม่ใช่ RESP/TCP → fit Vercel serverless (connection ไม่ถาวร) แต่ latency สูงกว่า TCP เล็กน้อย; QStash push-based (HTTP → Vercel route) ตรง model serverless ตรงข้าม Redis Streams แบบ pull — เหตุที่เลือก QStash ไม่ใช่ Redis list ธรรมดา

---

## 4. Domain Model

### ฟังก์ชัน 6 ข้อ
1. รับเรื่องร้องเรียก/ร้องทุกข์ (citizen + หน่วยงานส่งต่อ)
2. ตรวจสอบความถูกต้อง + จัดประเภท (taxonomy ~30 หมวดแบบ Traffy)
3. มอบหมายผู้รับผิดชอบ (เจ้าหน้าที่/หน่วยงาน/กองช่าง)
4. นัดเข้าพื้นที่ตรวจสอบ
5. ดำเนินการ + บันทึกผล + งบประมาณ (กก.ทร.)
6. ปิดเรื่อง + สรุปผล + ส่งกลับผู้ร้อง

### State machine (เรื่องร้อง)
`รับเรื่อง → ตรวจสอบ → มอบหมาย → นัดเข้าพื้นที่ → ดำเนินการ → เสร็จ → ปิดเรื่อง`
**สาขา:** รองบประมาณ / ส่งต่อภายนอก / ฉุกเฉิน

### RBAC (5 บทบาท)
| บทบาท | สิทธิ์ |
|---|---|
| ประชาชน (citizen) | ยื่น/ติดตาม/ดูสถานะของตน |
| เจ้าหน้าที่รับเรื่อง (intake) | รับ + จัดประเภท + มอบหมาย |
| เจ้าหน้าที่ผู้รับผิดชอบ (assignee) | ดำเนินการ + บันทึกผล |
| ผู้บริหาร (admin/นายก อบต.) | มองเห็นทั้งหมด + อนุมัติงบ + รายงาน |
| ผู้ดูแลระบบ (sysadmin) | จัดการผู้ใช้/หน่วยงาน/taxonomy |

---

## 5. DB Design (ระดับชาติ)

- **ที่อยู่** ตามกรมการปกครอง: จังหวัด/อำเภอ/ตำบล/หมู่บ้าน (รหัส + ชื่อ)
- **หน่วยงาน** (อบต., อำเภอ, กองช่าง...) — bitemporal (history การเปลี่ยนแปลง)
- **บุคลากร** — bitemporal (ตำแหน่งเปลี่ยนตามเวลา)
- **รหัส กก.ทร.** (งบประมาณ) + **บัตรประชาชน 13 หลัก** + **เลขที่หนังสือรับ** (natural key)
- **PDPA พ.ร.บ. 2562**: consent, data minimization, retention, right to access/erase
- **audit log append-only**, **RLS per role + per org**

---

## 6. Constraints / ข้อควรระวัง

- **HARD-GATE:** ห้ามเขียนโค้ด/scaffold จนกว่าจะนำเสนอ design + ผู้ใช้อนุมัติ — ผลลัพธ์ fan-out (PRD/PRP-Plan/tracking-issues) เป็น **planning artifact** ไม่ใช่ code จึงอยู่ใน gate ได้
- **design-quality rules (บังคับ):** ห้ามหน้าตา default template; pick specific style direction (ไม่ใช่ "clean minimal"); required qualities ≥4 จาก 10; ไม่ default dark mode อัตโนมัติ
- **Thai-first + a11y ผู้สูงอายุ:** touch target ≥44px, contrast AA, ฟอนต์ใหญ่ (Sarabun/Noto Sans Thai 16pt base), ภาษาอีสาน i18n-ready
- **`secrets\` + `.claude/settings.local.json`** ต้องอยู่ใน `.gitignore` เสมอเมื่อ git init (มี credential)
- **commit message:** conventional commits; attribution disabled ทั้งระบบ
- **ไม่ใช้ dangerously-skip-permissions**

---

## 7. Free-tier ธงแดง (ตามตอน go-live)
- **Supabase free:** 500MB DB / 1GB storage / 50k MAU / **auto-pause 7 วัน** → Pro เมื่อ go-live
- **Upstash Redis free:** 1 DB, **10,000 commands/day**, 256MB, request ≤1MB → in-memory cache + hot-lookup เท่านั้น
- **QStash free:** ~200 msg/day → job ถี่ต้อง Pro
- **Vercel Hobby:** ห้ามเชิงพาณิชย์ → Pro $25/ด go-live

---

## 8. Phasing

- **Milestone 0 — Design system + Storybook:** Next.js+TS+Tailwind(tokens)+Radix(ร่างเอง)+tokens CSS custom properties (oklch, clamp typography, Thai-first, light+dark ตั้งใจ) + Storybook (a11y addon) + Vercel config + env placeholder + `secrets\`/`.claude` ใน `.gitignore`
- **P0 Foundation (BLOCK go-live):** DB schema, RLS, Auth+MFA, audit append-only, address/taxonomy seed, PDPA consent flow
- **P0.5 Dry-run & Training:** ข้อมูลจริง, อบรมเจ้าหน้าที่
- **P1 MVP Core:** รับเรื่อง/ติดตาม + admin + notification + SLA escalation (QStash)
- **P2 Growth:** LINE LIFF, Live Chat + Telegram, จองคิว/นัดช่าง, a11y ผู้สูงอายุ, PMQA
- **P3 Scale:** Field App offline, AI classification, e-Sign, Multi-tenant (shared schema+org_id+RLS), DR

---

## 9. Env Placeholders (ใส่ใน `.env.example` — ยังไม่มี code เรียกใช้จริง)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`

---

## 10. การตัดสินใจสำคัญ (Pivots)
1. **PIVOT #1:** hosting self-host VPS → Vercel + Supabase Cloud free (managed) เน้น design system
2. **Design foundation = Radix + custom Tailwind** (ร่างเอง) ไม่ใช้ shadcn — ผู้ใช้เลือก (นานกว่า แต่ควบคุม identity)
3. **Milestone แรก = design system + Storybook ก่อน** (foundation-first, ยังไม่มี app logic)
4. **PIVOT #2:** queue/cache/rate-limit/scheduler จาก DB/edge → Upstash Redis + QStash (แยกจาก DB)
5. **ผู้ใช้ปฏิเสธ Recommended ทั้ง 2** → foundation-first, deliberate, custom identity — ต้องเคารพ

---

## 11. คำสั่ง Fan-out (สำหรับ agents)

### PRD (Phase A) — ต้องครอบคลุม
- ปัญหา/บริบท/ผู้มีส่วนได้ส่วนน้อย (ประชาชน ผู้สูงอายุ ผู้ด้องโอกาส สังคมอีสาน)
- เป้าหมาย + success metrics เชิงราชการ (ระยะเวลาเฉลี่ยปิดเรื่อง, %ติดตามได้, ความพึงพอใจ)
- 6 ฟังก์ชัน + state machine + RBAC (ข้อ 4)
- Non-functional: PDPA, a11y WCAG 2.2 AA ผู้สูงอายุ, ปีงบพ.ศ., ไทย/อีสาน i18n, offline ชั่วคราว, CWV
- ข้อจำกัด free-tier + go-live criteria
- ข้อมูลต้นฉบับ → data model สูงสุด (entity list + ความสัมพันธ์)
- ความเสี่ยง + สมมติฐาน

### PRP-Plan (Phase B) — จาก PRD
- แตก milestone/phasing (ข้อ 8) เป็น deliverable + ลำดับ + dependency
- tech architecture: Next.js App Router โครงโฟลเดอร์, Supabase schema+RLS, Upstash/QStash wiring, Vercel config
- รายการไฟล์/โมดูลที่จะสร้างต่อ milestone (plan เท่านั้น — ยังไม่สร้าง)
- env var setup + secret management (ไม่ใช่ค่าจริง)
- test strategy (unit/integration/e2e/visual regression)
- deploy/CI pipeline Vercel
- go/no-go criteria + risk register

### Reviews (Phase C) — ตรวจ PRD + PRP-Plan
- **security-reviewer:** PDPA, RLS, auth, secret, OWASP, injection, บัตร 13 หลัก
- **code-reviewer/architect:** ความถูกต้อง สถาปัตย์ ไฟล์/โมดูล cohesion ขนาด
- **database-reviewer:** schema, RLS, index, bitemporal, migration safety, Supabase pooler
- **a11y-architect:** WCAG 2.2 AA, touch target, contrast, ฟอนต์ผู้สูงอายุ, i18n อีสาน
- **performance-optimizer:** CWV, bundle budget, serverless cold start, N+1, cache
- → verdict: CRITICAL/HIGH/MEDIUM/LOW + ข้อแก้ concrete

### Tracking Issues (Phase D) — สรุปเป็น backlog (planning artifact ไม่ใช่ code จริง)
- รวม deliverable จาก PRP-Plan + findings จาก reviews เป็นรายการ issue
- ฟิลด์: ID, ชื่อ, milestone, priority, ประเภท, คำอธิบาย, acceptance criteria, dependency, estimate ภาค

---

*ไฟล์นี้เป็น single source of truth สำหรับ fan-out — agents รัน isolated context จึงต้องอ่านไฟล์นี้ก่อนทำงาน*