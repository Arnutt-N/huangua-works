import {
  ArrowRight,
  Search,
  Construction,
  Zap,
  Droplets,
  Lightbulb,
  Leaf,
  HeartPulse,
  ClipboardCheck,
  FileText,
  CheckCircle2,
  Landmark,
  Contact,
  ShieldCheck,
  MapPin,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { CaseStatusBadge, type CaseStatus } from '../components/ui/case-status-badge';
import { Reveal } from '../components/ui/reveal';
import { SiteHeader } from '../components/site/site-header';
import { SiteFooter } from '../components/site/site-footer';

/**
 * หน้าหน้า citizen (brand register) แนว "Editorial Civic Live"
 * ศาลาประชาชนยุคใหม่: hero asymmetric + live ticker (ความโปร่งใส = จุดว้าว),
 * bento หมวดเรื่องไม่สม่ำเสมอ, scrollytelling 4 ขั้นเชื่อม CaseStatusBadge signature.
 * อยู่ภายใต้ DESIGN.md: civic indigo <=10%, off-white, flat-by-default, motion restrained,
 * a11y ผู้สูงอายุ (>=17px / touch >=44px / AA). หลีก hero-metric / identical grids / em dash.
 *
 * หมายเหตุ: รายการ live feed เป็น seed/representative (M0 UI) ยังไม่ต่อ DB
 * (P0 application logic ต้องการ Supabase setup และอนุมัติแยก)
 */

/* ---------- seed data (M0 UI placeholder, ไม่ใช่ข้อมูลจริง) ---------- */

const liveFeed = [
  {
    icon: Construction,
    title: 'ถนนบ้านหนองโน เป็นหลุมเป็นบ่อ',
    place: 'บ.หนองโน',
    ago: '2 นาทีที่แล้ว',
    status: 'received' as CaseStatus,
    statusLabel: 'รับเรื่อง',
  },
  {
    icon: Zap,
    title: 'ไฟฟ้าดับในหมู่บ้าน',
    place: 'ม.4',
    ago: '14 นาทีที่แล้ว',
    status: 'reviewing' as CaseStatus,
    statusLabel: 'ตรวจสอบ',
  },
  {
    icon: Leaf,
    title: 'สัตว์เลี้ยงรบกวนเวลากลางคืน',
    place: 'บ.กลาง',
    ago: '38 นาทีที่แล้ว',
    status: 'assigned' as CaseStatus,
    statusLabel: 'มอบหมาย',
  },
  {
    icon: Droplets,
    title: 'ระบบระบายน้ำตัน',
    place: 'บ.หนองงิ้ว',
    ago: '1 ชม.ที่แล้ว',
    status: 'in_progress' as CaseStatus,
    statusLabel: 'ดำเนินการ',
  },
] as const;

interface CategoryTile {
  icon: LucideIcon;
  label: string;
  blurb: string;
  span: string;
  feature?: true;
  featureTitle?: string;
  featureMeta?: string;
  featureStatus?: CaseStatus;
}

const categories: CategoryTile[] = [
  {
    icon: Construction,
    label: 'ทางชำรุด',
    blurb: 'ถนน ทางเท้า สะพาน ระบบระบายน้ำ',
    span: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
    feature: true,
    featureTitle: 'ถนนบ้านหนองโน เป็นหลุมเป็นบ่อ',
    featureMeta: 'รับเรื่อง 3 วันที่แล้ว · มอบหมาย กจ.ช่างซ่อมบำรุง',
    featureStatus: 'in_progress',
  },
  {
    icon: Zap,
    label: 'ไฟฟ้า',
    blurb: 'ไฟฟ้าดับ เสาไฟชำรุด หลอดไฟทาง',
    span: '',
  },
  {
    icon: Droplets,
    label: 'น้ำ · ระบาย',
    blurb: 'น้ำปะไม่ไหล ท่อตัน น้ำท่วมขัง',
    span: '',
  },
  {
    icon: Lightbulb,
    label: 'สาธารณูปโภค',
    blurb: 'แสงสว่าง สาธารณสุข สิ่งอำนวยความสะดวก',
    span: 'sm:col-span-2 lg:col-span-2',
  },
  {
    icon: Leaf,
    label: 'สิ่งแวดล้อม',
    blurb: 'ขยะ สัตว์จรจัด มลพิษ ต้นไม้',
    span: '',
  },
  {
    icon: HeartPulse,
    label: 'สวัสดิการ',
    blurb: 'ผู้สูงอายุ ผู้ยากไร้ ขอความช่วยเหลือ',
    span: '',
  },
];

const flowSteps = [
  {
    icon: FileText,
    status: 'received' as CaseStatus,
    statusLabel: 'รับเรื่อง',
    title: 'ท่านแจ้ง เราบันทึก',
    desc: 'กรอกเรื่องและที่ตั้ง ได้เลขติดตามส่วนตัวทันที เก็บไว้ดูสถานะได้ทุกเมื่อ',
  },
  {
    icon: ClipboardCheck,
    status: 'reviewing' as CaseStatus,
    statusLabel: 'ตรวจสอบ',
    title: 'เจ้าหน้าที่สกัดเรื่อง',
    desc: 'อ่านเรื่อง ตรวจขอบเขตและหน่วยที่เกี่ยวข้อง ส่งต่อถึงมือที่ถูกต้อง',
  },
  {
    icon: Construction,
    status: 'in_progress' as CaseStatus,
    statusLabel: 'ดำเนินการ',
    title: 'ผู้รับผิดชอบลงมือ',
    desc: 'ช่างซ่อมบำรุงหรืองานที่เกี่ยวข้องลงพื้นที่แก้ไข อัปเดตความคืบหน้าให้ท่านเห็น',
  },
  {
    icon: CheckCircle2,
    status: 'done' as CaseStatus,
    statusLabel: 'ปิดเรื่อง',
    title: 'สรุปผลให้ท่านทราบ',
    desc: 'ปิดเรื่องพร้อมสรุปผล ท่านตรวจสอบและให้ข้อเสนอแนะได้ โปร่งใส ตรวจสอบได้',
  },
] as const;

const trustItems = [
  { icon: Landmark, label: 'ผ่าน กก.ทร.', desc: 'เรื่องงบประมาณต้องผ่านความรับผิดชอบ' },
  { icon: Contact, label: 'บัตรประชาชน 13 หลัก', desc: 'ยืนยันตัวตนปลอดภัย ไม่รั่วไหล' },
  { icon: ShieldCheck, label: 'PDPA พ.ร.บ. 2562', desc: 'คุ้มครองข้อมูลส่วนบุคคลของท่าน' },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <SiteHeader />

      <main>
        {/* ===== Hero: asymmetric editorial + live ticker ===== */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-12">
            {/* ซ้าย: headline + CTA */}
            <div className="lg:col-span-7">
              <p className="text-sm font-semibold text-accent">
                องค์การบริหารส่วนตำบลหัวงัว · อ.ยางตลาด จ.กาฬสินธุ์
              </p>
              <h1 className="mt-4 text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                แจ้งเรื่อง
                <br />
                ร้องเรียก
                <br />
                ได้ที่นี่<span className="text-accent-strong">.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
                เจ้าหน้าที่ติดตามให้ทุกขั้นตอน โปร่งใส ตรวจสอบได้ แจ้งได้ด้วยตัวท่านเอง
                ทั้งเรื่องทาง ไฟฟ้า น้ำ สิ่งแวดล้อม และสวัสดิการ
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg">
                  <Link href="/intake">
                    แจ้งเรื่องใหม่
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/track">
                    <Search className="h-5 w-5" aria-hidden="true" />
                    ติดตามเรื่องที่แจ้ง
                  </Link>
                </Button>
              </div>
            </div>

            {/* ขวา: live ticker (transparency = wow) */}
            <aside className="lg:col-span-5">
              <Reveal delay={120}>
                <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          aria-hidden="true"
                          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-strong/60"
                        />
                        <span
                          aria-hidden="true"
                          className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-strong"
                        />
                      </span>
                      <h2 className="text-sm font-semibold">เริ่มรับเรื่องล่าสุด</h2>
                    </div>
                    <span className="rounded-pill bg-accent-sunken px-2.5 py-0.5 text-xs font-semibold tracking-wide text-accent-strong">
                      LIVE
                    </span>
                  </div>

                  <ul className="mt-4 flex flex-col divide-y divide-border">
                    {liveFeed.map(({ icon: Icon, title, place, ago, status, statusLabel }) => (
                      <li key={title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-md bg-surface-sunken text-accent-strong">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {place}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {ago}
                            </span>
                          </p>
                        </div>
                        <CaseStatusBadge status={status} label={statusLabel} />
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/track"
                    className="mt-4 inline-flex min-h-touch w-full items-center justify-center gap-1.5 rounded-md border border-border-strong px-4 text-sm font-semibold text-accent-strong transition-colors duration-normal ease-out-expo hover:bg-accent-sunken"
                  >
                    เปิดดูทั้งหมด
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            </aside>
          </div>
        </section>

        {/* ===== Bento: หมวดเรื่อง ไม่สม่ำเสมอ ===== */}
        <section aria-labelledby="categories" className="border-b border-border bg-surface-sunken">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="categories" className="text-2xl font-bold sm:text-3xl">
                แจ้งได้ทุกหมวด
              </h2>
              <p className="max-w-sm text-sm text-muted">
                เลือกหมวดที่ใกล้เรื่องของท่าน เจ้าหน้าที่ส่งต่อให้ถึงมือที่รับผิดชอบ
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 auto-rows-[minmax(7.5rem,auto)] lg:grid-cols-4">
              {categories.map(
                (
                  { icon: Icon, label, blurb, span, feature, featureTitle, featureMeta, featureStatus },
                  i,
                ) => (
                  <Reveal key={label} delay={i * 70} className={span}>
                    <Link
                      href="/intake"
                      className="group flex h-full min-h-[7.5rem] flex-col rounded-lg border border-border bg-surface-raised p-4 transition-colors duration-normal ease-out-expo hover:border-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:p-5"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-sunken text-accent-strong ring-1 ring-border">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="mt-3 text-lg font-semibold">{label}</h3>
                      <p className="mt-1 text-sm text-muted">{blurb}</p>

                      {feature ? (
                        <div className="mt-4 border-t border-border pt-4">
                          <p className="text-xs font-semibold text-muted">เรื่องเด่นสัปดาห์นี้</p>
                          <p className="mt-1.5 text-base font-semibold text-ink">
                            {featureTitle}
                          </p>
                          <p className="mt-1 text-xs text-muted">{featureMeta}</p>
                          {featureStatus ? (
                            <div className="mt-3">
                              <CaseStatusBadge status={featureStatus} />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-accent-strong">
                          แจ้งเรื่องนี้
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-normal ease-out-expo group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      )}
                    </Link>
                  </Reveal>
                ),
              )}
            </div>
          </div>
        </section>

        {/* ===== Scrolly: เรื่องของคุณเดินทางยังไง (sticky 2-col + timeline rail) ===== */}
        <section aria-labelledby="how-it-works" className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <h2 id="how-it-works" className="text-2xl font-bold sm:text-3xl">
                  เรื่องของท่านเดินทางยังไง
                </h2>
                <p className="mt-4 max-w-md text-lg text-muted">
                  แจ้งครั้งเดียว เราเดินเรื่องให้ทุกขั้น ท่านติดตามได้ทุกจังหวะ
                  จนปิดเรื่องพร้อมสรุปผล
                </p>
                <Button asChild variant="secondary" className="mt-6">
                  <Link href="/intake">
                    เริ่มแจ้งเรื่อง
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <ol className="relative">
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-[1.375rem] top-2 w-px bg-border"
                />
                {flowSteps.map(({ icon: Icon, status, statusLabel, title, desc }, i) => (
                  <li key={title} className="relative pb-8 last:pb-0">
                    <Reveal delay={i * 90}>
                      <div className="flex gap-4">
                        <span className="relative z-10 flex h-11 w-11 flex-none items-center justify-center rounded-md bg-surface-raised text-accent-strong ring-1 ring-border">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <CaseStatusBadge status={status} label={statusLabel} />
                          <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                          <p className="mt-1 text-muted">{desc}</p>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ===== Trust strip: กก.ทร. · บัตร 13 หลัก · PDPA ===== */}
        <section aria-labelledby="trust" className="border-b border-border bg-surface-sunken">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            <h2 id="trust" className="sr-only">
              มาตรฐานและการคุ้มครอง
            </h2>
            <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
              {trustItems.map(({ icon: Icon, label, desc }) => (
                <li key={label} className="flex items-start gap-3 bg-surface-raised p-4 sm:p-5">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-surface-sunken text-accent-strong ring-1 ring-border">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-base font-semibold">{label}</p>
                    <p className="mt-0.5 text-sm text-muted">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter>
        <p className="mt-3 text-xs">
          หน้านี้จัดแสดงรายการตัวอย่างเพื่อการออกแบบ ยังไม่เชื่อมกับฐานข้อมูลจริง
        </p>
      </SiteFooter>
    </div>
  );
}