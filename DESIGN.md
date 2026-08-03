<!-- SEED: re-run $impeccable document once tokens.css + primitives exist to capture real rendered tokens and generate .impeccable/design.json sidecar. Anchor values ด้านล่างอ้างอิง glm5-2-smart-service blue/amber palette + glassmorphism + framer-motion. ค้าง verify contrast AA ตอน implement. -->
---
name: กองช่าง องค์การบริหารส่วนตำบลหัวงัว
description: ระบบรับแจ้งเหตุและติดตามงานบริการสาธารณูปโภคออนไลน์ — รวดเร็ว โปร่งใส มีประสิทธิภาพ (tech/smart + Thai royal vibe)
colors:
  surface: "oklch(99% 0.005 255)"
  surface-raised: "oklch(100% 0 0)"
  surface-sunken: "oklch(96% 0.02 255)"
  text: "oklch(18% 0.02 255)"
  text-muted: "oklch(47% 0.02 255)"
  text-on-accent: "oklch(99% 0.005 255)"
  border: "oklch(85% 0.015 255)"
  border-strong: "oklch(64% 0.03 255)"
  accent: "oklch(51% 0.16 255)"
  accent-strong: "oklch(42% 0.16 255)"
  accent-sunken: "oklch(96% 0.02 255)"
  accent-gold: "oklch(82% 0.14 80)"
  accent-gold-soft: "oklch(95% 0.05 80)"
  success: "oklch(55% 0.13 160)"
  success-soft: "oklch(94% 0.04 160)"
  warning: "oklch(82% 0.14 80)"
  warning-soft: "oklch(95% 0.05 80)"
  danger: "oklch(60% 0.22 25)"
  danger-soft: "oklch(95% 0.05 25)"
  info: "oklch(51% 0.16 255)"
  dark:
    surface: "oklch(15% 0.015 255)"
    surface-raised: "oklch(20% 0.02 255)"
    surface-sunken: "oklch(27% 0.02 255)"
    text: "oklch(97% 0.005 255)"
    text-muted: "oklch(70% 0.02 255)"
    border: "oklch(100% 0 0 / 10%)"
    accent: "oklch(70% 0.14 255)"
    accent-gold: "oklch(78% 0.14 80)"
typography:
  display:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.4rem + 4vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    note: "gradient-text animation ใช้ได้ แต่ต้อง respect prefers-reduced-motion"
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
    note: "≥17px elderly floor ตาม H12"
  label:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.01em"
  caption:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.02em"
shape:
  borderRadius: "0.75rem"
  borderRadiusPill: "9999px"
  borderRadiusSm: "0.5rem"
  borderRadiusLg: "1rem"
  borderRadiusXl: "1.5rem"
  note: "glassmorphism cards ใช้ backdrop-blur(12px) + border oklch(100% 0 0 / 30%)"
spacing:
  section: "clamp(4rem, 3rem + 5vw, 10rem)"
  cardPadding: "1.25rem"
  buttonPadding: "0.75rem 1.75rem"
  touchTargetMin: "44px"
elevation:
  card: "0 1px 3px 0 oklch(0% 0 0 / 0.1), 0 1px 2px -1px oklch(0% 0 0 / 0.1)"
  cardHover: "0 4px 6px -1px oklch(0% 0 0 / 0.1), 0 2px 4px -2px oklch(0% 0 0 / 0.1)"
  overlay: "0 25px 50px -12px oklch(0% 0 0 / 0.25)"
  glowAccent: "0 0 40px -10px oklch(51% 0.16 255 / 0.5)"
  glowAmber: "0 0 40px -10px oklch(82% 0.14 80 / 0.5)"
motion:
  durationFast: "150ms"
  durationNormal: "300ms"
  durationSlow: "500ms"
  easeOutExpo: "cubic-bezier(0.16, 1, 0.3, 1)"
  note: "ทุก animation ต้อง respect prefers-reduced-motion — disable float/pulse/shimmer/gradient-shift เมื่อ user ตั้ง reduce-motion"
---

# กองช่าง องค์การบริหารส่วนตำบลหัวงัว — Design System

**ตัวตน:** ระบบรับแจ้งเหตุและติดตามงานบริการสาธารณูปโภคออนไลน์ — น่าเชื่อถือ โปร่งใส มีประสิทธิภาพ (tech/smart vibe + Thai royal gold accent)

