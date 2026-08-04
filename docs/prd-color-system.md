# PRD — Color System Hardening

> สถานะ: reviewed (แก้ตามผลรีวิว 2026-08-04) · เกี่ยวข้อง: `DESIGN.md` §2, `src/styles/tokens.css`, `scripts/check-contrast.ts`
> ต่อจาก PR #55 (emerald → blue) และ #56 (favicon/themeColor + contrast 6 จุด)

---

## 1. ภาพรวม / ปัญหา / บริบท

### 1.1 ที่มา

PR #55 เปลี่ยน palette หลักจาก emerald 160° เป็น blue 255° การเปลี่ยนครั้งนั้นเปิดโปงว่าระบบสีมีสองชั้นที่ไม่เชื่อมกัน — ชั้นที่ถูกออกแบบ (`tokens.css` + `check-contrast.ts` + `DESIGN.md`) กับชั้นที่หลุดออกมา (ค่าดิบที่เขียนตรงในโค้ด)

หลังจากนั้นต้องมี #56 ตามเก็บอีกรอบ (favicon ยังเขียว, contrast 6 จุดตกเกณฑ์) และการสำรวจเพื่อทำ PRD ฉบับนี้ **ยังพบของตกค้างเพิ่มอีก** — เป็นสัญญาณว่าปัญหาไม่ได้อยู่ที่ "ลืมแก้" แต่อยู่ที่ไม่มีอะไรบอกได้ว่ามีอะไรให้แก้บ้าง

### 1.2 ปัญหา

| # | ปัญหา | หลักฐาน | ผลกระทบ |
|---|---|---|---|
| P1 | **ขอบปุ่ม secondary ตกเกณฑ์ WCAG** | `intake-form.tsx:277` ใช้ `oklch(80% 0.015 255)` = **1.81:1** ขณะที่ `--color-border-strong` = 3.26:1 | ผิด WCAG 1.4.11 (ต้อง ≥3:1) — อยู่ใน production |
| P2 | **ไอคอน "ถนน" ใช้สีเต็มบนพื้น soft** | `Services.tsx:27-28` ใช้ `oklch(60% 0.22 25)` บน `oklch(95% 0.05 25)` = **3.61:1** | บั๊กคลาสเดียวกับที่ #56 แก้ใน `labels.ts` แต่จุดนี้ตกสำรวจ — `tokens.css:61-65` มีกฎว่าบนพื้น `*-soft` ต้องใช้ `*-ink` เท่านั้น |
| P3 | **อีเมลรีเซ็ตรหัสผ่านยังเป็นสี palette เก่า** | `mail.ts:60` → `background:#0d9488` (teal) | ผู้ใช้ได้รับอีเมลที่สีไม่ตรงกับเว็บ — favicon ซ้ำรอบสอง และ ESLint rule ที่ไล่จับ `oklch(` จับไม่ได้เพราะเป็น hex |
| P4 | **Storybook แสดงบนพื้นหลังผิดสี** | `.storybook/preview.tsx:20-21` ใช้ hue **245** ไม่ใช่ 255 | ทุก story ตรวจ component บนพื้นที่ไม่ตรงกับของจริง — ค่าตกค้างจาก palette ก่อนหน้าที่ #55 ไม่ได้หมุน |
| P5 | **gate ตรวจไม่ถึงที่ที่บั๊กอยู่** | `check-contrast.ts:70-88` parse เฉพาะ `--color-*` ใน `tokens.css` | สีที่เขียนดิบในโค้ดไม่มีอะไรตรวจเลย — สาเหตุรากของ P1, P2 และของ contrast 1.52:1 ที่แก้ใน #56 |
| P6 | **gate ไม่ได้ต่อกับ workflow ไหน** | `ci.yml` ไม่มี step `check-contrast`; ไม่มี husky/lint-staged; Actions ถูกปิดด้วยเหตุผลค่าใช้จ่าย | ต้องจำเองว่าต้องรัน |
| P7 | **สีเดียวกันถูกพิมพ์ซ้ำ 76 จุด** | `oklch(` ใน `.tsx` = 76 จุด/7 ไฟล์ (+`.mesh-gradient` 4, `shadow-accent-glow` 1, `icon.svg` 3, `seed.ts` 5, `preview.tsx` 2) | เปลี่ยนสีครั้งหน้าต้องไล่แก้มืออีก และมีโอกาสตกหล่นเหมือนที่เกิดกับ favicon/mail.ts |
| P8 | **token หลายคู่มีค่าชนกัน** | `info ≡ accent` (light), `accent-gold ≡ warning`, `accent-gold-soft ≡ warning-soft`, `accent-sunken ≡ surface-sunken` (light เท่านั้น — dark ต่าง!) | เลือกผิดตัวแล้ว light ดูปกติ ไป drift เฉพาะ dark; และเป็นบั๊กแบบเดียวกับที่ accent เคยชนกับ success |
| P9 | **inline ไม่ตอบสนองธีม** | `Services.tsx:55` ตั้งพื้นทั้ง section เป็น `oklch(96% 0.02 255)` (สว่าง 96%) | **ใน dark mode section "บริการ" เป็นพื้นสว่างอยู่ตอนนี้** — การย้ายไป token จะแก้บั๊กนี้ ไม่ใช่ regression |

