# PRP-Plan — Color System Hardening

> อ้างอิง: `docs/prd-color-system.md` (ฉบับ reviewed) · branch: `feat/color-system-hardening`

---

## Dependency Graph

```
T1 (แก้บั๊กที่อยู่ใน production)  ── อิสระ ส่งได้ทันที ไม่ต้องรอใคร
     │
T0 (token + gate refactor) ──┬─► T2 (ย้าย inline: 6 ไฟล์)
     │                       │        │
     └─► T0.5 (visual baseline) ──────┤
                                      ├─► T3a (Hero)
                                      ├─► T3b (HeroTrackingCard)
                                      │        │
                                      └────────┴─► T4 (ESLint + gate เข้า vitest)
```

**ข้อบังคับด้านลำดับ**

1. **T4 ต้องหลัง T2/T3** — เปิด rule ก่อนย้ายเสร็จ = lint error 76 จุดพร้อมกัน (ทางเลือก: เปิดเป็น `warn` ที่ T0 แล้วเลื่อนเป็น `error` ที่ T4 เพื่อได้ signal เร็วโดยไม่บล็อก)
2. **T0.5 ต้องหลัง T1** — baseline ต้องถ่ายจากสถานะที่แก้บั๊กแล้ว ไม่งั้นจะ freeze บั๊กไว้ใน snapshot
3. **T1 ไม่ขึ้นกับ T0** — ใช้เฉพาะ token ที่มีอยู่แล้ว (`border-strong`, `border`, `danger-ink`, `surface-sunken`)

---

## T1 — แก้บั๊กที่อยู่ใน production

ส่งแยกได้ทันที เป็น tranche เดียวที่กระทบผู้ใช้จริงตอนนี้

| ไฟล์ | บรรทัด | แก้ | ผล |
|---|---|---|---|
| `src/app/intake/intake-form.tsx` | 277 | `oklch(80% 0.015 255)` → `border-border-strong` | **1.81 → 3.26:1** (P1, WCAG 1.4.11) |
| `src/app/intake/intake-form.tsx` | 507 | ค่าเดียวกัน (dashed dropzone) | inactive component — ไม่ผิดกฎ แต่แก้ให้สม่ำเสมอ |
| `src/components/landing/Services.tsx` | 27 | `oklch(60% 0.22 25)` → `text-danger-ink` | **3.61 → 6.58:1** (P2) |
| `src/lib/mail.ts` | 60 | `#0d9488` → `#0049a1` | P3 — อีเมลยังส่งปุ่มสี palette เก่า |
| `.storybook/preview.tsx` | 20-21 | hue 245 → ใช้ `var(--color-surface)` (ไฟล์ import `tokens.css` อยู่แล้วที่บรรทัด 2) | P4 |

**Test:** คำนวณ contrast ก่อน/หลังด้วยสูตรของ `check-contrast.ts` · ดูปุ่ม "กลับหน้าหลัก" บนหน้า intake ที่ส่งสำเร็จ · เปิด Storybook ดูพื้นหลัง

**Risk:** ขอบเข้มขึ้นชัด (L80→64) แต่เป็นค่าที่ระบบตั้งใจอยู่แล้ว ปุ่ม secondary ที่อื่นใช้ค่านี้ — เป็นการทำให้ตรงกัน ไม่ใช่เปลี่ยนดีไซน์

---

## T0 — Token + gate refactor