**อ้างอิง:** glm5-2-smart-service (glassmorphism + framer-motion) — palette ปรับเป็น blue 255 + amber 80

**A11y Gates (HARD — ทุกอย่างต้องผ่าน):**
- Contrast AA (WCAG 2.1 level AA) — ทุกสี light/dark
- Touch target ≥44px (C6)
- Elderly floor ≥17px body text (H12)
- Keyboard 100% (H11)
- Screen reader (NVDA/VoiceOver) ทั้ง `th` + `th-northeast` (H12)
- **prefers-reduced-motion MUST respect** — disable float/pulse/shimmer/gradient-shift เมื่อ user ตั้ง reduce-motion

**Anti-AI-Default Reflexes (ปฏิเสธดีไซน์โหลๆ ที่ AI มักเจนให้ — ดูรายละเอียดใน §2/§3/§4/§7):**
- **No-Cream** — พื้นห้ามใช้ cream AI-default `oklch(98% 0.01 60)` → ใช้ off-white เอียงน้ำเงิน
- **No-Muddy-Blue** — น้ำเงินต้องมี chroma ≥0.14 → ห้าม navy จืด ๆ แบบ `oklch(35% 0.07 256)` ที่ให้ความรู้สึกราชการเก่า (แทนกฎ No-Indigo เดิมที่ถูกยกเลิกพร้อมการย้าย palette — ดู §2)
- **No-Serif** — ห้าม serif display (Fraunces/DM Serif/Playfair) → Noto Sans Thai bold
- **No-Flat** — ห้าม flat surface → glassmorphism + mesh gradient + glow

---

## §1. Overview — ศาลาประชาชนดิจิทัล

**แนวคิด:** SMART SERVICE CENTER — ระบบรับแจ้งเหตุและติดตามงานบริการสาธารณูปโภคออนไลน์ที่ทันสมัย รวดเร็ว โปร่งใส มีประสิทธิภาพ

**ไม่ใช่:**
- ไม่ใช่ระบบราชการโบราณ (paper-based, manual tracking)
- ไม่ใช่ Traffy clone (generic complaint system)
- ไม่ใช่ editorial civic magazine (serif headlines, flat surface)

**ใช่:**
- ระบบ smart/tech ที่ทันสมัย (blue primary = ราชการที่น่าเชื่อถือ ไม่ใช่ราชการเก่า)
- Thai royal elegance (amber gold accent)
- Glassmorphism + mesh gradient (modern premium feel)
- Modular sections (Stats/Services/HowItWorks/LiveTracking/Testimonials/FAQ/CTA)
- Real-time tracking card (floating demo ใน hero)

---

## §2. Colors — Blue Civic + Amber Royal

> **ประวัติ:** palette เดิมเป็น emerald 160° และมีกฎ "No-Indigo" ห้ามใช้ civic blue
> กฎนั้นถูกยกเลิกแล้วเมื่อย้ายมาใช้ blue 255° เป็น primary เหตุผล: (1) น้ำเงินคือสีที่
> หน่วยงานราชการไทยใช้สื่อความน่าเชื่อถือ (2) ตอน accent เป็น emerald มันมีค่าเท่ากับ
> `--color-success` เป๊ะ ทำให้ "ปุ่มหลัก" กับ "สถานะสำเร็จ" แยกไม่ออก การย้าย accent
> ไปน้ำเงินคืนความหมายให้เขียว = สำเร็จ อย่างเดียว
> ข้อควรระวังที่กฎเดิมพูดถูกยังใช้ได้: civic blue ที่ chroma ต่ำจะดูจืดและเก่า จึงตั้ง
> chroma ไว้ที่ 0.16 (สูงกว่า indigo เดิมที่ 0.12) เพื่อคงความสด

**Primary: Blue 255° (ราชการที่น่าเชื่อถือ)**
- `oklch(51% 0.16 255)` — หลัก (ไอคอน, ตัวคั่น, mesh gradient)
- `oklch(42% 0.16 255)` — hover/strong (ปุ่ม primary, ลิงก์ — 8.51:1 บนการ์ดขาว)
- `oklch(70% 0.14 255)` — dark mode