### 1.3 ทำไปแล้ว (ไม่อยู่ใน scope)

PR #55 (palette + หมุน hue), PR #56 (favicon, themeColor, contrast 6 จุด, documentation drift)

---

## 2. เป้าหมาย + Metrics

### 2.1 เป้าหมาย

1. **ไม่มีคู่สีไหนตกเกณฑ์ WCAG AA** รวมคู่ที่เกิดจากค่าดิบซึ่ง gate ปัจจุบันมองไม่เห็น
2. **เปลี่ยนสีครั้งหน้าแก้ที่เดียว** — เท่าที่เป็นไปได้ (ข้อจำกัดจริงอยู่ใน §4.2)
3. **บั๊กสีถูกจับก่อน merge โดยไม่พึ่งความจำคน** ในสภาพที่ Actions ปิดอยู่

### 2.2 Metrics

| ตัวชี้วัด | ก่อน | เป้าหมาย |
|---|---|---|
| `oklch(` literal ใน `.tsx` | **76 จุด / 7 ไฟล์** | 0 |
| คู่สีที่ gate ตรวจ | 16 คู่ (เฉพาะ token) | 16 + คู่ใหม่จาก token ที่เพิ่ม |
| gate ที่รันโดยไม่ต้องสั่งเอง | ไม่มี | รันใน `vitest` ทุกครั้ง |
| ขอบปุ่ม secondary (P1) | 1.81:1 | ≥3:1 |
| ไอคอน "ถนน" (P2) | 3.61:1 | ≥4.5:1 |
| ความครอบคลุมของ visual check | ตาคน | Playwright screenshot + axe |

### 2.3 คำสั่งตรวจ

```bash
pnpm typecheck && pnpm lint && pnpm vitest run --exclude '**/*.integration.test.ts' && pnpm check-contrast
pnpm build   # ต้องตามด้วยการ grep CSS ที่ออกมา — build ผ่านไม่ได้แปลว่า utility ถูก generate
npx playwright test e2e/visual.spec.ts
```

หนี้ lint 21 error จาก #52 อยู่นอก scope — เกณฑ์คือ **ไม่มี error ใหม่**

---

## 3. ขอบเขต

### 3.1 In-scope

1. แก้ contrast ที่ตกเกณฑ์ — P1, P2 และค่า border ที่ค้างจากก่อนแก้ contrast รอบก่อน
2. แก้สี palette เก่าที่ยังส่งถึงผู้ใช้ — P3 (`mail.ts`), P4 (`preview.tsx`)
3. เติม accent scale เฉพาะขั้นที่มี call site จริง
4. ย้าย `oklch(` ทั้ง 76 จุดไปใช้ token/utility
5. ปิดจุดบอดของ gate — ESLint rule + ย้าย gate เข้า vitest
6. housekeeping `tokens.css`