| การกระทำ | ไฟล์ | รายละเอียด |
|---|---|---|
| MODIFY | `src/styles/tokens.css` | เพิ่ม `--color-accent-100/200/700` (ค่า gamut-safe ตาม PRD §4.1) + dark counterpart |
| MODIFY | `src/styles/tokens.css` | map ทั้งสามเข้า `@theme inline` — **ถ้าไม่ทำ T2/T3 จะพังเงียบ** |
| MODIFY | `src/styles/tokens.css` | แก้ `--shadow-glow-accent` ให้เท่ากับค่าของ utility (`0 10px 40px -10px / 0.3`) **แล้ว**ให้ `@utility shadow-accent-glow` อ้าง var — ลำดับนี้สำคัญ ทำกลับกันจะเปลี่ยนเงาปุ่ม 9 จุด |
| MODIFY | `src/styles/tokens.css` | `.mesh-gradient` ใช้ `color-mix(in oklab, var(--color-accent) 12%, transparent)` แทน literal |
| MODIFY | `src/styles/tokens.css` | ลบ `--color-info` (`:59`, `:135`, `@theme inline :166`) |
| MODIFY | `scripts/check-contrast.ts` | export ฟังก์ชันแทน `main()` + `process.exit()` ทันที เพื่อให้ vitest เรียกได้ (T4 ใช้) |
| MODIFY | `DESIGN.md` | §2 เพิ่มตาราง gamut + วิธีเพิ่มขั้นใหม่; ลบ `info` ที่บรรทัด 25 |

**ไม่ทำ alias** ของ `--color-accent`/`--color-accent-strong` — `check-contrast.ts:79` บังคับให้ค่าเป็น literal `oklch(` ถ้าเปลี่ยนเป็น `var()` จะหา token ไม่เจอแล้ว fail 10 คู่

**Test:**
```bash
pnpm check-contrast          # ต้องผ่านเท่าเดิม (ไม่มีค่าที่ใช้อยู่เปลี่ยน)
pnpm build
Select-String 'accent-100|accent-200|accent-700' .next\static\css\*.css   # ยืนยัน utility ถูก generate จริง
```

**Risk:** `next build` ไม่ error เมื่อ utility ไม่มี → ต้อง grep CSS จริง ไม่ใช่ดูว่า build ผ่าน

---

## T0.5 — Visual baseline

`playwright.config.ts` และ `@axe-core/playwright` มีอยู่แล้ว ไม่ต้องลงอะไรเพิ่ม

| การกระทำ | ไฟล์ | รายละเอียด |
|---|---|---|
| CREATE | `e2e/visual.spec.ts` | `toHaveScreenshot()` ของ `/`, `/intake`, `/track` (light) + `AxeBuilder` รัน `color-contrast` ทั้ง light และ dark |
| CREATE | `docs/color-migration-notes.md` | บันทึกจุดที่ตั้งใจให้หน้าตาเปลี่ยน (A8) |

**Test:** `npx playwright test e2e/visual.spec.ts` ครั้งแรกสร้าง baseline — ต้องรันหลัง T1 merge แล้ว

---

## T2 — ย้าย inline (6 ไฟล์, 32 จุด)

| ไฟล์ | จุด | หมายเหตุ |
|---|---|---|
| `Services.tsx` | 12 (เหลือจาก T1) | config array — เปลี่ยน field เป็นชื่อ class |
| `Stats.tsx` | 8 | **`stats-client.tsx` มี 0 จุด** — งานจริงคือแก้ `StatItem.color/bgColor` เป็น `colorClass/bgClass` แล้วเปลี่ยน `style` → `className` ที่ `:46,:53-56,:63` |
| `HowItWorks.tsx` | 8 | `step.color` ตัวเดียวถูกใช้ 3 บทบาท (`:81` border, `:84` icon, `:91` bg) ต้องแตกเป็น 3 field หรือใช้ `currentColor`; gradient `:71` → `bg-accent-gradient opacity-30` |
| `intake-form.tsx` | 4 (เหลือจาก T1) | icon badge pattern เดียวกับ `track-form` |
| `track-form.tsx` | 2 | ตรงไปตรงมา |
| `page.tsx` | 1 | |

**กับดักที่ต้องระวัง:** `pnpm typecheck` **จับไม่ได้** ถ้าแค่เปลี่ยนค่าใน field ที่เป็น `string` — `style={{ color: 'text-accent' }}` จะ compile ผ่านแล้วสีหายเงียบ ๆ **บังคับให้เปลี่ยนชื่อ field** เพื่อให้ type error ชี้ทุก call site

**Test:** ทีละไฟล์ — `pnpm typecheck` + `npx playwright test e2e/visual.spec.ts`

---

## T3 — ย้าย inline: Hero.tsx (33 จุด)

