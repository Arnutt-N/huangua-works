# PRD — อบต.หัวงัว Citizen-Help Web App
# ระบบรับเรื่องร้องเรียก/ร้องทุกข์ (Traffy Fondue ท้องถิ่น)

> **เอกสารวางแผน (planning artifact)** — ไม่ใช่ code/scaffold
> Source-of-truth: `D:\toppublic\per\docs\context-package.md` (สร้าง 2026-06-28)
> Stack อนุมัติ: Vercel + Supabase Cloud + Upstash Redis (REST) + QStash + Next.js App Router + TypeScript + Tailwind (custom tokens) + Radix UI (ร่างเอง ไม่ใช้ shadcn)
> HARD-GATE: ห้ามเขียนโค้ด/scaffold/สร้าง package.json จนกว่า design ได้รับอนุมัติ

---

## 1. ภาพรวม / ปัญหา / บริบท

### 1.1 องค์กรเจ้าของระบบ
**องค์การบริหารส่วนตำบลหัวงัว** อำเภอยางตลาด จังหวัดกาฬสินธุ์ — เป็นเจ้าภาพบริหารงาน **สรุปผลการให้ความช่วยเหลือประชาชน / ร้องเรียก ร้องทุกข์ / ขอความอนุเคราะห์** ในหมวดงาน **ถนน ระบบระบายน้ำ** ครอบคลุมพื้นที่ 13 หมู่บ้าน (บ้านเสียว ม.2/5/6, บ้านหนองกุง ม.13, บ้านโคกคันจ้อง ม.11 เป็นต้น)

### 1.2 ปัญหาเดือดปะดิ่ง
เวิร์กโฟลว์ปัจจุบันติดอยู่กับ **กระดาษ + สมุดต่าง ๆ** ส่งผลให้:
- เรื่องร้อง **สูญหาย / จม / ติดตามไม่ได้** ระหว่างเดือนและหน่วยงาน
- ประชาชน **ไม่ทราบสถานะ** และต้องแจ้งซ้ำเพราะไม่รู้ว่าเคยแจ้งแล้ว
- ผู้บริหาร อบต. **ขาดภาพรวมแบบ real-time** และรายงานสรุปผลออกช้า
- **ไม่มีกลไก tracking เชื่อมโยง** เรื่องเดียวกันข้ามเดือน

### 1.3 หลักฐานเชิงประจักษ์ (จาก `.docx` ต้นฉบับ ก.พ.–มี.ค. 2569)
| สัญลักษณ์ | ความหมายต่อสถาปัตย์ |
|---|---|
| **รายการ 100 (2 มี.ค. 2569)** นายวิชิต ภูตีนผา บ้านเสียว ม.6 — ซ่อมแซมไหล่ทางชำรุด | ปรากฏซ้ำในเดือน ก.พ. (รายการ 50 — น้ำรางระบายและน้ำเน่าเสีย) → สะท้อน **ไม่มี dedup/tracking เชื่อมโยง** |
| **รายการ 344 (27 ก.พ. 2569)** "อำเภอยางตลาด" เป็นผู้ร้อง — คลองไส้ไก่ สายโนนแดง **งบ 100,000 บาท** | (a) หน่วยงานต้องเป็น **ผู้ร้องได้** (b) ต้องมี **structured budget field + รหัส กก.ทร.** |
| **รายการ 88 (26 ก.พ. 2569)** ผู้รับผิดชอบ 3 คน (นายอัครพล เจริญขุน / น.ส.ยฎา เบญญพรพรรณ / น.ส.กนกภรณ์ โพธิ์สิงห์) | ผู้รับผิดชอบเป็น **many-to-many** (list) ไม่ใช่ 1:1 |
| **ไฟล์ 2** แยกคอลัมน์ "ประเภทปัญหา" ออกจาก "รายละเอียด" | เป็น **taxonomy seed** ที่จะขยายเป็น ~30 หมวดแบบ Traffy |
| เลขหนังสือรับ 100/344/105/113/50/88/95/96 | **natural key** สำหรับ lookup/dedup ข้ามปีงบพ.ศ. |
| วันที่ "2 มี.ค. 2569" | ใช้ **พุทธศักราช (พ.ศ. = ค.ศ.+543)** + เดือนไทย |

### 1.4 วิสัยทัศน์ผลิตภัณฑ์
ระบบรับเรื่องร้องเรียก/ร้องทุกข์แบบ **citizen-facing + admin full-stack** เทียบเท่า **Traffy Fondue แต่ท้องถิ่นจริง** ปฏิบัติตามมาตรฐานราชการไทย: รหัส กก.ทร., บัตรประชาชน 13 หลัก, ปีงบพ.ศ., PDPA พ.ร.บ. 2562 และภาษาท้องถิ่น (ไทย/อีสาน)

---

## 2. เป้าหมาย + Success Metrics

### 2.1 เป้าหมายผลิตภัณฑ์ (Outcome)
1. แทนที่เวิร์กโฟลว์กระดาษด้วยระบบดิจิทัลที่ติดตามได้ตลอดสาย
2. มอบสถานะเรื่องแบบ real-time แก่ประชาชนและผู้บริหาร
3. ลดเรื่องซ้ำซ้อนด้วยการตรวจสอบก่อนรับใหม่ (dedup ด้วย natural key + taxonomy)
4. รายงานสรุปผลต่อเดือน/ไตรมาสออกได้ภายในวันสุดท้ายของงวด (เทียบเอกสารสรุปปัจจุบัน)

### 2.2 Success Metrics (วัดได้ มี baseline)
| KPI | เป้าหมาย | baseline |
|---|---|---|
| ระยะเวลาเฉลี่ยปิดเรื่อง | ≤ **30 วัน** | กระดาษ — ไม่วัดได้ (ไม่มี timestamp) |
| %เรื่องติดตามได้ตลอดสาย (ทุก status มี audit) | ≥ **95%** | กระดาษ — 0% |
| ความพึงพอใจประชาชน (หลังปิดเรื่อง สเกล 1–5) | ≥ **4/5** | ไม่เคยวัด |
| %เรื่องซ้ำลดลง (ตรวจก่อนรับใหม่) | ลด **≥ 30%** ภายใน 6 เดือน | เดือนละ 1–2 เรื่องซ้ำเดือนข้ามต้นฉบับ |
| รายงานสรุปผลออกทันเดือน | **100%** ภายในวันสุดท้ายของเดือน | ปัจจุบันหลายสัปดาห์ |
| ระยะเวลาอนุมัติงบ (เช่น 100,000 บาท คลองไส้ไก่) | ≤ **7 วันทำการ** | กระดาษ — ไม่แน่ชัด |