### 3.2 Out-of-scope (ตัดสินใจแล้ว ไม่ใช่มองข้าม)

| รายการ | เหตุผล |
|---|---|
| `scripts/seed.ts` 5 จุด | เป็น **data** ไม่ใช่ presentation — เขียนลงคอลัมน์ `departments.color` ใน DB การแก้ต้อง migrate ข้อมูล production ด้วย เป็นงานคนละชนิด → ใส่ allowlist พร้อมเหตุผล |
| `src/lib/line/messages/flex.ts` | LINE Flex รับแต่ hex อ้าง CSS var ไม่ได้ เป็นระบบสีชุดที่สองที่ต้องออกแบบการผูกกับ token ต่างหาก |
| `public/icon.svg` | SVG static อ้าง CSS var ไม่ได้ — #56 แก้ค่าให้ตรงแล้ว เหลือแค่ความเสี่ยง drift ซึ่งบรรเทาด้วย comment |
| `layout.tsx` themeColor | meta tag ไม่รองรับ oklch — #56 แก้แล้วพร้อม comment |
| หนี้ lint 21 error, บั๊ก broadcast, เปิด Actions | คนละเรื่อง |

> P3/P4 ต่างจากรายการข้างบนตรงที่เป็น **ค่าผิด** ไม่ใช่ **ข้อจำกัดเชิงเทคนิค** จึงอยู่ใน scope

### 3.3 Acceptance Criteria

| # | เกณฑ์ | วิธีตรวจ |
|---|---|---|
| A1 | ไม่มี `oklch(` literal ใน `.tsx`/`.ts` นอก allowlist | `pnpm lint` — ต้องไม่มี error ใหม่นอกเหนือหนี้ 21 ตัวเดิม |
| A2 | P1 ขอบปุ่ม ≥3:1 · P2 ไอคอนถนน ≥4.5:1 | คำนวณด้วยสูตรเดียวกับ `check-contrast.ts` ก่อน/หลัง |
| A3 | ทุก token ที่เพิ่มอยู่ใน sRGB gamut | สคริปต์ตรวจ gamut (ดู §4.1) |
| A4 | คู่สีใหม่ผ่านเกณฑ์ | `pnpm check-contrast` |
| A5 | gate รันเองใน `vitest` | `pnpm vitest run` เห็นผลของ contrast test |
| A6 | เปลี่ยน `--color-accent` แล้วสีตามหมด **ยกเว้นรายการใน §3.2** | เปลี่ยนค่าชั่วคราว → grep หาจุดที่ค้าง |
| A7 | หน้าตา **light theme** ไม่เปลี่ยนนอกจากที่ตั้งใจ | `npx playwright test e2e/visual.spec.ts` เทียบ baseline |
| A8 | จุดที่หน้าตาเปลี่ยนต้องมีบรรทัดอธิบายใน `docs/color-migration-notes.md` | รีวิว — จุดที่เปลี่ยนโดยไม่มีบรรทัดรองรับ = regression |
| A9 | axe `color-contrast` = 0 violations ทั้ง light และ dark | `AxeBuilder` ใน visual spec |

---

## 4. ข้อกำหนด

### 4.1 Accent scale — เติมเฉพาะขั้นที่มี call site

**ข้อเท็จจริงเรื่อง gamut ที่ต้องรู้ก่อน:** ที่ hue 255 chroma สูงสุดที่ sRGB รับได้ขึ้นกับ lightness — ค่าที่เกินจะถูก browser gamut-map ให้เอง (ลด chroma) ซึ่งแปลว่า **ตัวเลขใน token ไม่ใช่สีที่ผู้ใช้เห็น** และ `check-contrast.ts` ใช้ naive clipping ต่อ channel จึงรายงานคลาดจากที่ browser ทำเล็กน้อย