**Accent: Amber 80° (Thai royal gold)**
- `oklch(82% 0.14 80)` — amber-400 gold highlight
- `oklch(78% 0.14 80)` — amber dark mode

**Surface:**
- Light: `oklch(99% 0.005 255)` off-white ไม่ใช่ pure white
- Dark: `oklch(15% 0.015 255)` cool dark blue tint

**Text:**
- Light: `oklch(18% 0.02 255)` cool ink
- Dark: `oklch(97% 0.005 255)` off-white text

**Semantic:**
- Success = emerald `oklch(55% 0.13 160)` — คงเขียวไว้ ตอนนี้แยกจาก accent ได้แล้ว
- Warning = amber gold
- Danger = `oklch(60% 0.22 25)` red-orange
- Info = blue (เท่ากับ accent)

**The One Blue Rule:** blue ใช้เป็น primary ทุกที่ — CTA button, badge, progress bar, status active, link hover ห้ามใช้สีอื่นแทน (ยกเว้น amber gold accent เฉพาะ highlight/badge secondary)

**The No-Cream Rule:** surface ห้ามใช้ cream AI-default `oklch(98% 0.01 60)` — ใช้ off-white `oklch(99% 0.005 255)` ที่เอียงน้ำเงินเล็กน้อยแทน

**Contrast Verification (MANDATORY):**
- ตรวจ contrast ratio AA (4.5:1 text, 3:1 large text) ทุกคู่สี light/dark
- `scripts/check-contrast.ts` (M-A4) ต้องรันผ่าน CI
- ถ้า contrast fail → ปรับ lightness จนผ่าน

---

## §3. Typography — The One Family Rule

**Noto Sans Thai เท่านั้น** (sans-serif clean modern) — ห้ามใช้ serif display (Fraunces/DM Serif/Playfair)

**Weights:**
- 400 = body default
- 500 = label/caption
- 600 = title/badge
- 700 = display/headline

**The Elderly Floor Rule:** body text ≥17px (≥1.0625rem) ทุกหน้า — ถ้าน้อยกว่า fail H12 gate

**Gradient Text (optional):**
```css
.gradient-text {
  background: linear-gradient(120deg, var(--primary), var(--accent), var(--primary));
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-shift 6s ease infinite;
}

@media (prefers-reduced-motion) {
  .gradient-text { animation: none; background-position: 0% 50%; }
}
```

**ห้าม:** italic คำเดียวใน headline (editorial pattern) — ใช้ gradient-text แทน

---

## §4. Elevation — Glassmorphism + Mesh Gradient

**Glassmorphism Cards:**
```css
.glass {
  background: oklch(100% 0 0 / 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid oklch(100% 0 0 / 0.3);
}
.dark .glass {
  background: oklch(20% 0.02 255 / 0.6);
  border: 1px solid oklch(100% 0 0 / 0.08);
}
```

**Mesh Gradient Background:**
```css
.mesh-gradient {
  background-color: var(--background);
  background-image:
    radial-gradient(at 12% 18%, oklch(51% 0.16 255 / 0.12) 0px, transparent 50%),
    radial-gradient(at 88% 12%, oklch(82% 0.14 80 / 0.10) 0px, transparent 50%),
    radial-gradient(at 33% 88%, oklch(51% 0.16 255 / 0.12) 0px, transparent 50%),
    radial-gradient(at 78% 82%, oklch(82% 0.14 80 / 0.08) 0px, transparent 50%);
}
```

**Thai Pattern Overlay:**
```css
.thai-pattern {
  background-image:
    radial-gradient(circle at 25% 25%, var(--accent) 0%, transparent 35%),
    radial-gradient(circle at 75% 75%, var(--primary) 0%, transparent 35%);
  background-size: 80px 80px;
  background-position: 0 0, 40px 40px;
  opacity: 0.04;
}
```

**Glow Effects:**
```css
.glow-accent { box-shadow: 0 0 40px -10px oklch(51% 0.16 255 / 0.5); }
.glow-amber { box-shadow: 0 0 40px -10px oklch(82% 0.14 80 / 0.5); }
```

**The Flat-By-Default Rule:** ยกเลิก — ใช้ glassmorphism + mesh gradient + glow แทน (แต่ต้อง respect prefers-reduced-motion สำหรับ glow animation)

