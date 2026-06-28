# Product

## Register

brand

> Hybrid surface: citizen-facing intake เป็น primary brand surface (design IS the product — ประชาชนประเมินความน่าเชื่อถือของราชการที่นี่) admin tool ตามด้วย product discipline (design SERVES the product) คำสั่ง per-task override register ได้ แต่ PRODUCT.md ถือ default = brand.

## Users

**กลุ่มหลัก (citizen portal):**
- ประชาชนตำบลหัวงัว อ.ยางตลาด จ.กาฬสินธุ์ — โดยเฉพาะ **ผู้สูงอายุ** (สายตาเสื่อม, คุ้นเคยภาษาพูดมากกว่าอ่าน) และ **ผู้ด้องโอกาส** (สังคมอีสาน, สถานะเศรษฐกิจผันแปร)
- บริบทใช้งาน: มีเรื่องร้องเรียก/ร้องทุกข์ (ถนน ระบบระบายน้ำ งบประมาณ สวัสดิการ) ต้องการแจ้งง่าย ติดตามได้ ไม่กลัวราชการ
- ภาษา: ไทยกลางเป็นหลัก + พร้อมภาษาอีสาน (BCP-47 `th-northeast`) สำหรับกลุ่มผู้สูงอายุ

**กลุ่ม operational (admin tool, product discipline):**
- เจ้าหน้าที่รับเรื่อง (intake), ผู้รับผิดชอบดำเนินการ (assignee), ผู้บริหารตรวจสอบ (admin), ผู้ดูแลระบบ (sysadmin) — RBAC 5 บทบาท
- บริบท: รับเรื่อง → ตรวจสอบ → มอบหมาย → นัดเข้าพื้นที่ → ดำเนินการ → เสร็จ → ปิดเรื่อง + สาขา รองบประมาณ/ส่งต่อภายนอก/ฉุกเฉิน

## Product Purpose

ระบบรับเรื่องร้องเรียก/ร้องทุกข์ ของ อบต.หัวงัว — ท้องถิ่นจริง เทียบเท่า Traffy Fondue แต่เป็นของตำบล ประชาชนแจ้งเรื่องได้ด้วยตัวเอง ติดตามสถานะได้ทุกขั้น เจ้าหน้าที่ดำเนินการตาม state machine สรุปผล/งบประมาณ (กก.ทร.) ได้ ดำเนินการตามมาตรฐานราชการไทย (รหัส กก.ทร., บัตรประชาชน 13 หลัก, ปีงบประมาณพ.ศ., PDPA พ.ร.บ. 2562)

ความสำเร็จ = ประชาชนแจ้งเรื่องได้จริงโดยไม่ต้องผ่านคนกลาง + เจ้าหน้าที่ตอบ/ปิดเรื่องได้ภายใน SLA + ข้อมูลตรวจสอบได้ (audit append-only) + ประชาชนวางใจระบบ (consent + PDPA)

## Brand Personality

**น่าเชื่อถือ · โปร่งใส · เป็นกันเอง**

- Voice: พูดตรง ไม่อ้อมค้อม ไม่ใช้ศัพท์เทคนิคเกินจำเป็น ใช้ภาษาประชาชนเข้าใจ
- Tone: อบอุ่นแต่จริงจัง ไม่โปะป้ายยศ ไม่สูงศักดิ์
- Emotion: ผ่อนคลาย เชื่อมั่น กล้าแจ้งเรื่อง ไม่กลัวราชการ
- Copy: "แจ้งเรื่องร้องเรียกได้ที่นี่ เจ้าหน้าที่ติดตามให้"
- Motion: นุ่ม ช้า ชัด (fade/slide อ่อน) ไม่ฉับพลัน ไม่กระตุก

## Anti-references

สิ่งที่หน้านี้ **ต้องไม่** เป็น:
- Default template look (shadcn/Tailwind หน้าตาจ๋า ไม่มีจุดยืน)
- SaaS hero-metric template (เลขใหญ่ + label + gradient accent)
- Identical card grids (การ์ดเท่ากัน + icon + heading + text ซ้ำๆ)
- Glassmorphism เป็น default (frosted card โปะเปล่า กลบความจืด)
- Cream/sand/beige AI-default body background (warm-neutral ที่ทุก AI สร้างใน 2026)
- Side-stripe colored borders / gradient text / eyebrow-all-caps-on-every-section / numbered 01-02-03 scaffolding
- Dark mode by default (ผู้สูงอายุอีสานอ่านจอสว่าง)
- ภาษาราชการเดิมจ๋าที่ขู่ให้กลัว ("พิจารณาให้ดำเนินการตามระเบียบ")
- หน้าจอที่ "AI made that" ได้โดยไม่ต้องสงสัย

## Design Principles

1. **เข้าถึงได้จริง ไม่ใช่ดูดี** — accessibility ก่อนสุนทรียภาพ ผู้สูงอายุอีสานใช้ได้จริงก่อนค่อยสวย
2. **พูดตรง ตอบจริง** — ภาษาประชาชน สถานะเรื่องชัดทุกขั้น ไม่ทิ้งให้เดา
3. **ท้องถิ่นเป็นเจ้าของ** — เอกลักษณ์ตำบลหัวงัว/อีสาน ไม่ลอกเลียน Traffy หรือ template สากล
4. **โปร่งใส ตรวจสอบได้** — PDPA + consent + audit append-only ประชาชนรู้ว่าข้อมูลตัวเองถูกใช้อย่างไร
5. **นุ่มแต่มั่นคง** — interaction/motion อ่อนโยน แต่ระบบเชื่อถือได้ (RLS + audit + service_role route registry)

## Accessibility & Inclusion

- **WCAG 2.2 AA** เป็นขั้นต่ำ ไม่ใช่เป้าหมาย
- **Touch target ≥ 44px** (C6 enforce ทุก interactive element) — ผู้สูงอายุนิ้วหยาบ
- **Contrast AA** ทุก body text (≥4.5:1) รวม placeholder ด้วย ไม่ใช้ muted-gray-on-tint
- **ฟอนต์ใหญ่**: base ≥16pt (Sarabun/Noto Sans Thai) อ่านง่ายสายตาเสื่อม
- **อีสาน i18n-ready** (BCP-47 `th-northeast`) toggle ภาษาได้
- **Reduced motion** บังคับ: ทุก animation มี `@media (prefers-reduced-motion: reduce)` fallback
- **คีย์บอร์ด/สกรีนรีเดอร์** ครบ ไม่พึ่ง mouse/color เพียงอย่างเดียว
- **ไม่ default dark mode** (สภาพแสงผู้สูงอายุกลางวัน) แต่ dark ตั้งใจพร้อม contrast ครบ