| L | chroma สูงสุด (sRGB) |
|---|---|
| 97% | 0.014 |
| 94% | 0.029 |
| 90% | 0.049 |
| 83% | 0.086 |
| 72% | 0.148 |
| 60% | 0.198 |
| 51% | 0.168 |
| 46% | 0.152 |
| 42% | **0.139** |
| 35% | 0.116 |

**`--color-accent-strong` ปัจจุบัน (`42% 0.16`) เกิน gamut อยู่แล้ว** — ไม่ใช่ของใหม่ แต่ต้องบันทึกไว้ ไม่แก้เพราะการแก้จะทำให้สีที่ใช้จริงขยับ

**token ที่จะเพิ่ม** (เฉพาะที่มี call site — ตอบ Q2 ที่รีวิวท้วงว่าเดิมขัดกับ YAGNI ที่ใช้ตอบ Q1):

| token | ค่า | call site |
|---|---|---|
| `--color-accent-100` | `oklch(94% 0.029 255)` | 13 จุดที่ใช้ `oklch(94% 0.04 255)` — 0.04 เกิน gamut อยู่แล้ว browser render เป็น ~0.029 ดังนั้น **สีที่เห็นไม่เปลี่ยน** |
| `--color-accent-200` | `oklch(90% 0.049 255)` | `Hero.tsx:67` ที่ใช้ `oklch(90% 0.05 255)` |
| `--color-accent-700` | `oklch(46% 0.152 255)` | hover ของปุ่ม primary (ยังไม่มี call site — เพิ่มเพราะเป็นคู่ที่ขาดของ 600/800 ที่มีอยู่แล้ว) |

`--color-accent` (51% 0.16) และ `--color-accent-strong` (42% 0.16) **คงชื่อและค่าเดิมทุกประการ ไม่ทำ alias** — รีวิวชี้ว่า alias จะทำให้ `check-contrast.ts:79` (regex บังคับค่าเป็น `oklch(`) หา token ไม่เจอ แล้ว fail 10 คู่ทันที การไม่แตะจึงเลี่ยงปัญหาทั้งหมดโดยไม่ต้องแก้ script

การเพิ่มขั้นอื่นในอนาคต: บันทึกวิธีไว้ใน `DESIGN.md` §2 พร้อมตาราง gamut ข้างบน

### 4.2 ESLint rule

```js
'no-restricted-syntax': ['error',
  { selector: 'Literal[value=/oklch/]', message: '...' },
  { selector: 'TemplateElement[value.raw=/oklch/]', message: '...' },
]
```

- **ห้ามเขียน `/oklch\(/` ในสตริง** — ใน `.mjs` backslash จะถูกกลืน ทำให้ esquery สร้าง `new RegExp('oklch(')` แล้ว **crash ทั้ง lint run** ใช้ `/oklch/` เฉย ๆ ซึ่งเฉพาะเจาะจงพอ
- ต้องมีสอง selector — `TemplateLiteral` ไม่ใช่ `Literal` node
- comment ไม่ใช่ AST node จึงไม่โดนจับ (มี comment ที่มีคำนี้จริงใน `schema.ts:140`, `layout.tsx:74-75`)
- **allowlist:** `scripts/**` (seed.ts เป็น data, check-contrast.ts ต้อง parse), `.storybook/**`
- ข้อความ error ต้องบอกทางแก้ ไม่ใช่แค่ห้าม

### 4.3 ตารางแมป inline → token

นับจริง 76 จุด (เอกสารเดิมเขียน ~60 ซึ่งต่ำไป 27%)