---

## §5. Components

### Radius & Shape (การใช้จริง)

Token radius ใน `src/styles/tokens.css` มีแค่ 5 ขั้น — ใช้เฉพาะชื่อในตารางนี้:

| Token | ค่า | ใช้กับ |
|---|---|---|
| `rounded-sm` | 8px | checkbox, control เล็กๆ |
| `rounded-md` | 12px | button, input, badge, alert (default ของ primitives) |
| `rounded-lg` | 16px | card, dialog, glass-panel |
| `rounded-xl` | 24px | glass card ขนาดใหญ่, hero panel |
| `rounded-pill` | 9999px | status pill, chip, avatar, dot |

**ห้าม:** `rounded-2xl` / `rounded-3xl` — ไม่ได้ถูก override ใน token จึงยังเป็นค่า default ของ Tailwind (1rem / 1.5rem) ทำให้สเกลไม่เรียงกัน (`rounded-2xl` เล็กกว่า `rounded-xl`) ใช้แล้วมุมจะ "หด" ลงแบบเงียบๆ

### CaseStatusBadge (H13)
```tsx
// blue/amber soft bg + strong text 
const statusMap: Record<CaseStatus, { label: string; class: string }> = {
  received: { label: 'รับเรื่อง', class: 'bg-accent-sunken text-accent-strong' },
  reviewing: { label: 'ตรวจสอบ', class: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'กำลังดำเนินการ', class: 'bg-amber-100 text-amber-800' },
  done: { label: 'เสร็จสิ้น', class: 'bg-accent-sunken text-accent-strong' },
  urgent: { label: 'ฉุกเฉิน', class: 'bg-red-100 text-red-800' },
};
```

### Button
```tsx
// Blue gradient primary
<Button className="bg-gradient-to-r bg-accent-gradient hover:brightness-110 text-white shadow-accent-glow">
  แจ้งเหตุออนไลน์
</Button>

// Outline secondary
<Button variant="outline" className="border-2 hover:bg-secondary">
  ติดตามงาน
</Button>
```
Touch target ≥44px (C6) — `min-h-[44px] min-w-[44px]`

### Glassmorphism Card (Floating Demo)
```tsx
<div className="glass rounded-3xl shadow-2xl border overflow-hidden">
  {/* Blue gradient header */}
  <div className="bg-gradient-to-r bg-accent-gradient p-5 text-white">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-on-accent/80">เลขใบแจ้ง</p>
        <p className="text-sm font-bold">SSC-2026-0847</p>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
        <motion.span animate={{ opacity: [1, 0.3, 1] }} className="w-2 h-2 rounded-full bg-amber-300" />
        <span className="text-[11px] font-medium">กำลังดำเนินการ</span>
      </div>
    </div>
  </div>
  {/* Body: service info + location + progress timeline */}
</div>
```

### Animated Elements (MANDATORY prefers-reduced-motion)
```tsx
import { motion, useReducedMotion } from 'framer-motion';

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.6 }} // instant ถ้า reduce
    >
      {/* Float animation */}
      <motion.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        Floating card
      </motion.div>
    </motion.div>
  );
}
```

**CRITICAL:** ทุก motion component ต้องตรวจ `useReducedMotion()` และ disable animation เมื่อ user ตั้ง `prefers-reduced-motion: reduce` — ถ้าไม่ทำ fail H11/M-A1 gate

### Input / Form Field

Primitives อยู่ที่ `src/components/ui/field.tsx` — แยกเป็น `Input` / `Textarea` / `Label` / `FieldError` / `FieldHint` (ไม่มี composite `Field`; ประกอบเองในฟอร์ม):

```tsx
<Label htmlFor="email">อีเมล</Label>
<Input id="email" name="email" type="email" icon={Mail} invalid={!!error} aria-describedby={error ? 'email-err' : undefined} />
{error && <FieldError id="email-err">{error}</FieldError>}
```