แยกตามรอยต่อ component ที่มีอยู่แล้วในไฟล์ ไม่ต้องประดิษฐ์

### T3a — `export function Hero()` (`:27`) — 14 จุด
background decor, badge, chips, trust badges

### T3b — `function HeroTrackingCard()` (`:211`) — 19 จุด
รวมเคสยากทั้งหมด:
- **step indicator (`:350`)** — boolean 2×2 state เขียนเป็น conditional class ได้: `cn(step.done ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-muted', step.active && 'outline outline-3 outline-accent-100')`
- **white overlay (`:271`, `:326`)** — **คงเป็น literal** `--color-surface-raised` ไม่ใช่สีขาวใน dark
- **`boxShadow` (`:258`)** — ต่างจาก `shadow-accent-glow` (25/50/-12/0.1 vs 10/40/-10/0.3) ตัดสินใจ: ยอมรับความต่างแล้วใช้ utility เดิม หรือเพิ่ม utility ใหม่
- **`animationDelay: '2s'` (`:44-46`)** — คงไว้ ไม่ใช่สี

**Test:** screenshot ทุก commit ย่อย · dark ตรวจด้วย axe (คาดว่าเปลี่ยนโดยตั้งใจ)

---

## T4 — ปิดจุดบอด

**เริ่มด้วยการ grep ยืนยันว่าเหลือ 0 จุดก่อน**

| การกระทำ | ไฟล์ | รายละเอียด |
|---|---|---|
| MODIFY | `eslint.config.mjs` | `no-restricted-syntax` สอง selector: `Literal[value=/oklch/]` + `TemplateElement[value.raw=/oklch/]` — **ห้ามใส่ `\(`** จะ crash |
| MODIFY | `eslint.config.mjs` | allowlist `scripts/**` (seed=data, check-contrast=parser) และ `.storybook/**` ถ้าถูก lint |
| CREATE | `src/styles/tokens.contrast.test.ts` | เรียกตรรกะจาก `check-contrast.ts` assert `failures === 0` — ทำให้ gate รันใน `vitest` เสมอ |
| MODIFY | `.github/workflows/ci.yml` | เพิ่ม step `pnpm check-contrast` (Actions ปิดอยู่ — **ไม่นับเป็น gate** เผื่อวันเปิดกลับ) |
| MODIFY | `scripts/check-contrast.ts` | เพิ่มคู่ของ token ใหม่เข้า `PAIRS` |

**Test:**
- ใส่ `oklch(` ใน `.tsx` ชั่วคราว → lint ต้อง fail → เอาออก
- ทดสอบทั้ง string literal และ template literal
- ยืนยันว่าไม่ false-positive กับ comment (`schema.ts:140`)
- `pnpm vitest run` ต้องเห็น contrast test

---

## ลำดับ commit

| # | Tranche | ส่งแยก? |
|---|---|---|
| 1 | T1 — บั๊ก production | **ควรส่งก่อน** |
| 2 | T0 — token + gate refactor | ได้ |
| 3 | T0.5 — baseline | ได้ |
| 4 | T2 — 6 ไฟล์ | ได้ |
| 5 | T3a — Hero() | ได้ |
| 6 | T3b — HeroTrackingCard() | ได้ |
| 7 | T4 — ESLint + vitest gate | ท้ายสุด |

---

## Review Gate

ก่อนเริ่ม T2 ต้องผ่านทั้งหมด:

- [ ] T1 merge แล้วและ production ยืนยันว่าแก้จริง
- [ ] `pnpm build` + grep CSS ยืนยันว่า `bg-accent-100/200/700` ถูก generate
- [ ] `npx playwright test e2e/visual.spec.ts` มี baseline แล้ว
- [ ] `pnpm check-contrast` ผ่าน

---

## สิ่งที่แผนนี้ไม่แก้ (ตัดสินใจแล้ว — ดู PRD §3.2)

`seed.ts` (data ใน DB) · `flex.ts` (LINE รับแต่ hex) · `icon.svg` (SVG อ้าง var ไม่ได้) · `layout.tsx` themeColor (meta ไม่รองรับ oklch) · หนี้ lint 21 error · บั๊ก broadcast