| ค่า | จำนวน | แทนด้วย | หน้าตาเปลี่ยน? |
|---|---|---|---|
| `oklch(51% 0.16 255)` | 19 (+3 มี alpha) | `text-accent` / `bg-accent` (+`/10`, `/30`) | เหมือนเดิม |
| `oklch(94% 0.04 255)` | 13 | `bg-accent-100` | เหมือนเดิม (0.04 เกิน gamut อยู่แล้ว) |
| `oklch(96% 0.02 255)` ±alpha | 7 | `bg-surface-sunken` — **ยกเว้น** `Hero.tsx:315,353` ที่ความหมายเป็น accent → `bg-accent-sunken` | light เหมือน / **dark ต่าง** (P8) |
| `oklch(42% 0.16 255)` | 6 (+1 alpha) | `text-accent-strong` / `bg-accent-strong` | เหมือนเดิม |
| `oklch(45% 0.12 70)` | **5** | `text-warning-ink` | เหมือนเดิม |
| `oklch(95% 0.05 80)` | 5 | **`bg-warning-soft`** ไม่ใช่ `accent-gold-soft` — ทั้ง 5 จุดคู่กับ `warning-ink` ถ้าแมปเป็น gold จะหลุดจากคู่ที่ `check-contrast.ts:55` เฝ้าอยู่ | เหมือนเดิม (ค่าเท่ากันทั้งสองธีม) |
| `oklch(99% 0.005 255)` | 3 | `bg-surface` หรือ `text-on-accent` ตามบริบท | เหมือนเดิม |
| `oklch(90% 0.01 255)` | 3 | `border-border` | **ตั้งใจให้ต่าง** — ค่าเดิมก่อนแก้ contrast (L90→85) |
| `oklch(80% 0.015 255)` | 2 | `border-border-strong` | **ตั้งใจให้ต่าง** — P1 (L80→64) |
| `oklch(82% 0.14 80)` ±alpha | 2 | `bg-accent-gold` (+`/10`) | เหมือนเดิม |
| `oklch(60% 0.22 25)` | 1 | **`text-danger-ink`** ไม่ใช่ `text-danger` | **ตั้งใจให้ต่าง** — P2 |
| `oklch(95% 0.05 25)` | 1 | `bg-danger-soft` | เหมือนเดิม |
| `oklch(50% 0.02 255)` | 1 | `text-muted` | **ตั้งใจให้ต่าง** (L50→47) |
| `oklch(90% 0.05 255)` | 1 | `border-accent-200` | เกือบเหมือน (0.05→0.049) |
| `oklch(96% 0.01 255 / 0.5)` | 1 | `bg-surface-sunken/50` | เกือบเหมือน (chroma เพี้ยน 0.01→0.02) |
| `oklch(100% 0 0 / 0.2)`, `/0.3` | 2 | **คงเป็น literal** — `--color-surface-raised` ไม่ใช่สีขาวใน dark การแทนจะทำให้ dark พัง; `tokens.css` เองก็ทำแบบนี้ใน `.glass` | — |

**alpha variant ไม่มี gate คุ้มครอง** — `check-contrast.ts:164-167` ข้ามคู่ที่มี alpha โดยเจตนา ต้องบันทึกไว้

### 4.4 housekeeping `tokens.css`

- **`shadow-accent-glow`** — `tokens.css:424` (`0 10px 40px -10px / 0.3`) กับ `--shadow-glow-accent` (`:109`, `0 0 40px -10px / 0.5`) **ค่าไม่เท่ากัน** การเปลี่ยนให้อ้าง var จะทำให้เงาปุ่มเปลี่ยนทั่วระบบ 9 call site → **แก้ `--shadow-glow-accent` ให้เท่ากับค่าของ utility แทน** แล้วค่อยให้ utility อ้าง var
- **`.mesh-gradient`** — เปลี่ยนเป็น `color-mix(in oklab, var(--color-accent) 12%, transparent)` ได้จริง (Baseline ตั้งแต่ 2023) ปิด P7 และทำให้ A6 เป็นจริง แทนที่จะแก้แค่ comment
- **`--color-info`** — ลบ (ไม่มี consumer; `toast.tsx` มี variant ชื่อ `info` แต่ map ไป `bg-surface-raised` ไม่ได้ใช้ token) ต้องลบ 3 ที่: `:59`, `:135`, `@theme inline :166` + `DESIGN.md:25`