- **Label:** อยู่เหนือ field เสมอ (`block mb-1.5`, ไม่ float label — ผู้สูงอายุอ่านยาก), ห้ามใช้ placeholder แทน label
- **Icon:** prop `icon?: LucideIcon` — ไอคอนอยู่ซ้ายของ input (`pl-11`, icon `left-3.5`, `text-muted`)
- **Focus:** `focus:border-accent-strong` + `focus-visible:ring-accent-strong/35` (น้ำเงินเท่านั้น — The One Blue Rule)
- **Error state:** `invalid` prop → `border-danger bg-danger-soft/40` + `FieldError` สี `danger-ink` ใต้ field (`role="alert"`)
- **Touch:** `min-h-touch` ใน fieldBase บังคับ ≥44px (C6) — ห้ามลดความสูงแม้ในตารางแอดมิน
- **Radius:** `rounded-md` (12px) ตามตาราง Radius ด้านบน

### Navigation

- **Landing Navbar:** `fixed top-0 z-50` + glassmorphism (`.glass` backdrop-blur) — ลอยทับ mesh gradient ของ hero, active link = emerald
- **Admin Sidebar:** แบ่ง 4 กลุ่ม (งานหลัก / แชท LINE / แชทบอท / ระบบ) — กรองตาม role ผ่าน `visibleNavGroups` (เมนู `supervisorOnly` ซ่อนจากเจ้าหน้าที่), active item = `bg-accent-strong text-on-accent` (emerald ทึบ), hover = `bg-accent-sunken`
- **Touch:** nav item ทุกตัว ≥44px (C6) — รวมเมนูมือถือ (hamburger + drawer item)
- **Keyboard:** ทุกลิงก์ focus ได้ตาม tab order, drawer ปิดด้วย Esc

---

## §6. Layout — Modular Sections

### Spacing Scale

ใช้สเกล default ของ Tailwind (ฐาน 4px: `p-1`=4px, `p-2`=8px, `p-4`=16px, `gap-10`=40px ...) — ไม่ได้ override ใน token จึงห้ามคิดสเกลเอง ให้ใช้ step ของ Tailwind เท่านั้น

**Token spacing ที่มีจริงใน `src/styles/tokens.css` (มีตัวเดียว):**

| Token | ค่า | ใช้กับ |
|---|---|---|
| `--touch-target-min` | 44px | min-height/width ของ interactive element — utility `min-h-touch` / `min-w-touch` |

**Pattern ที่ใช้จริงในโค้ด (Tailwind step):**
- Section landing: `py-16 lg:py-24` (64/96px) — ไม่ใช่ clamp
- Card padding: `p-6` (24px), card ใหญ่/CTA: `p-8`
- Grid gap: `gap-6` (card grid), `gap-8` (feature grid)

> ⚠️ ค่า `section: clamp(4rem, 3rem + 5vw, 10rem)`, `cardPadding: 1.25rem`, `buttonPadding: 0.75rem 1.75rem` ใน YAML frontmatter เป็นแค่ค่าอ้างอิงเชิงอุดมคติ — **ยังไม่ได้ implement เป็น token** และโค้ดจริงไม่ได้ใช้ อย่าอ้างว่าเป็นค่าจาก tokens.css

### Breakpoints & Grid

Breakpoints = ค่า default ของ Tailwind v4 (ไม่ได้ override):

| Prefix | ≥ | ใช้กับ |
|---|---|---|
| `sm` | 640px | mobile landscape |
| `md` | 768px | tablet — admin sidebar พับเป็น drawer |
| `lg` | 1024px | desktop — hero แยก 2 คอลัมน์, sidebar ถาวร |
| `xl` | 1280px | wide desktop |
| `2xl` | 1536px | ultra-wide |

**Pattern หลัก:**
- Container: `container mx-auto px-4` (ทุก section ของ landing)
- Hero / 2-col: `grid lg:grid-cols-2 gap-10 items-center`
- Card grid: `grid sm:grid-cols-2 lg:grid-cols-3 gap-6`
- ความกว้างที่ต้องเทสต์: 320 / 768 / 1024 / 1440 × {light, dark}

### Layout Patterns (ภาพตัวอย่าง)

Wireframe ASCII + className จริง — ให้ agent สร้างเลย์เอาต์ตามได้โดยไม่ต้องดูรูป