### 2.3 ตัวชี้วัดคุณภาพที่ไม่ใช่เชิงปริมาณ
- ประชาชนกลุ่มผู้สูงอายุสามารถแจ้งเรื่องเองได้โดยไม่ต้องให้ผู้อื่นกรอกแทน (validate ใน P0.5 dry-run)
- เจ้าหน้าที่ intake ใช้เวลาค้นเลขหนังสือรับ + จัดประเภท + มอบหมาย ≤ 5 นาทีต่อเรื่อง

---

## 3. ผู้มีส่วนได้ส่วนน้อย + Personas

### 3.1 กลุ่มผู้มีส่วนได้ส่วนน้อย (Equity Focus — บังคับออกแบบ)
- **ประชาชนทั่วไปในตำบลหัวงัว 13 หมู่บ้าน** — ส่วนใหญ่ใช้สมาร์ตโฟนราคาประหยัด เน็ตช้า แสงจ้ากลางวัน มอเตอร์ฟีนจำกัด
- **ผู้สูงอายุ** — touch target ≥44px, contrast AA, ฟอนต์ฐาน Sarabun/Noto Sans Thai 16pt, ซูม 200% ได้
- **ผู้ด้องโอกาส/คนพิการ/ไม่มีสมาร์ตโฟน** — ต้องยื่นแทนกันได้ด้วยบัตร 13 หลักของผู้แจ้ง และติดตามทางเบอร์โทร/LINE
- **สังคมอีสาน** — ภาษาหน้าจอต้องเป็นไทยเข้าใจง่าย + ภาษาอีสาน i18n-ready ห้ามใช้ภาษาราชการแข็งทื่อ
- **หน่วยงานส่งต่อ** (อำเภอยางตลาด) — ไม่ใช่ปัจเจกแต่ต้องเป็นผู้ร้องได้ โดยไม่เก็บ CID

### 3.2 Personas
| Persona | บทบาท RBAC | ความต้องการหลัก | บริบท |
|---|---|---|---|
| **ลุงวิชิต ภูตีนผา** (67 ปี บ้านเสียว ม.6) | citizen / ผู้สูงอายุ | แจ้งซ่อมไหล่ทางด้วยเสียง/ภาพ ดูสถานะอักษรใหญ่ ไม่กรอกยาว | เคยแจ้งซ้ำข้ามเดือน (รายการ 50→100) |
| **น.ส.ปรายวิณี ภูมั่น** (บ้านเสียว ม.5) | citizen แจ้งซ้ำ | ดูประวัติเรื่องเดิมของตน ไม่ต้องแจ้งใหม่ (รายการ 95/96) | แจ้ง 2 เรื่องในวันเดียว |
| **นางกุหลาบ จันทราช** (บ้านหนองกุง ม.13) | citizen | แนบรูปท่ออุดตัน ติดตามผล | รายการ 105 |
| **เจ้าหน้าที่ intake** | intake | ค้นเลขหนังสือรับ ตรวจซ้ำ จัดประเภท มอบหมายหลายผู้รับผิดชอบ | ทำงานที่ อบต. |
| **นายอัครพล / น.ส.ยฎา / น.ส.กนกภรณ์** | assignee | รับมอบหมาย บันทึกผล แนบรูป | รายการ 88 — กองช่าง |
| **นายก อบต.** | admin | อนุมัติงบ 100,000 ดูรายงาน KPI เดือน/ไตรมาส | ผู้บริหาร |
| **sysadmin** | sysadmin | จัดผู้ใช้/หน่วยงาน/taxonomy + ดูแลระบบ | ไอที อบต. |

### 3.3 User Stories (ตัวอย่างตามบทบาท)
- **citizen (ผู้สูงอายุ):** แจ้งซ่อมไหล่ทางด้วยเสียง/ภาพ ไม่กรอกที่อยู่ใหม่ (auto-fill) ดูสถานะเรื่อง 100 ของตนในอักษรใหญ่
- **citizen (ด้องโอกาส):** ญาติแจ้งแทนด้วยบัตร 13 หลักผู้แจ้ง ติดตามทางเบอร์โทร
- **intake:** ค้นเลขรับ 344 พบเรื่องอำเภอส่งต่อ จัดประเภท "คลองส่งน้ำ" มอบหมาย 3 ผู้รับผิดชอบ
- **assignee:** รับมอบหมาย บันทึกผล + งบ 100,000 แนบรูป ส่งคืน intake
- **admin:** อนุมัติงบ ดู KPI รายเดือน + ส่งออก CSV (watermark + audit)
- **sysadmin:** สร้างผู้ใช้/หน่วยงาน แก้ taxonomy ดู retention job

---

## 4. ฟังก์ชัน + State Machine + RBAC

### 4.1 ฟังก์ชันหลัก 6 ข้อ
| # | ฟังก์ชัน | ผู้ใช้หลัก | Output |
|---|---|---|---|
| 1 | **รับเรื่อง** citizen + หน่วยงานส่งต่อ | citizen / intake (ส่งต่อ) | `complaint` + `book_receipt` + `complainant` (polymorphic) |
| 2 | **ตรวจสอบ + จัดประเภท** taxonomy ~30 หมวด | intake | `complaint.category_id` + dedup check |
| 3 | **มอบหมายผู้รับผิดชอบ** (เจ้าหน้าที่/หน่วยงาน/กองช่าง many-to-many) | intake | `assignment` rows (role + ลำดับเวลา) |
| 4 | **นัดเข้าพื้นที่** | intake/assignee | `action(type=follow_up, occurred_at)` |
| 5 | **ดำเนินการ + บันทึกผล + งบ กก.ทร.** | assignee | `action` + `outcome` + `budget(ggor_code, amount)` |
| 6 | **ปิดเรื่อง + สรุป + ส่งกลับ** | admin/intake | `complaint.status=closed` + notify citizen |

