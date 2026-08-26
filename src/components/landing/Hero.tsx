'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
  Search,
  ArrowRight,
  Zap,
  ShieldCheck,
  Activity,
  MapPin,
  Clock,
  Droplets,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { cn } from '@/lib/cn';
import { COPY } from '@/lib/copy';

const serviceChips = [
  { label: 'ไฟฟ้าสาธารณะ', icon: Zap },
  { label: 'ประปาหมู่บ้าน', icon: Droplets },
  { label: 'ถนน', icon: MapPin },
  { label: 'การระบายน้ำ', icon: Activity },
  { label: 'เรื่องอื่นๆ', icon: Wrench },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="home"
      className="relative overflow-hidden pt-28 pb-16 lg:pt-36 lg:pb-24 mesh-gradient"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 thai-pattern pointer-events-none" />
      <div className="bg-accent/10 absolute top-32 -left-20 w-72 h-72 rounded-full blur-3xl float-animate" />
      <div
        className="bg-accent-gold/10 absolute bottom-0 -right-20 w-96 h-96 rounded-full blur-3xl float-animate"
        // animationDelay ไม่ใช่สี — คงเป็น inline เพราะผูกกับ keyframe float-animate
        style={{ animationDelay: '2s' }}
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left: Text content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduce ? 0 : 0.7, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.2 }}
              className="bg-accent-100 text-accent-strong border-accent-200 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
            >
              <span className="relative flex h-2 w-2">
                <span className="pulse-ring bg-accent absolute inset-0 rounded-full" />
                <span className="bg-accent-strong relative h-2 w-2 rounded-full" />
              </span>
              ระบบออนไลน์ใหม่ ปี 2569
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.3, duration: reduce ? 0 : 0.6 }}
              className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              <span className="gradient-text">SMART SERVICE</span>
              <br />
              <span className="text-ink">CENTER</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.4, duration: reduce ? 0 : 0.6 }}
              className="text-accent mt-3 text-base font-semibold lg:text-lg"
            >
              กองช่าง {COPY.ORG_FULL}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.5, duration: reduce ? 0 : 0.6 }}
              className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted lg:mx-0 lg:text-lg"
            >
              {COPY.ORG_SYSTEM_DESC}
              ประชาชนสามารถติดตามสถานะการดำเนินงานได้แบบเรียลไทม์
              เพื่อการบริการที่รวดเร็ว โปร่งใส และมีประสิทธิภาพ
            </motion.p>

            {/* Service chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.6 }}
              className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start"
            >
              {serviceChips.map((chip, i) => (
                <motion.span
                  key={chip.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: reduce ? 0 : 0.6 + i * 0.08,
                  }}
                  whileHover={reduce ? undefined : { scale: 1.05 }}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-surface-raised px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:border-accent hover:text-accent"
                >
                  <chip.icon className="h-3.5 w-3.5" />
                  {chip.label}
                </motion.span>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.7 }}
              className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"
            >
              <Button
                size="lg"
                className="shadow-accent-glow h-12 px-7 text-base"
                asChild
              >
                <Link href="/intake">
                  <Bell className="mr-2 h-5 w-5" />
                  {COPY.INTAKE_LABEL}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-2 px-7 text-base hover:bg-surface-sunken"
                asChild
              >
                <Link href="/track">
                  <Search className="mr-2 h-5 w-5" />
                  {COPY.TRACK_LABEL}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.9 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted lg:justify-start"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="text-accent h-4 w-4" />
                <span>ข้อมูลโปร่งใส</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="text-accent h-4 w-4" />
                <span>ตอบสนอง 24 ชม.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="text-accent h-4 w-4" />
                <span>ติดตามเรียลไทม์</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Tracking demo card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.3 }}
            className="relative"
          >
            <HeroTrackingCard reduce={!!reduce} />
          </motion.div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}

/**
 * การ์ดตัวอย่างบนหน้าแรก — ห้ามใส่ข้อมูลจริงหรือข้อมูลที่ดูเหมือนจริง
 *
 * § หน้านี้เป็นหน้าสาธารณะ ไม่ต้องล็อกอิน ทุกอย่างที่แสดงตรงนี้คนทั้งอินเทอร์เน็ตเห็น
 * เดิมการ์ดนี้โชว์เลขติดตามที่ดูเหมือนของจริง บ้านเลขที่เจาะจง และชื่อ-นามสกุลเต็ม
 * ของเจ้าหน้าที่ ซึ่งแม้เป็นข้อมูลสมมติก็สอนผู้ใช้ผิดว่าระบบเปิดเผยข้อมูลระดับนั้นได้
 * และถ้าวันหนึ่งมีคนเปลี่ยนมาดึงข้อมูลจริงจาก DB จะกลายเป็นการเปิดเผยข้อมูลส่วนบุคคล
 * ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ทันทีโดยไม่มีใครทันสังเกต
 *
 * หลักที่ใช้: แสดงได้เฉพาะ "ประเภทงาน + พื้นที่ระดับหมู่บ้าน + สถานะ" เท่านั้น
 * ห้ามมีเลขติดตามที่ใช้ค้นหาได้จริง บ้านเลขที่ ชื่อบุคคล หรือเบอร์โทร
 */
function HeroTrackingCard({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative">
      {/* Floating accent cards */}
      <motion.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="glass absolute -left-6 -top-6 z-20 hidden rounded-lg p-3 shadow-lg sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="bg-accent-100 flex h-9 w-9 items-center justify-center rounded-full">
            <ShieldCheck className="text-accent h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold">ดำเนินการเสร็จสิ้น</p>
            <p className="text-[10px] text-muted">วันนี้ 23 เรื่อง</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={reduce ? undefined : { y: [0, 10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="glass absolute -bottom-4 -right-4 z-20 hidden rounded-lg p-3 shadow-lg sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="bg-warning-soft flex h-9 w-9 items-center justify-center rounded-full">
            <Clock className="text-warning-ink h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold">เวลาตอบสนอง</p>
            <p className="text-[10px] text-muted">เฉลี่ย 18 ชม.</p>
          </div>
        </div>
      </motion.div>

      {/* Main card */}
      <motion.div
        whileHover={reduce ? undefined : { y: -5 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="shadow-accent-drop relative overflow-hidden rounded-xl border bg-surface-raised shadow-2xl"
      >
        {/* Header */}
        <div className="bg-accent-gradient p-5 text-on-accent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-100 text-xs">เลขติดตาม</p>
              <p className="text-sm font-bold">HG123456789</p>
            </div>
            {/* § พื้นขาวโปร่งคงเป็น literal — surface-raised ไม่ใช่สีขาวในธีมมืด
                การแทนด้วย token จะทำให้ป้ายนี้กลืนหายบน gradient (tokens.css ใช้
                pattern เดียวกันใน .glass) */}
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur"
              style={{ backgroundColor: 'oklch(100% 0 0 / 0.2)' }}
            >
              <motion.span
                animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-accent-gold h-2 w-2 rounded-full"
              />
              <span className="text-[11px] font-medium">กำลังดำเนินการ</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Service info */}
          <div className="flex items-start gap-3">
            <div className="bg-warning-soft flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
              <Zap className="text-warning-ink h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ไฟฟ้าสาธารณะ</p>
              <p className="line-clamp-2 text-xs text-muted">หลอดไฟถนนสาธารณะชำรุด 3 ดวง</p>
            </div>
          </div>

          {/* Location */}
          <div className="bg-surface-sunken/50 flex items-center gap-2 rounded-lg p-2.5 text-xs text-muted">
            <MapPin className="text-accent h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">หมู่ที่ 5 ต.หัวงัว อ.ยางตลาด จ.กาฬสินธุ์</span>
          </div>

          {/* Progress timeline */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">ความคืบหน้า</span>
              <span className="text-accent font-bold">65%</span>
            </div>
            {/* § accent-sunken ไม่ใช่ surface-sunken — สองตัวนี้ค่าเท่ากันเป๊ะในธีม light
                แต่ต่างกันในธีมมืด (27% 0.03 vs 27% 0.02) แถบนี้เป็นรางของ progress
                ซึ่งความหมายผูกกับ accent จึงต้องเลือกตัวที่ถูกไม่ใช่ตัวที่ดูเหมือน */}
            <div className="bg-accent-sunken h-2 overflow-hidden rounded-full">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : 0.8, ease: 'easeOut' }}
                className="bg-accent-gradient relative h-full rounded-full"
              >
                {/* § ประกายวิ่งบนแถบ — พื้นขาวโปร่งคงเป็น literal ด้วยเหตุผลเดียวกับ
                    ป้ายสถานะด้านบน (ดู .glass ใน tokens.css) */}
                <motion.div
                  animate={reduce ? undefined : { x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 skew-x-12"
                  style={{ backgroundColor: 'oklch(100% 0 0 / 0.3)' }}
                />
              </motion.div>
            </div>

            {/* Timeline dots */}
            <div className="flex justify-between pt-2">
              {[
                { label: 'รับเรื่อง', done: true },
                { label: 'มอบหมาย', done: true },
                { label: 'ลงพื้นที่', done: true, active: true },
                { label: 'เสร็จสิ้น', done: false },
              ].map((step, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: reduce ? 0 : 0.5 + i * 0.15,
                      type: 'spring',
                    }}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold',
                      step.done ? 'bg-accent text-on-accent' : 'bg-accent-sunken text-muted',
                      step.active && 'ring-4 outline-accent-100 outline-3',
                    )}
                  >
                    {step.done ? '✓' : i + 1}
                  </motion.div>
                  <span className="text-center text-[10px] text-muted">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div className="border-border flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-2">
              <div className="bg-accent-gradient-br flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-on-accent">
                <Wrench className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[11px] font-medium">เจ้าหน้าที่ผู้รับผิดชอบ</p>
                <p className="text-[10px] text-muted">งานไฟฟ้า • กองช่าง</p>
              </div>
            </div>
            <span className="text-accent text-[10px] font-medium">อัปเดต 2 นาทีที่แล้ว</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