**1) Hero 2 คอลัมน์ (lg ขึ้นไป) — ซ้ายข้อความ/CTA, ขวา tracking demo card:**
```
┌───────────────────────────┬───────────────────────────┐
│  badge                    │      ┌───────────────┐    │
│  H1 gradient-text         │      │ tracking demo │    │
│  subtitle + description   │      │ card (.glass) │    │
│  [service chips]          │      │  floating     │    │
│  [CTA primary][outline]   │      └───────────────┘    │
│  trust badges             │                           │
└───────────────────────────┴───────────────────────────┘
        grid lg:grid-cols-2 gap-10 items-center
```
```tsx
<div className="container mx-auto px-4 relative z-10">
  <div className="grid lg:grid-cols-2 gap-10 items-center">
    <div>{/* text + CTA + chips */}</div>
    <HeroTrackingCard />
  </div>
</div>
```
ต่ำกว่า `lg` = stack คอลัมน์เดียว (ข้อความก่อน, card ทีหลัง)

**2) Card grid (responsive 1/2/3 คอลัมน์):**
```
mobile(<sm)      tablet(sm–lg)        desktop(≥lg)
┌────┐          ┌────┬────┐          ┌────┬────┬────┐
│card│          │card│card│          │card│card│card│
└────┘          ├────┼────┤          └────┴────┴────┘
┌────┐          │card│card│           grid sm:grid-cols-2
└────┘          └────┴────┘                lg:grid-cols-3 gap-6
```
```tsx
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <div className="glass rounded-lg p-6 shadow-lg">…</div>
</div>
```

**3) Admin shell (lg ขึ้นไป) — sidebar ถาวร + content:**
```
┌──────────┬──────────────────────────────────┐
│ sidebar  │  topbar (h-16, breadcrumb/user)  │
│ งานหลัก  ├──────────────────────────────────┤
│ แชท LINE │                                  │
│ ระบบ     │  content (glass-panel cards)     │
│ ───────  │                                  │
│ โปรไฟล์  │                                  │
└──────────┴──────────────────────────────────┘
 sidebar = fixed/col; ต่ำกว่า lg พับเป็น drawer (hamburger)
```
```tsx
{/* sidebar = glass-panel fixed + เลื่อนเข้า/ออกด้วย translate (drawer);
    แสดงถาวรตั้งแต่ lg ด้วย lg:translate-x-0, ย่อได้เป็น lg:w-[4.5rem] */}
<aside className="glass-panel fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-lg
                  w-72 -translate-x-full lg:translate-x-0 lg:w-64 …">…</aside>
{/* content เว้นที่ตาม sidebar (ย่อแล้ว = lg:pl-[4.5rem]) */}
<div className="flex min-h-screen flex-col lg:pl-64">…<main className="flex-1">{children}</main></div>
```

**Landing Page Structure (อ้างอิง glm5-2-smart-service):**
```tsx
<main>
  <Hero />           {/* 2-col: text + tracking demo card */}
  <Stats />          {/* metrics: เรื่องดำเนินการวันนี้, เวลาตอบสนองเฉลี่ย, ผู้ใช้งานทั้งหมด */}
  <Services />       {/* 5-6 service chips: ไฟฟ้า/ประปา/ถนน/ระบายน้ำ/ซ่อมบำรุง */}
  <HowItWorks />     {/* 4 steps: แจ้งเหตุ → ตรวจสอบ → ดำเนินการ → เสร็จสิ้น */}
  <LiveTracking />   {/* demo realtime tracking card (ใหญ่) */}
  <Testimonials />   {/* carousel 3-5 testimonials */}
  <FAQ />            {/* accordion 6-8 FAQs */}
  <CTA />            {/* final CTA emerald gradient */}
</main>
```

**Hero Layout:**
```tsx
<section className="relative pt-28 pb-16 overflow-hidden mesh-gradient">
  <div className="absolute inset-0 thai-pattern pointer-events-none" />
  <div className="absolute top-32 -left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl float-animate" />
  <div className="absolute bottom-0 -right-20 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl float-animate" />

  <div className="container mx-auto px-4 relative z-10">
    <div className="grid lg:grid-cols-2 gap-10 items-center">
      {/* Left: Text + CTA + service chips */}
      <div>
        <div className="badge">ระบบออนไลน์ใหม่ ปี 2569</div>
        <h1 className="gradient-text">SMART SERVICE CENTER</h1>
        <p className="subtitle">กองช่าง องค์การบริหารส่วนตำบลหัวงัว</p>
        <p className="description">ระบบรับแจ้งเหตุและติดตามงานบริการสาธารณูปโภคออนไลน์...</p>
        <div className="service-chips">{/* 5 chips */}</div>
        <div className="cta-buttons">
          <Button emerald-gradient>แจ้งเหตุออนไลน์</Button>
          <Button outline>ติดตามงาน</Button>
        </div>
        <div className="trust-badges">{/* 3 badges: โปร่งใส/ตอบสนอง 24 ชม./เรียลไทม์ */}</div>
      </div>

      {/* Right: Tracking demo card (glassmorphism floating) */}
      <HeroTrackingCard />
    </div>
  </div>
</section>
```

