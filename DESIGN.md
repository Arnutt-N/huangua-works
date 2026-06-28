<!-- SEED: re-run $impeccable document once tokens.css + primitives exist (M0.4/M0.5) to capture real rendered tokens and generate .impeccable/design.json sidecar. Anchor values ด้านล่างยืนยันโดยผู้ใช้แล้ว ค้าง verify contrast AA ตอน implement. -->
---
name: อบต.หัวงัว Citizen Help
description: ระบบรับเรื่องร้องเรียก/ร้องทุกข์ ตำบลหัวงัว — น่าเชื่อถือ โปร่งใส เป็นกันเอง
colors:
  surface: "oklch(98% 0.003 245)"
  surface-raised: "oklch(100% 0 0)"
  surface-sunken: "oklch(96% 0.004 245)"
  text: "oklch(22% 0.02 50)"
  text-muted: "oklch(45% 0.015 50)"
  text-on-accent: "oklch(99% 0.003 245)"
  border: "oklch(90% 0.01 245)"
  border-strong: "oklch(80% 0.015 245)"
  accent: "oklch(46% 0.13 245)"
  accent-strong: "oklch(36% 0.15 245)"
  accent-sunken: "oklch(92% 0.03 245)"
  success: "oklch(44% 0.14 145)"
  success-soft: "oklch(94% 0.04 145)"
  warning: "oklch(66% 0.14 75)"
  warning-soft: "oklch(95% 0.05 75)"
  danger: "oklch(46% 0.19 25)"
  danger-soft: "oklch(95% 0.05 25)"
  info: "oklch(46% 0.13 245)"
typography:
  display:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.4rem + 4vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 1.5vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.3vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "clamp(3rem, 2.2rem + 3vw, 6rem)"
  touch-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.text-on-accent}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "oklch(30% 0.15 245)"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-secondary-hover:
    backgroundColor: "{colors.accent-sunken}"
  input-field:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  input-field-focus:
    borderColor: "{colors.accent-strong}"
  card-surface:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  chip-status:
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    typography: "{typography.label}"
---

# Design System: อบต.หัวงัว Citizen Help

## 1. Overview

**Creative North Star: "ศาลาประชาชน"**

ระบบนี้ดูเหมือนศาลาประชาชนที่อบต.เปิดให้ชาวบ้านเข้ามาแจ้งเรื่องได้สบายใจ — สะอาด โปร่ง ไม่ขู่ให้กลัว แต่จริงจังพอให้วางใจว่าเรื่องจะถูกดำเนินการ บุคลิก 3 คำจาก PRODUCT.md ขับทุกการตัดสินใจ: **น่าเชื่อถือ · โปร่งใส · เป็นกันเอง** เส้นบาง ระยะห่างใหญ่ hierarchy ด้วย weight ไม่ใช่ ornament ไม่มี gradient ฉ่ำ ไม่มีการ์ดกระจก frosted ไม่มี cream AI-default background ที่ทุก AI สร้างในปี 2026 พื้นหลังเป็น off-white จริง (chroma ต่ำมาก ออก indigo นิดเดียว) ไม่ใช่ warm-neutral ลอยๆ

ระบบนี้ปฏิเสธชัด: default template look, SaaS hero-metric template (เลขใหญ่+label+gradient accent), identical card grids, glassmorphism-as-default, side-stripe borders, gradient text, eyebrow-all-caps-on-every-section, numbered 01-02-03 scaffolding, dark mode by default, ภาษาราชการเดิมจ๋าที่ขู่ให้กลัว Accent indigo เดียว ใช้น้อย ความหายากคือจุด — ไม่ใช่ brand ที่กระหายสี

Depth มาจาก tonal layering (surface / surface-raised / surface-sunken) + เส้นผมบาง ไม่ใช่ shadow ฟุ้ง shadow เก็บไว้ให้ overlay (dialog/popover) เท่านั้น เพราะ motion = restrained (state changes เท่านั้น ตามที่ผู้ใช้ยืนยัน) ผู้สูงอายุอีสานอ่านง่ายทุกหน้า: ฟอนต์ใหญ่ base ≥17px, touch target ≥44px, contrast AA ทุก body text รวม placeholder

**Key Characteristics:**
- Single disciplined civic indigo accent ≤10% ของหน้า
- Off-white surface จริง (ไม่ใช่ cream/sand/beige AI default)
- Noto Sans Thai เดียวหลาย weight, hierarchy ด้วย weight contrast ≥1.25
- Flat-by-default, depth ผ่าน tonal layering + hairline
- Motion นุ่มช้าชัด เฉพาะ state change, reduced-motion บังคับ
- 44px touch + AA contrast + 16pt+ เป็นขั้นต่ำ ไม่ใช่เป้า