### 4.2 State Machine
```
รับเรื่อง → ตรวจสอบ → มอบหมาย → นัดเข้าพื้นที่ → ดำเนินการ → เสร็จ → ปิดเรื่อง
```
**สาขา (branch):**
- `รองบประมาณ` — เมื่อต้องเบิกงบ (เช่น 100,000 บาท) รอ admin อนุมัติ
- `ส่งต่อภายนอก` — เมื่อเรื่องอยู่นอกอำนาจ อบต. (ส่งอำเภอ/จังหวัด)
- `ฉุกเฉิน` — fast-track ข้ามขั้น "นัดเข้าพื้นที่"

ทุกการเปลี่ยน state บันทึกใน `audit_log` (append-only) + ส่ง `case_events` Realtime

### 4.3 RBAC (5 บทบาท)
| บทบาท | สิทธิ์ (RBAC + RLS) |
|---|---|
| **citizen** | ยื่น/ติดตาม/ดูเรื่องของตนเท่านั้น (`complaint.created_by = auth.uid()`) — ไม่เห็น note ภายใน |
| **intake** | รับ + จัดประเภท + มอบหมาย ใน `org_id` ที่ตนสังกัด |
| **assignee** | ดำเนินการ + บันทึกผล เฉพาะเรื่องที่ตนอยู่ใน `assignment` |
| **admin (นายก อบต.)** | เห็นทั้งหมดใน `org_id` + อนุมัติงบ + รายงาน |
| **sysadmin** | จัดผู้ใช้/หน่วยงาน/taxonomy — bypass RLS (service role เท่านั้น) |

### 4.4 Scope ใน/นอก
**MVP (P1):** รับเรื่อง/ติดตาม + admin + notification + SLA escalation (QStash) + taxonomy seed + a11y ผู้สูงอายุ + PDPA consent + งบ กก.ทร.

**Later (P2–P3):** LINE LIFF, Live Chat + Telegram, จองคิวนัดช่าง, PMQA, Field App offline, AI classification, e-Sign, Multi-tenant, DR

---

## 5. ข้อกำหนดสถาปัตย์

### 5.1 โครงสร้างระดับสูง (4 ชั้น แยกส่วน)
| ชั้น | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Edge / CDN | Vercel Edge Network | Static asset, image optimization, WAF, geolocation |
| Serverless Functions | Vercel Node.js / Edge Runtime (Next.js App Router) | SSR, API route, BFF, webhook receiver |
| Data + Auth | Supabase Cloud (Postgres + Auth + RLS + Realtime + Storage + Edge Fn) | Source-of-truth DB, identity, row policy, attachment bucket |
| Async + Cache | Upstash Redis (REST) + QStash (HTTP push) | Rate-limit, hot cache, scheduled job, SLA escalation, dead-letter |

**เหตุผลเลือก:** Vercel ตอบ Thai-first cold start ต่ำ; Supabase รวม DB/Auth/RLS/Realtime ใน tier เดียว; Upstash REST (ไม่ใช่ RESP/TCP) fit serverless ที่ไม่ถือ connection ถาวร; QStash push-based ตรง model serverless ไม่ต้องเปิด long-poll

### 5.2 โครงโฟลเดอร์ proposed (many-small-files, 200–400 บรรทัด/ไฟล์, ≤800)
```
src/
  app/
    (public)/              # citizen + ผู้ใช้ทั่วไป
      page.tsx              # landing + ยื่นเรื่อง
      track/[caseNo]/page.tsx
    (admin)/
      cases/page.tsx        # queue งาน intake
      cases/[id]/page.tsx    # รายละเอียด + timeline + ปิดเรื่อง
      reports/page.tsx      # สรุปผล + งบ กก.ทร.
      orgs/page.tsx         # หน่วยงาน + บุคลากร bitemporal
    api/
      cases/route.ts        # intake endpoint
      cases/[id]/events/route.ts
      webhooks/qstash/route.ts
      webhooks/supabase/route.ts
  modules/
    cases/  taxonomy/  address/  budget/  consent/
  lib/
    supabase/{server,client,admin}.ts
    upstash/{redis,qstash}.ts
    thai-date.ts            # พ.ศ. = ค.ศ.+543, BE locale
  components/ui/            # Radix primitives ร่างเอง (ไม่ใช้ shadcn)
  styles/tokens.css         # oklch + clamp typography
```

### 5.3 Supabase wiring
- **Connection:** serverless ใช้ pooler URL port 6543 (transaction mode) ผ่าน `@supabase/ssr` (cookie session + RLS); service role เฉพาะ Edge Fn ที่ต้องข้าม RLS (cron ปิดเรื่องค้าง)
- **RLS:** policy per role + per org (sysadmin ทุกตาราง; admin `org_id` ตรง; assignee `assignment.assignee_id = auth.uid()`; citizen `complaint.created_by = auth.uid()`); `audit_log` append-only ห้าม UPDATE/DELETE
- **Realtime:** subscribe `case_events` channel สำหรับ timeline live update ใน `cases/[id]`
- **Storage:** bucket `case-attachments` + RLS path `{org_id}/{case_id}/...`
- **Edge Function:** `close-stale-case` cron ตาม SLA + `notify-assignee` ที่ push QStash

### 5.4 Upstash Redis + QStash wiring
- **Redis REST (port 443):** rate-limit (`@upstash/ratelimit` sliding window), cache taxonomy seed (~30 หมวด), cache address lookup, dedup `เลขหนังสือรับ` (composite natural key ต่อปีงบ) — ทุก command ภายใน 10,000/day free tier
- **QStash:** schedule SLA escalation (เช่น เรื่องงบ 100,000 บาท ต้อง escalate หาก overdue), notify LINE LIFF/P2, dead-letter retry; webhook → `api/webhooks/qstash` มี signature verify (`QSTASH_CURRENT_SIGNING_KEY`)