---

## §7. Do's & Don'ts

### ✅ DO
- ใช้ emerald-600 เป็น primary ทุกที่ (CTA, badge, progress, link hover)
- ใช้ amber-400 gold เป็น accent highlight (badge secondary, warning, trust badge icon)
- Glassmorphism cards (backdrop-blur + border)
- Mesh gradient background (radial-gradient emerald/amber)
- Float/pulse animation **แต่ต้อง respect prefers-reduced-motion**
- Gradient text animation (optional) **แต่ต้อง disable เมื่อ reduce-motion**
- Touch target ≥44px ทุก interactive element
- Body text ≥17px (elderly floor)
- Contrast AA ทุกคู่สี

### ❌ DON'T
- ห้ามใช้ civic indigo `oklch(52% 0.12 245)` (เก่า — เปลี่ยนเป็น emerald แล้ว)
- ห้ามใช้ serif display headlines (Fraunces/DM Serif) — ใช้ Noto Sans Thai bold แทน
- ห้ามใช้ cream AI-default `oklch(98% 0.01 60)` — ใช้ off-white `oklch(99% 0.005 145)`
- ห้ามใช้ flat surface (flat-by-default rule ยกเลิก) — ใช้ glassmorphism/mesh แทน
- ห้าม animation ที่ไม่ respect `prefers-reduced-motion` (CRITICAL gate)
- ห้าม body text <17px (fail elderly floor H12)
- ห้าม touch target <44px (fail C6)
- ห้าม contrast <AA (fail M-A4)

---

## §8. Migration Checklist (จาก civic indigo → emerald/amber)

- [ ] `src/styles/tokens.css` — เปลี่ยน palette civic indigo → emerald-160/amber-80
- [ ] `src/app/layout.tsx` — Noto Sans Thai เท่านั้น (ไม่มี serif display)
- [ ] `src/app/page.tsx` — ทำ modular sections (Stats/Services/HowItWorks/LiveTracking/Testimonials/FAQ/CTA)
- [ ] `src/components/ui/button.tsx` — emerald gradient primary, outline secondary
- [ ] `src/components/ui/case-status-badge.tsx` — emerald/amber soft bg
- [ ] `src/components/landing/Hero.tsx` — 2-col + tracking demo card + glassmorphism
- [ ] `src/components/landing/Stats.tsx` — metrics cards
- [ ] `src/components/landing/Services.tsx` — 5-6 service chips
- [ ] `src/components/landing/HowItWorks.tsx` — 4 steps timeline
- [ ] `src/components/landing/LiveTracking.tsx` — realtime demo (ใหญ่)
- [ ] `src/components/landing/Testimonials.tsx` — carousel
- [ ] `src/components/landing/FAQ.tsx` — accordion
- [ ] `src/components/landing/CTA.tsx` — final CTA emerald gradient
- [ ] `src/components/landing/Navbar.tsx` — sticky glassmorphism nav
- [ ] `src/components/landing/Footer.tsx` — 4-col footer
- [ ] Install `framer-motion` — `pnpm add framer-motion`
- [ ] All animations respect `useReducedMotion()`
- [ ] Run `scripts/check-contrast.ts` verify AA
- [ ] Run `pnpm build` verify production
- [ ] Visual regression 320/768/1024/1440 × {light,dark}

---

*ออกแบบโดยอ้างอิง glm5-2-smart-service (emerald tech + amber royal + glassmorphism + framer-motion) พร้อม a11y gates บังคับ (contrast AA, touch ≥44px, elderly ≥17px, reduced-motion respect)*