## 2. Colors: The Civic Indigo Palette

พอดย์วนเดียว indigo ขับความน่าเชื่อถือของราชการ บน off-white ที่ไม่อบอุ่นลอยๆ — สีอื่นเฉพาะสถานะเรื่อง (success/danger/warning) ใช้แค่ badge/สถานะ ไม่ใช่ decoration

### Primary
- **Civic Indigo** (oklch(46% 0.13 245)): accent เดียวของระบบ — ปุ่ม primary, link active, focus ring, ตัวชี้สถานะ active ห้ามใช้เกิน 10% ของหน้า
- **Civic Indigo Strong** (oklch(36% 0.15 245)): สำหรับปุ่ม primary background จริง (contrast white ≥7:1 ผ่าน AAA) และ hover/active — accent ธรรมดาไม่ผ่าน AA บน white label จึงใช้ strong เป็น default ปุ่ม

### Neutral
- **Off-White Surface** (oklch(98% 0.003 245)): body background หลัก — chroma ต่ำมาก ออก indigo นิดเดียว ห้ามเป็น warm cream
- **Surface Raised** (oklch(100% 0 0)): การ์ด/field/dialog ที่ยกขึ้น — ขาวจริง
- **Surface Sunken** (oklch(96% 0.004 245)): พื้นที่กดลง (well, code block, disabled zone)
- **Warm Ink** (oklch(22% 0.02 50)): body text — หมึกอบอุ่นเล็กน้อย ไม่ใช่ดำบริสุทธิ์ อ่านสบาย contrast ~14:1 บน surface
- **Ink Muted** (oklch(45% 0.015 50)): text รอง/placeholder — ยังผ่าน AA บน surface (≥4.5:1) ห้ามลดลงไป gray-on-tint
- **Hairline Border** (oklch(90% 0.01 245)) / **Border Strong** (oklch(80% 0.015 245)): เส้นผมแยก surface ไม่ใช่ box

### Status (case state machine เท่านั้น ไม่ใช่ decoration)
- **Success** (oklch(44% 0.14 145)) + **Success Soft** (oklch(94% 0.04 145)): เสร็จ/ปิดเรื่อง
- **Warning** (oklch(66% 0.14 75)) + **Warning Soft** (oklch(95% 0.05 75)): รอดำเนินการ/ใกล้ SLA — warning ใช้ dark text บน soft
- **Danger** (oklch(46% 0.19 25)) + **Danger Soft** (oklch(95% 0.05 25)): ฉุกเฉิน/เลย SLA
- **Info** = Civic Indigo กลับมาใช้ซ้ำ (ไม่ประดิษฐ์สีใหม่)

### Named Rules
**The One Indigo Rule.** Civic Indigo ใช้ ≤10% ของหน้าจอใดๆ ความหายากคือจุดของมัน ถ้าหน้าไหน indigo มากกว่า 10% แปลว่า over-using ใช่เป็น accent ไม่ใช่ surface

**The No-Cream Rule.** พื้นหลังเป็น off-white จริง (chroma ≤0.005 ออก indigo 245 เล็กน้อย) ห้าม warm-neutral ทุกตระกูล (cream/sand/beige/bone/linen/parchment/wheat) — ความอบอุ่นมาจาก accent + typography + เนื้อหา ไม่ใช่ body bg

## 3. Typography

**Display Font:** Noto Sans Thai (fallback system-ui, sans-serif)
**Body Font:** Noto Sans Thai (fallback system-ui, sans-serif)
**Label Font:** Noto Sans Thai (weight 600)

**Character:** เดียวหลาย weight — humanist อบอุ่น อ่านง่าย สำหรับผู้สูงอายุอีสาน hierarchy ทำด้วย weight contrast (400→600→700) และ scale ratio ≥1.25 ต่อขั้น ไม่ใช่หลายตระกูลฟอนต์ที่กลืนกัน หลีกทางอันตรายของ "two similar sans" เพราะเป็นตระกูลเดียวที่ weight ต่างกัน

> Self-host woff2 subset weight 400/600/700 + font-display: swap + preload critical (H10) — **ห้าม Google Fonts CDN** โหลดเดี่ยวทุกหน้า

### Hierarchy
- **Display** (700, clamp(2.25rem→5rem), 1.1, letter-spacing -0.02em): hero/หัวข้อหลักหน้า citizen — clamp max ≤6rem (96px) ตามเพดาน ห้ามเกิน
- **Headline** (700, clamp(1.5rem→2.25rem), 1.2, -0.01em): หัวข้อ section/หน้าย่อย admin
- **Title** (600, 1.25rem, 1.3, normal): หัวการ์ด/ชื่อเรื่อง/section label
- **Body** (400, clamp(1.0625rem→1.125rem) = 17-18px, 1.6, normal): ข้อความทั้งหมด เริ่ม 17px เพื่อผู้สูงอายุ ความยาวบรรทัด 65-75ch, `text-wrap: pretty`
- **Label** (600, 0.9375rem, 1.4, letter-spacing 0.01em): ป้ายฟอร์ม/ปุ่ม/badge — title-case ธรรมดา ห้าม ALL CAPS body copy