### 5.5 Data Flow รับเรื่อง → ปิดเรื่อง
```
Citizen ยื่น → API /cases (SSR+BFF) → Supabase INSERT case+event (RLS)
  → DB webhook → QStash enqueue "classify+assign"
  → Edge Fn จัดประเภท + มอบหมายผู้รับผิดชอบ (many-to-many)
  → Realtime push timeline หน้า admin
  → assignee ดำเนินการ + บันทึกผล/งบ กก.ทร.
  → QStash SLA timer → admin ปิดเรื่อง → notify citizen
```

### 5.6 ความเร็ว / สเกล
- Edge SSR สำหรับ public page; ISR สำหรับ taxonomy/address; cache hit Redis ลด DB hit
- Bundle budget: landing <150kb gz, admin <300kb gz
- Cold start ลดด้วย Edge Runtime บน route ที่อ่าน Redis/Supabase เท่านั้น
- Scale path: 10K → สถาปัตย์ปัจจุบัน; 100K → Redis cluster + Supabase Pro; 1M → read replica + CQRS event sourcing (P3)

### 5.7 Integration Points
- กรมการปกครอง address API (P1) — seed จว./อ./ต./ม.
- LINE LIFF (P2) — OAuth bridge สู่ Supabase Auth
- กก.ทร. e-budget (P3) — export JSON ตามรูปแบบจำนวนเงินของรายการ 344

---

## 6. ข้อกำหนดด้านข้อมูล + DB

### 6.1 Entity List
| Entity | คำอธิบาย | Key fields |
|---|---|---|
| `complaint` | เรื่องร้อง (core) | `book_no` (natural key ต่อปีงบ), `fiscal_year` (พ.ศ.), `received_at`, `category_id`, `status`, `org_id` |
| `complainant` | ผู้ร้อง **polymorphic** | `complaint_id`, `party_type` (`citizen`/`agency`), `person_id` NULL, `agency_id` NULL, `address_id` |
| `person` | เจ้าหน้าที่/ประชาชน | `cid` (13 หลัก, encrypted at rest + hash index), `full_name`, `role`, `org_id` |
| `agency` | หน่วยงาน **bitemporal** | `code`, `name`, `parent_id`, `valid_from`/`valid_to`, `is_current` |
| `person_tenure` | บุคลากร **bitemporal** | `person_id`, `org_id`, `position`, `valid_from`/`valid_to` |
| `assignment` | ผู้รับผิดชอบ **many-to-many** | `complaint_id`, `person_id`/`agency_id`, `assigned_at`, `assigned_by`, `role` (`intake`/`assignee`/`reviewer`) |
| `action` | การดำเนินการ | `complaint_id`, `seq`, `actor_id`, `type` (`inspect`/`repair`/`follow_up`), `note`, `occurred_at` |
| `outcome` | ผลการดำเนินงาน | `complaint_id`, `action_id`, `result_text`, `closed_at` |
| `budget` | งบประมาณ/กก.ทร. | `complaint_id`, `ggor_code`, `amount` (`numeric(14,2)`), `fiscal_year`, `source` |
| `address` | ที่อยู่กรมปกครอง | `province_code`/`district_code`/`subdistrict_code`/`village_code`, `moo`, `place_name`, `lat`/`lng` |
| `taxonomy` | ประเภทปัญหา | `code`, `label_th`, `parent_id`, `sort` — seed ~30 หมวด |
| `book_receipt` | หนังสือรับ | `book_no` + `fiscal_year` (composite natural key), `received_at`, `channel` (`counter`/`agency_forward`/`LINE`) |
| `audit_log` | **append-only** | `id`, `entity`, `entity_id`, `actor_id`, `action`, `before`/`after` (jsonb), `at` — ไม่มี UPDATE/DELETE policy |

### 6.2 ความสัมพันธ์
- `complaint 1—N complainant` (polymorphic: `citizen`→`person`, `agency`→`agency`)
- `complaint N—N person/agency` ผ่าน `assignment` (มี role + ลำดับเวลา)
- `complaint 1—N action 1—1 outcome` (สายดำเนินการ)
- `complaint 1—N budget` (รองรับหลายงบในเรื่องเดียว)
- `complaint N—1 taxonomy`, `complaint N—1 address`
- `person 1—N person_tenure N—1 agency` (bitemporal chain)
- `complaint 1—1 book_receipt` (natural key lookup)

### 6.3 RLS (Row Level Security) — per role + per org
เปิด RLS ทุกตารางที่มี `org_id`/`person_id`/ข้อมูลส่วนบุคคล ใช้ `(SELECT auth.uid())` pattern (ไม่เรียกฟังก์ชัน per-row)

| บทบาท | Policy ตัวอย่าง |
|---|---|
| citizen | `complaint.created_by = auth.uid()` (เฉพาะเรื่องตน + สถานะ ไม่เห็น note ภายใน) |
| intake | `org_id IN (SELECT org_id FROM person_tenure WHERE person_id = auth.uid() AND is_current)` |
| assignee | เห็น `complaint` ที่ตนอยู่ใน `assignment` |
| admin | เห็นทั้งหมดใน `org_id` + สิทธิ์อนุมัติ `budget` |
| sysadmin | bypass RLS (service role เท่านั้น) |

`person.cid` เข้ารหัส + column-level RLS (เฉพาะ service role/admin เห็นเต็ม; intake เห็น masked)

### 6.4 Index เบื้องต้น
- `complaint(book_no, fiscal_year)` UNIQUE (natural key lookup — เลขรับ 100/344/105/113)
- `complaint(status)` partial `WHERE deleted_at IS NULL`
- `complaint(category_id, received_at DESC)` (รายงานตามหมวด + เดือน)
- `complaint(org_id, status)` (RLS fast path)
- `assignment(complaint_id, assigned_at)`
- `book_receipt(book_no, fiscal_year)` UNIQUE
- `address(village_code, moo)` (lookup บ้านเสียว ม.6)
- `person_tenure(person_id, valid_to DESC)` partial `WHERE valid_to IS NULL` (current tenure)
- `audit_log(entity, entity_id, at DESC)` (timeline)
- FK index ทุกตัว (`complaint_id`, `person_id`, `org_id`, `category_id`)
- `ggor_code` index สำหรับรายงานงบประมาณ/กก.ทร.

