import {
  ArrowRight,
  Search,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  Droplets,
  Wallet,
  HeartPulse,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

/**
 * หน้าหน้า citizen (brand register) — ทำหน้าที่เหมือน "ศาลาประชาชน" ออนไลน์
 * ออกแบบตาม DESIGN.md: civic indigo ≤10%, off-white surface, Noto Sans Thai,
 * flat-by-default, motion restrained. หลีก SaaS hero-metric / identical card grids.
 */

const intakeSteps = [
  {
    icon: FileText,
    title: 'แจ้งเรื่อง',
    desc: 'กรอกเรื่องร้องเรียก/ร้องทุกข์ของท่าน พร้อมที่ตั้ง',
  },
  {
    icon: ClipboardCheck,
    title: 'ตรวจสอบและมอบหมาย',
    desc: 'เจ้าหน้าที่รับเรื่อง ตรวจสอบ และมอบหมายผู้รับผิดชอบ',
  },
  {
    icon: CheckCircle2,
    title: 'ดำเนินการและปิดเรื่อง',
    desc: 'ติดตามสถานะได้ทุกขั้น จนปิดเรื่องพร้อมสรุปผล',
  },
] as const;

const examples = [
  { icon: Droplets, label: 'ถนน · ระบบระบายน้ำ' },
  { icon: Wallet, label: 'งบประมาณ · กก.ทร.' },
  { icon: HeartPulse, label: 'สวัสดิการ · ช่วยเหลือ' },
  { icon: Phone, label: 'สาธารณูปโภค · อื่นๆ' },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      {/* ===== Top bar ===== */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-touch w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="inline-block h-7 w-7 rounded-md bg-accent-strong"
            />
            <span>ตำบลหัวงัว</span>
          </Link>
          <nav aria-label="เมนูหลัก" className="flex items-center gap-1 text-sm sm:gap-2">
            <Link
              href="/track"
              className="inline-flex min-h-touch items-center gap-1.5 rounded-md px-3 text-ink/80 hover:bg-accent-sunken hover:text-ink"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              ติดตามเรื่อง
            </Link>
            <Link
              href="/admin"
              className="inline-flex min-h-touch items-center rounded-md px-3 text-ink/80 hover:bg-accent-sunken hover:text-ink"
            >
              เข้าสู่ระบบเจ้าหน้าที่
            </Link>
          </nav>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <main>
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-sm font-semibold text-accent">องค์การบริหารส่วนตำบลหัวงัว</p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold leading-[1.1] sm:text-5xl md:text-6xl">
            แจ้งเรื่องร้องเรียกได้ที่นี่
            <br />
            <span className="text-ink/80">เจ้าหน้าที่ติดตามให้</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            ตำบลหัวงัว อำเภอยางตลาด จังหวัดกาฬสินธุ์ — แจ้งเรื่องร้องเรียก ร้องทุกข์
            ได้ด้วยตัวท่านเอง ติดตามสถานะได้ทุกขั้นตอน โปร่งใส ตรวจสอบได้
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/intake"
              className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-accent-strong px-7 font-semibold text-on-accent transition-colors duration-normal ease-out-expo hover:bg-accent-strong/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              แจ้งเรื่องใหม่
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/track"
              className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-border-strong px-7 font-semibold text-accent-strong transition-colors duration-normal ease-out-expo hover:bg-accent-sunken"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
              ติดตามเรื่องที่แจ้ง
            </Link>
          </div>

          {/* ตัวอย่างเรื่องที่แจ้งได้ — chips ไม่ใช่ identical cards */}
          <div className="mt-12">
            <p className="text-sm font-semibold text-muted">ตัวอย่างเรื่องที่แจ้งได้</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {examples.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <span className="inline-flex min-h-touch items-center gap-2 rounded-pill border border-border bg-surface-raised px-4 text-sm text-ink">
                    <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== ขั้นตอนจริง (real sequence ไม่ใช่ 01/02/03 scaffolding) ===== */}
        <section
          aria-labelledby="how-it-works"
          className="border-t border-border bg-surface-sunken"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2
              id="how-it-works"
              className="text-2xl font-bold sm:text-3xl"
            >
              เรื่องของท่านถูกดำเนินการอย่างไร
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3 sm:gap-4">
              {intakeSteps.map(({ icon: Icon, title, desc }, i) => (
                <li key={title} className="flex gap-4">
                  <div className="flex flex-col items-center sm:contents">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-md bg-surface-raised text-accent-strong ring-1 ring-border"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {i < intakeSteps.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="mt-2 hidden h-px w-full bg-border sm:block"
                      />
                    )}
                  </div>
                  <div className="sm:pl-1">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-1 text-muted">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
          <p>
            องค์การบริหารส่วนตำบลหัวงัว · อำเภอยางตลาด · จังหวัดกาฬสินธุ์
          </p>
          <p className="mt-1">
            ข้อมูลของท่านอยู่ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) พ.ศ. 2562
          </p>
        </div>
      </footer>
    </div>
  );
}