### Named Rules
**The One Family Rule.** Noto Sans Thai ตระกูลเดียว สาม weight (400/600/700) ทำ hierarchy ด้วย weight + scale ไม่ใช่ฟอนต์หลายตระกูล ถ้ารู้สึกว่า hierarchy flat แก้ที่ weight ratio ไม่ใช่เพิ่มฟอนต์

**The Elderly Floor Rule.** body ≥17px เสมอ ถ้าออกแบบที่ 16px แล้วอ่านยากสำหรับผู้สูงอายุ ถือว่ายังไม่เสร็จ

## 4. Elevation

Flat by default — depth มาจาก tonal layering (off-white surface → white raised → sunken) และ hairline border 1px ไม่ใช่ shadow ฟุ้งๆ เพราะ motion = restrained และบุคลิก "โปร่งใส" shadow เก็บไว้ให้ overlay เท่านั้น (dialog/popover/dropdown ที่ลอยเหนือเนื้อหาจริง) เพราะ shadow ที่โผล่บนการ์ด static = SaaS ghost-card tell ที่ PRODUCT.md ห้าม

### Shadow Vocabulary
- **Overlay Shadow** (`box-shadow: 0 8px 32px rgba(20, 24, 60, 0.18)`): dialog/popover/dropdown เท่านั้น — structural (บอกว่าลอยเหนือ) ไม่ใช่ decorative
- **Focus Ring** (`box-shadow: 0 0 0 3px oklch(46% 0.13 245 / 0.35)`): focus-visible เท่านั้น เพื่อ a11y ไม่ใช่ hover

### Named Rules
**The Flat-By-Default Rule.** Surface นอนแบบ ไม่มี shadow ตอน rest shadow โผล่ตอน state (overlay/focus) เท่านั้น ถ้าการ์ดมี shadow ตอน rest = ผิด ให้แก้เป็น hairline border + tonal surface

**The One-Or-Other Rule.** ห้าม `1px solid border` + `box-shadow blur ≥16px` บน element เดียวกัน (ghost-card pattern) เลือกอย่างเดียว: hairline border หรือ overlay shadow (blur ≤8px) ไม่ใช่ทั้งคู่

## 5. Components

### Buttons
- **Shape:** 10px radius (`{rounded.md}`) ไม่ใช่ 24-32px โค้งเกิน
- **Primary:** background Civic Indigo Strong (oklch(36% 0.15 245)) + white text + padding 14px 28px + weight 600 — white-on-strong ≥7:1 ผ่าน AAA ปุ่มเดียวที่เต็ม accent ต่อหน้า
- **Hover/Active:** background ลด L ถึง oklch(30% 0.15 245), `transform: translateY(-1px)` (reduced-motion: ไม่ยก) transition 200ms expo-out
- **Focus:** focus-visible ring 3px indigo 35% (ไม่ใช่ outline กรอบเดี่ยว)
- **Secondary:** transparent + Civic Indigo Strong text + hairline border + hover = accent-sunken พื้น
- **Touch:** `min-height: 44px` บังคับ (C6) ทุก variant

### Inputs / Fields
- **Style:** background surface-raised (ขาว) + 1px hairline border + 10px radius + padding 14px 16px + body typography
- **Focus:** border เปลี่ยนเป็น accent-strong + focus ring 3px indigo 35% — ไม่ใช่ glow ฉ่ำ
- **Error:** border danger + danger-soft พื้นเบา + ข้อความ error ใต้ field weight 600
- **Label:** Noto Sans Thai 600 ข้างบน field ไม่ใช่ placeholder แทน label (placeholder = ตัวอย่างเท่านั้น contrast AA ด้วย)

### Cards / Containers
- **Corner:** 14px (`{rounded.lg}`) ไม่เกิน
- **Background:** surface-raised (ขาว) บน surface (off-white)
- **Shadow:** ไม่มี ตอน rest — แยกด้วย hairline border 1px อย่างเดียว
- **Border:** 1px hairline (oklch(90% 0.01 245)) — ไม่ใช่ border-left stripe
- **Padding:** 24px (`{spacing.lg}`)
- **Nested cards:** ห้าม (PRODUCT.md + impeccable ban) — ซ้อนแปลว่าผิด ใช้ surface ต่างกันแทน