### 6.5 Retention & PDPA (พ.ร.บ. 2562)
- `complaint` และ `audit_log` เก็บ **10 ปี** (ตามกฎหมายราชการ) — `retention_until` column
- ข้อมูลส่วนบุคคล (CID, ที่อยู่, เบอร์) มี `consent_at` + `consent_scope` แยกตามน้ำหนัก (necessary vs optional)
- สิทธิ์ access/erase → job QStash ประมวลผล `erasure_request` (pseudonymize ไม่ delete เพราะกฎหมายราชการบังคับเก็บ)
- `complainant` citizen ใช้ data minimization: ไม่เก็บเบอร์/ที่อยู่เกินความจำเป็น

---

## 7. ข้อกำหนดความเข้าถึง + a11y (WCAG 2.2 AA)

### 7.1 มาตรฐานยอมรับ (บังคับ)
ถือปฏิบัติ **WCAG 2.2 Level AA** เป็น baseline บังคับ ครอบ 4 หลักการ POUR และ success criteria ใหม่ที่กระทบผู้สูงอายุ: **2.4.11 Focus Appearance (Minimum)**, **2.4.13 Focus Not Obscured**, **2.5.7 Dragging Movements**, **2.5.8 Target Size (Minimum)**, **3.3.7 Redundant Entry**, **3.3.8 Accessible Authentication (Minimum)**

### 7.2 ขนาดสัมผัสและระยะห่าง
- ทุก interactive element บนหน้า citizen-facing มี hit area ≥ **44×44 CSS px** (ใช้ 44 ตาม native/ผู้สูงอายุ ไม่ใช้ 24 ขั้นต่ำของ 2.5.8)
- ระยะห่างระหว่าง target ≥ **8 px** (กัน mis-tap มือสั่น)
- ปุ่มใกล้ขอบจอเว้น inset ≥ **12 px** จาก safe area

### 7.3 คอนทราสต์ + Typography ผู้สูงอายุ
- คอนทราสต์ข้อความ ≥ **4.5:1**; UI border/icon สถานะ ≥ **3:1** (SC 1.4.11) — สถานะ "รองบประมาณ/ฉุกเฉิน" ต้องมี text label คู่กับสีเสมอ ห้ามใช้สีเป็นสัญลักษณ์เดียว
- ฟอนต์หลัก **Sarabun** หรือ **Noto Sans Thai** ขนาดฐาน **16 pt / 1rem** บนมือถือ ซูม 200% ได้ (SC 1.4.4) reflow 400% ไม่เกิด scroll แนวนอน (SC 1.4.10)
- line-height ≥ 1.5 สำหรับ body; ย่อหน้า ≤ 80 ตัวอักษร

### 7.4 คีย์บอร์ด + สกรีนรีเดอร์
- ทุกส่วนปฏิบัติการได้เข้าถึงด้วยคีย์บอร์ด/สวิตช์ 100% (SC 2.1.1) รวมแผนที่ pin จุดเกิดเหตุ (มีทางเลือกป้อนพิกัดเป็น text แทน drag)
- Focus indicator: หนา ≥ 2 px, คอนทราสต์ ≥ 3:1, ไม่ถูกบดบังโดย sticky header (SC 2.4.11/2.4.13)
- ลำดับ focus ตาม reading order ไทย (ซ้าย→ขวา บน→ลง); modal มี focus trap + คืน focus ไป trigger เดิม
- ทุก non-text content มี text alternative: รูปประกอบเรื่องร้องมี `alt`; icon-only button มี `aria-label` ภาษาไทย
- `aria-live="polite"` สำหรับสถานะ real-time; `aria-live="assertive"` สำหรับข้อผิดพลาด validation

### 7.5 ลดภาระสมอง (Understandable)
- ภาษาหน้าจอใช้ **ไทยราชการเข้าใจง่าย** เป็นค่าเริ่มต้น; toggle เปลี่ยนเป็น **ภาษาอีสาน** (i18n-ready) ไม่ใช่ word-for-word แต่ต้องเป็นถ้อยคำที่ชาวบ้านหัวงัวใช้จริง
- แบบฟอร์มเป็น multistep สั้น + breadcrumb บอกขั้นปัจจุบัน/ถัดไป
- หลีกเลี่ยงกรอกซ้ำ (SC 3.3.7) — ชื่อ/ที่อยู่ที่กรอกตอนแจ้ง auto-fill ตอนติดตาม
- label/hint/error ระบุตำแน่งผิดเป็น text + ไอคอน + ประโยคแนะนำวิธีแก้ (SC 3.3.1/3.3.3)
- Authentication ไม่บังคับ puzzle คิด (SC 3.3.8) — ใช้ OTP ผ่าน SMS/LINE เป็นหลัก

### 7.6 ภาษาและ i18n (อีสาน)
- `lang="th"` บน `<html>` เป็นค่าเริ่มต้น; เลือกอีสานแล้วสลับ `lang` ตาม dialect tag ที่เหมาะสม + แยก string catalog เป็น namespace `th` / `th-northeast`
- สลับภาษาโดยไม่ reload และคงค่าใน localStorage
- คำศัพท์ราชการเฉพาะ ("เลขหนังสือรับ", "งบประมาณ กก.ทร.", "บัตรประชาชน 13 หลัก") มี glossary tooltip อธิบายเป็นภาษาเรียบง่าย

### 7.7 Motion ลดลง
- เคารพ `prefers-reduced-motion: reduce` ทุก animation/transition (SC 2.3.3) — ปิด parallax ลด scroll-driven
- ไม่กระพริบเกิน 3 ครั้ง/วินาที (SC 2.3.1)
- ตัวเลือก "ลดการเคลื่อนไหว" เปิดเป็นค่าเริ่มต้นสำหรับโปรไฟล์ผู้สูงอายุ

### 7.8 แผนทดสอบ a11y
| ระดับ | เครื่องมือ | ขอบเขต |
|---|---|---|
| อัตโนมัติ | axe-core + Storybook a11y addon | ทุก component ใน Milestone 0 |
| คีย์บอร์ด | สคริปต์ tab/shift+tab ด้วยมือ | flow ยื่นเรื่อง + ติดตาม + admin |
| สกรีนรีเดอร์ | NVDA (Windows), VoiceOver (iOS Safari) | ทุก label + live region |
| คอนทราสต์ | WCAG Color Contrast analyser | ทุก token ใน light/dark |
| ผู้ใช้จริง | ผู้สูงอายุตำบลหัวงัว ≥ 5 คน | ใน P0.5 Dry-run |
| Visual regression | Playwright screenshot 320/768/1024/1440 + ซูม 200% | ตาม web/testing.md |