### 4.5 gate เข้า vitest

`pretest` ใช้ไม่ได้ — `ci.yml:46` เรียก `pnpm vitest run` ตรง ๆ ไม่ผ่าน `pnpm test` จึงไม่ trigger lifecycle hook

แทนด้วย `src/styles/tokens.contrast.test.ts` ที่ import ตรรกะจาก `check-contrast.ts` แล้ว assert `failures === 0` ต้อง refactor script ให้ export ฟังก์ชันแทนที่จะ `main()` + `process.exit()` ทันที (`:203`) — โปรเจกต์ใช้ colocated test อยู่แล้ว (`cn.test.ts`, `roles.test.ts`)

เพิ่ม step `pnpm check-contrast` ใน `ci.yml` ด้วย แม้ Actions ปิดอยู่ (**ไม่นับเป็น gate** — เผื่อวันที่เปิดกลับ)

---

## 5. ความเสี่ยง

| # | ความเสี่ยง | ระดับ | การรับมือ |
|---|---|---|---|
| R1 | หน้าตาเพี้ยนโดยไม่รู้ตัว | HIGH | `playwright.config.ts` + `@axe-core/playwright` **มีอยู่แล้วในโปรเจกต์** ใช้ `toHaveScreenshot()` + `AxeBuilder` ได้ทันทีโดยไม่ต้องพึ่ง Actions |
| R2 | Tailwind ไม่ generate utility ของ token ใหม่ | HIGH | **`next build` ไม่ error** เมื่อ utility ไม่มีอยู่ — มันเงียบ ต้อง grep `.next/static/css/*.css` ยืนยันหลัง build |
| R3 | ย้าย token ผิดตัวระหว่าง `surface-sunken` / `accent-sunken` | MEDIUM | light เท่ากันเป๊ะ dark ต่าง → ตรวจ dark ด้วย axe ไม่ใช่ screenshot |
| R4 | dark mode เปลี่ยนทุกจุด | ยอมรับ | inline ไม่ตอบสนองธีมอยู่แล้ว (P9) การเปลี่ยนคือการแก้บั๊ก — baseline screenshot จับเฉพาะ light |
| R5 | ESLint rule crash | MEDIUM | ห้าม escape `\(` ในสตริง selector (§4.2) |
| R6 | lint ที่แดงอยู่แล้ว 21 error ทำให้ error ที่ 22 ไม่มีใครเห็น | MEDIUM | A1 วัดที่ "ไม่มี error ใหม่" ไม่ใช่ "lint เขียว" — เป้าหมาย §2.1 ข้อ 3 จะบรรลุเต็มที่ก็ต่อเมื่อล้างหนี้ 21 ตัว (งานแยก) |

---

## 6. สมมติฐานที่ตรวจแล้ว

| สมมติฐาน | ผล |
|---|---|
| Tailwind v4 generate utility จาก `@theme inline` | ✅ จริง — token ที่ไม่ผ่านบล็อกนี้ไม่ได้ utility (เช่น `--gradient-accent` ต้องประกาศ `@utility` เอง) |
| `next build` fail ถ้า utility ไม่มี | ❌ **ไม่จริง** — เงียบ ต้อง grep CSS |
| alias ทำงานกับ `check-contrast.ts` | ❌ **ไม่จริง** — regex บังคับค่าเป็น `oklch(` → เลี่ยงด้วยการไม่ทำ alias |
| `pretest` ทำให้ gate รันอัตโนมัติ | ❌ **ไม่จริง** — CI เรียก vitest ตรง |
| ESLint จับ `.storybook/**` | ⚠️ ต้องตรวจตอน implement — ถ้าจับต้อง allowlist |