### Chips / Status Badge (signature: CaseStatusBadge)
- **Shape:** pill radius (9999px) + padding 6px 14px + label typography (600, 0.9375rem)
- **Status mapping:** รับเรื่อง=info(indigo)/ตรวจสอบ=warning/ดำเนินการ=warning-soft+dark text/เสร็จ=success/ปิด=success-soft+dark text/ฉุกเฉิน=danger
- **State:** แต่ละสถานะ = soft พื้น + strong text ไม่ใช่ badge เต็มสี (contrast ปลอดภัย)

### Navigation
- **Top bar:** hairline border ล่าง + surface พื้น + Civic Indigo link active ห้าม underline animation ยาว
- **Mobile:** แถบล่าง touch 44px ต่อ item ไอคอน + label ใต้

### Signature: Intake Stepper (รับเรื่อง 6 ขั้น)
แสดงขั้นปัจจุบันเด่น (Civic Indigo) ขั้นผ่านแล้ว = success จาง ขั้นข้างหน้า = muted ไม่ใช่จุดยิบย่อม ใช้ bar แบน + label ใต้แต่ละขั้น อ่านง่ายผู้สูงอายุ

## 6. Do's and Don'ts

### Do:
- **Do** ใช้ Civic Indigo ≤10% ของหน้า (The One Indigo Rule) — ความหายากคือจุด
- **Do** ใช้ off-white surface จริง (oklch(98% 0.003 245)) ไม่ใช่ warm cream (The No-Cream Rule)
- **Do** ใช้ Noto Sans Thai ตระกูลเดียว weight 400/600/700 ทำ hierarchy (The One Family Rule)
- **Do** body text ≥17px เสมอ (The Elderly Floor Rule) ผู้สูงอายุอีสานอ่านได้ก่อน
- **Do** touch target ≥44px ทุก interactive element (C6) ค่า 24px = ผิดทันที
- **Do** ใช้ hairline border หรือ tonal layering แยก surface ไม่ใช่ shadow ตอน rest (The Flat-By-Default Rule)
- **Do** ใช้ Civic Indigo Strong (oklch(36% 0.15 245)) เป็น background ปุ่ม primary เพื่อ contrast white ≥7:1
- **Do** ใส่ `@media (prefers-reduced-motion: reduce)` fallback ทุก animation (crossfade/instant)
- **Do** self-host Noto Sans Thai woff2 subset + font-display: swap (ห้าม Google CDN)
- **Do** focus-visible ring 3px indigo 35% ทุก interactive (a11y คีย์บอร์ด)

### Don't:
- **Don't** ใช้ default template look (shadcn/Tailwind หน้าตาจ๋า ไม่มีจุดยืน) — PRODUCT.md ห้าม
- **Don't** ใช้ SaaS hero-metric template (เลขใหญ่ + label + gradient accent) — PRODUCT.md ห้าม
- **Don't** ทำ identical card grids (การ์ดเท่ากัน + icon + heading + text ซ้ำๆ) — PRODUCT.md ห้าม
- **Don't** ใช้ glassmorphism เป็น default (frosted card โปะเปล่า) — PRODUCT.md ห้าม
- **Don't** ใช้ cream/sand/beige/bone/linen/parchment body background (AI 2026 default) — The No-Cream Rule
- **Don't** ใช้ border-left/right >1px เป็น colored stripe — impeccable ban
- **Don't** ใช้ gradient text (`background-clip: text` + gradient) — impeccable ban
- **Don't** ใส่ tiny uppercase tracked eyebrow เหนือทุก section ("ABOUT" "PROCESS") — impeccable ban
- **Don't** เลข section 01/02/03 เป็น default scaffolding — impeccable ban (ใช้เฉพาะ sequence จริง)
- **Don't** เปิด dark mode by default — PRODUCT.md ห้าม (ผู้สูงอายุกลางวัน) dark ตั้งใจพร้อม contrast ครบเท่านั้น
- **Don't** ใช้ `1px border` + `box-shadow blur ≥16px` บน element เดียวกัน (ghost-card) — The One-Or-Other Rule
- **Don't** ใช้ border-radius 24-32px+ บน card (โค้งเกิน = codex tell) ใช้ 10-14px
- **Don't** ใช้ muted-gray-on-tint body text (contrast ต่ำ "เพื่อความหรูหรา") — สาเหตุ #1 ที่ AI design อ่านยาก
- **Don't** ใช้ภาษาราชการเดิมจ๋าที่ขู่ให้กลัว ("พิจารณาให้ดำเนินการตามระเบียบ") — PRODUCT.md ห้าม ใช้ "เจ้าหน้าที่ติดตามให้"
- **Don't** ส่งหน้าที่ "AI made that" ได้โดยไม่ต้องสงสัย — AI slop test ของ impeccable