**Definition of Done (a11y):** axe ไม่มี violation ระดับ critical/serious, คีย์บอร์ดผ่าน 100%, contrast ผ่านทุกหน้าจอ, ผ่านการทดสอบผู้ใช้จริงใน P0.5

### 7.9 ADR-ACC-001: Thai-first a11y baseline
- **Decision:** ใช้ touch target 44×44 px, ฟอนต์ฐาน 16pt Sarabun/Noto Sans Thai, คอนทราสต์ AA ทุกหน้า, รองรับภาษาอีสาน i18n — เพื่อรองรับผู้สูงอายุและผู้ด้องโอกาสในตำบลหัวงัวเป็นผู้ใช้หลัก ไม่ใช่กรณีพิเศษ

---

## 8. ข้อกำหนดความมั่นคงปลอดภัย + PDPA (พ.ร.บ. 2562)

### 8.1 ภาพรวม
ระบบเก็บข้อมูลส่วนบุคคลที่ละเอียดอ่อน — ชื่อผู้ร้อง, ที่อยู่ระดับหมู่บ้าน, เลขหนังสือรับ, เลขบัตรประชาชน 13 หลัก — จึงอยู่ภายใต้ **PDPA พ.ร.บ. 2562** โดยตรง และต้องปฏิบัติตามมาตรฐานราชการไทย (รหัส กก.ทร.)

### 8.2 การจัดการบัตรประชาชน 13 หลัก
- **Validate รูปแบบ:** ตรวจ checksum เลขหลักที่ 13 (algorithm กรมการปกครอง) ฝั่ง server เสมอ ไม่เชื่อ client
- **Mask ใน UI/log:** แสดงเฉพาะ `x-xxxx-xxxxxx-x` เก็บ 4 หลักท้าย; ห้าม log full CID ใน audit/console
- **Encrypted-at-rest:** เก็บในคอลัมน์ `pgcrypto` แยกจาก lookup field (เก็บ hash index สำหรับค้น ไม่เก็บ plaintext)
- **Data minimization:** เก็บ CID เฉพาะเมื่อจำเป็นตามกฎหมาย (เช่น งบ กก.ทร. 100,000 บาท) — มี toggle ให้ผู้ร้องปฏิเสธเมื่อไม่บังคับ

### 8.3 PDPA Consent + สิทธิเจ้าข้อมูล
- **Consent flow:** หน้ายื่นเรื่องมี checkbox แยก (a) เก็บ/ประมวลผลข้อมูล (b) ส่งต่อให้หน่วยงานภายนอก (เช่น อำเภอยางตลาด) — บันทึก timestamp + version ของ consent text
- **Right to access/erase:** ประชาชนดูเรื่องของตน (RBAC citizen) และขอลบ/แก้ข้อมูลได้ภายใน 30 วัน; workflow "คำร้องขอลบข้อมูล" ในระบบ (เก็บ audit ตามกฎหมาย ห้ามลบ log)
- **Retention:** เก็บเรื่องร้อง 10 ปี (ตามกฎหมายราชการ) + แยกตามประเภท (งบประมาณเก็บนานกว่า); scheduled job (QStash) ลบ/ทำลายหลังหมดอายุ
- **ผู้ร้องที่เป็นหน่วยงานส่งต่อ** (เช่น "อำเภอยางตลาด") ใช้ entity `complainant` แยก (`party_type=agency`) — ไม่เก็บ CID

### 8.4 Authentication & Authorization
- **Auth:** Supabase Auth; citizen ใช้ OTP/LINE LIFF (P2), เจ้าหน้าที่ใช้ email + password policy แรง (min 12, zxcvbn)
- **MFA (บังคับ P0):** TOTP สำหรับ admin/sysadmin/intake (มองเห็นข้อมูลทั้งหมด + อนุมัติงบ); assignee/citizen ทางเลือก
- **Session:** short-lived JWT + refresh rotation; ห้ามเก็บ token ใน localStorage (ใช้ httpOnly cookie)
- **RBAC + RLS:** ทุก query ผ่าน Supabase RLS policy ตามบทบาท + org_id; service_role key ใช้ server-only ห้าม expose ฝั่ง client
- **Authz check ทุก route:** middleware ตรวจสิทธิ์ทุกหน้า admin; citizen เห็นเฉพาะเรื่องของตน

### 8.5 OWASP Top 10 (สำหรับ Next.js + Supabase + Postgres)
| # | ข้อ | มาตรการ |
|---|---|---|
| A1 | Injection | ใช้ Supabase client parameterized + RPC; ห้าม string concat SQL |
| A2 | Broken Auth | MFA + password policy + brute-force lock (Upstash) |
| A3 | Sensitive Data | TLS ทุกที่; CID/PDPI encrypted-at-rest; ห้าม return ใน error message |
| A5 | Broken Access | RLS + route middleware; ตรวจ org_id ทุก mutation |
| A7 | XSS | React auto-escape; ห้าม `dangerouslySetInnerHTML` กับ free-text "การดำเนินการ"; sanitizer สำหรับ rich text |
| A8 | Insecure Deser. | ตรวจ webhook signature QStash (`QSTASH_CURRENT_SIGNING_KEY`) ทุกคำขอ; ปฏิเสธ unsigned |
| A9 | Vuln Deps | `npm audit --audit-level=high` ใน CI; Dependabot รายสัปดาห์ |
| A10 | SSRF | ห้าม `fetch(userProvidedUrl)` โดยตรง; whitelist domain อำเภอ/หน่วยงาน |

### 8.6 Rate Limiting & Abuse
- Upstash Redis sliding-window: citizen ยื่นเรื่อง ≤5 ครั้ง/ชม. (anti-spam); login ≤10 ครั้ง/10 นาที; API admin ≤100 req/นาที
- Honeypot + reCAPTCHA ทางเลือก (เลี่ยง CAPTCHA หนัก — ผู้สูงอายุอีสานใช้ยาก)
- แจ้งเตือน intake เมื่อมีการสแกน/ลองเลขหนังสือรับเกิน threshold

### 8.7 Secret Management
- ใช้ env เท่านั้น (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `QSTASH_*`); `.env.example` ใส่ placeholder ไม่ใส่ค่าจริง
- **`secrets\` + `.claude/settings.local.json`** ต้องอยู่ใน `.gitignore` เสมอ (มี credential)
- `SUPABASE_SERVICE_ROLE_KEY` ใช้ server-only (Route Handler/Server Action) — ไม่ prefix `NEXT_PUBLIC_`; validate required secrets ตอน boot, fail fast ถ้าขาด
- ไม่ commit ค่าจริง; หมุนเมื่อรั่ว; ไม่ใช้ `dangerously-skip-permissions`

### 8.8 Audit & ความเป็นส่วนบุคคล
- **Audit log append-only:** บันทึกทุกการอ่าน/เขียน/ส่งต่อ/อนุมัติงบ (เช่น งบ 100,000 บาท คลองไส้ไก่) — actor, target, before/after, IP, timestamp; ห้ามแก้/ลบ (RLS deny delete)
- **Log sanitization:** ไม่ log CID/password/token/full PII; ใช้ mask
- **Privacy by default:** หน้ารายการ admin ซ่อนชื่อ-ที่อยู่เบื้องหลัง blur จนกว่าจะมีสิทธิ์เจาะจง; export CSV มี watermark + audit

### 8.9 Severity Summary
| ระดับ | ข้อ | การจัดการ |
|---|---|---|
| CRITICAL | CID encrypted + masked, MFA admin, secret ไม่ commit, RLS ทุก query | **บล็อก go-live** |
| HIGH | consent flow, right-to-erase, QStash signature, rate-limit, audit append-only | แก้ก่อน P0 |
| MEDIUM | retention policy, log sanitization, dep audit | เสร็จใน P1 |
| LOW | honeypot, CSV watermark | พิจารณา P2 |

---

## 9. Non-Functional Requirements

### 9.1 Core Web Vitals (CWV)
| Metric | เป้าหมาย |
|---|---|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| FCP | < 1.5s |
| TBT | < 200ms |

### 9.2 Bundle Budget
| หน้า | JS (gz) | CSS |
|---|---|---|
| Landing (public) | < 150kb | < 30kb |
| Admin page | < 300kb | < 50kb |

### 9.3 ปีงบพุทธศักราช (พ.ศ.)
- ทุกวันที่ใน UI/รายงาน ใช้ **พ.ศ.** (พ.ศ. = ค.ศ.+543) + เดือนไทย
- ใน DB ใช้ `timestamptz` (ISO) แปลงเป็นพ.ศ. ฝั่ง presentation เท่านั้น (`lib/thai-date.ts`)
- `fiscal_year` ใช้พ.ศ. ตามราชการไทย

### 9.4 ภาษา + i18n
- ค่าเริ่มต้น: `lang="th"` (ไทยราชการเข้าใจง่าย)
- Toggle: ภาษาอีสาน (`th-northeast`) — แยก string catalog namespace; สลับโดยไม่ reload; คงค่าใน localStorage
- คำศัพท์ราชการเฉพาะมี glossary tooltip
- ไม่ใช้ word-for-word translation ต้องเป็นถ้อยคำที่ชาวบ้านหัวงัวใช้จริง (validate กับชุมชน — risk ในข้อ 11)

### 9.5 Offline ชั่วคราว / เครือข่ายจำกัด
- **P1:** ฟอร์มยื่นเรื่องทนต่อการขาดสัญญาณชั่วคราว (ใช้ `localStorage` draft + sync เมื่อ online) — ไม่ใช่ full offline
- **P3:** Field App offline (PWA + sync conflict resolution) — out of scope MVP
- ภาพแนบเรื่องอัปโหลดได้บนเน็ตช้า (compress ฝั่ง client + resume upload)

### 9.6 ประสิทธิภาพ serverless
- Cold start ลดด้วย Edge Runtime บน route ที่อ่าน Redis/Supabase เท่านั้น
- ISR สำหรับ taxonomy/address; cache hit Redis ลด DB hit
- ไม่เปิด connection ถาวรใน serverless (ใช้ pooler URL port 6543 + Upstash REST)

### 9.7 การแจ้งเตือน
- **P1:** อีเมล + SMS (ผ่าน third-party) สำหรับ citizen; อีเมล/in-app สำหรับ admin
- **P2:** LINE LIFF + Telegram
- ทุก notification บันทึกใน audit_log + มี opt-out ตาม PDPA

---

## 10. ข้อจำกัด Free-tier + Go-live Criteria

### 10.1 ธงแดง Free-tier
| บริการ | Free | จำกัด | การย้าย tier |
|---|---|---|---|
| Supabase | 500MB DB / 1GB storage / 50k MAU / **auto-pause 7 วัน** | เมื่อใกล้เต็มหรือ go-live → **Pro $25/ด** |
| Upstash Redis | 1 DB / **10,000 cmd/day** / 256MB / req ≤1MB | in-memory cache + hot-lookup เท่านั้น — ถ้า job ถี่ → QStash Pro |
| QStash | ~200 msg/day | SLA escalation ถี่ต้อง **Pro** |
| Vercel | Hobby | **ห้ามเชิงพาณิชย์** → go-live ต้อง **Pro $25/ด** |

### 10.2 กลยุทธ์ mitigation
- **Supabase auto-pause 7 วัน:** QStash schedule ping ทุก 6 ชม. เพื่อ maintain warm (หรือ Vercel cron)
- **Upstash 10,000 cmd/day:** จำกัด cache hit pattern — taxonomy/address ใน `stale-while-revalidate`; ไม่ใช้ Redis เก็บ session ถาวร
- **QStash 200 msg/day:** SLA timer เฉพาะเรื่องงบ > 50,000 บาท หรือ overdue > 7 วัน (filter ฝั่ง producer)

### 10.3 Go-live Criteria (P0 → P0.5 → P1)
**P0 Foundation (BLOCK go-live):**
- [ ] DB schema + migration + RLS policy ทุกตาราง
- [ ] Supabase Auth + MFA (admin/sysadmin/intake)
- [ ] `audit_log` append-only (RLS deny UPDATE/DELETE)
- [ ] address/taxonomy seed (~30 หมวด + 13 หมู่บ้าน)
- [ ] PDPA consent flow (checkbox แยก necessary/optional + version)
- [ ] งบ กก.ทร. structured field + validation
- [ ] Secret management (.env.example + `.gitignore` `secrets\`/`.claude`)
- [ ] CI: `npm audit --audit-level=high`, lint, type-check
- [ ] a11y: axe ผ่าน 0 critical/serious; คีย์บอร์ด 100%; contrast ผ่าน

**P0.5 Dry-run & Training:**
- [ ] ข้อมูลจริง 8 รายการต้นฉบับ (100/344/105/113/50/88/95/96) ครบ
- [ ] อบรมเจ้าหน้าที่ intake + assignee ≥ 5 คน
- [ ] ทดสอบผู้ใช้จริง ผู้สูงอายุ ≥ 5 คน
- [ ] แก้ไขภาษาอีสานตาม feedback ชุมชน

**P1 MVP Core:**
- [ ] รับเรื่อง/ติดตาม + admin + notification
- [ ] SLA escalation (QStash)
- [ ] รายงานสรุปผลเดือน/ไตรมาสออกทันเดือน
- [ ] Vercel Pro + Supabase Pro + (QStash Pro ถ้าจำเป็น)

---

## 11. ความเสี่ยง + สมมติฐาน

### 11.1 สมมติฐาน
1. ประชาชนมีโทรศัพท์/ญาติแทนได้ (ไม่ต้องเป็นผู้ใช้สมาร์ตโฟน 100%)
2. เจ้าหน้าที่ อบต. รับอบรมได้ใน P0.5 (ไม่ใช่ผู้ใช้เทคโนโลยีเชี่ยวชาญ)
3. อำเภอยางตลาด ให้ความร่วมมือในการส่งต่อเรื่องเข้าระบบ
4. กรมการปกครอง address API เสถียรและครอบคลุมตำบลหัวงัว
5. งบประมาณ อบต. รองรับการย้าย Vercel/Supabase/Upstash เป็น Pro ($25/ด × 2–3 บริการ)

### 11.2 ความเสี่ยง + แผน mitigation
| # | ความเสี่ยง | ระดับ | Mitigation |
|---|---|---|---|
| R1 | Supabase auto-pause 7 วัน → DB ไม่เข้าถึง | HIGH | QStash ping ทุก 6 ชม. + monitoring + Pro เมื่อ go-live |
| R2 | Upstash 10,000 cmd/day ไม่พอ | MEDIUM | จำกัด cache pattern + stale-while-revalidate + Pro เมื่อเกิน |
| R3 | ข้อมูลบัตร 13 หลักรั่ว → PDPA violation | **CRITICAL** | encrypted-at-rest + column-level RLS + mask + audit append-only + MFA |
| R4 | ภาษาอีสานที่ใช้ไม่ตรงกับชุมชนจริง | MEDIUM | validate กับผู้สูงอายุ ≥ 5 คนใน P0.5 + iterate |
| R5 | ผู้สูงอายุใช้ฟอร์มดิจิทัลไม่ได้ | HIGH | a11y 44px + ฟอนต์ 16pt + ซูม 200% + dry-run ผู้ใช้จริง |
| R6 | Vercel Hobby ห้ามเชิงพาณิชย์ → ถูกระงับ | HIGH | Pro $25/ด ก่อน go-live (ไม่ใช่ optional) |
| R7 | เจ้าหน้าที่ไม่ยอมเปลี่ยนจากกระดาษ | MEDIUM | อบรม P0.5 + แสดงคุณค่าผ่าน KPI + สำรองกระดาษขนาน |
| R8 | QStash 200 msg/day ไม่พอสำหรับ SLA | MEDIUM | filter ฝั่ง producer (เฉพาะงบ > 50,000 หรือ overdue > 7 วัน) + Pro |
| R9 | การส่งต่อหน่วยงานภายนอกไม่ตอบกลับ | LOW | tracking "ส่งต่อภายนอก" + escalation + ไม่ block ปิดเรื่อง |
| R10 | Dependency มีช่องโหว่ (A9) | MEDIUM | `npm audit` ใน CI + Dependabot + lockfile |
| R11 | ข้อมูลต้นฉบับซ้ำซ้อนข้ามไฟล์ (ไฟล์ 1 vs ไฟล์ 2) | LOW | dedup ด้วย `book_no + fiscal_year` เป็น natural key |
| R12 | Multi-tenant P3 ทำลาย RLS ปัจจุบัน | LOW | ออกแบบ `org_id` ตั้งแต่ P0 (shared schema) เพื่อ scale |

### 11.3 ความเสี่ยงที่ยังไม่ได้ quantified
- ความสามารถของ Edge Function Supabase ในงาน cron ปิดเรื่องค้าง (ต้อง validate ใน P0)
- ประสิทธิภาพ Realtime subscription ในหน้า admin เมื่อมีหลายเรื่อง concurrent (monitor ใน P0.5)

---

## ภาคผนวก: อ้างอิง
- **Source-of-truth:** `D:\toppublic\per\docs\context-package.md`
- **ไฟล์ต้นฉบับ .docx:** `1.ถนน ระบบระบายน้ำ.docx`, `สรุปผลการให้ความช่วยเหลือประชาชน รวมประเ.docx`
- **ปรัชญา stack:** Vercel + Supabase + Upstash Redis (REST) + QStash + Next.js App Router + Radix UI (ร่างเอง ไม่ใช้ shadcn) + Tailwind tokens
- **Phasing:** M0 (design system + Storybook) → P0 (foundation, BLOCK go-live) → P0.5 (dry-run + training) → P1 (MVP) → P2 (growth) → P3 (scale)
- **ปรัชญา:** foundation-first, deliberate, custom identity (ผู้ใช้ปฏิเสธ Recommended ทั้ง 2 — ต้องเคารพ)