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

const serviceChips = [
  { label: 'ไฟฟ้าสาธารณะ', icon: Zap },
  { label: 'ประปาหมู่บ้าน', icon: Droplets },
  { label: 'ถนน', icon: MapPin },
  { label: 'การระบายน้ำ', icon: Activity },
  { label: 'ซ่อมบำรุง', icon: Wrench },
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
      <div
        className="absolute top-32 -left-20 w-72 h-72 rounded-full blur-3xl float-animate"
        style={{ backgroundColor: 'oklch(55% 0.13 160 / 0.1)' }}
      />
      <div
        className="absolute bottom-0 -right-20 w-96 h-96 rounded-full blur-3xl float-animate"
        style={{
          backgroundColor: 'oklch(82% 0.14 80 / 0.1)',
          animationDelay: '2s',
        }}
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
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'oklch(94% 0.04 160)',
                color: 'oklch(45% 0.15 160)',
                borderColor: 'oklch(90% 0.05 160)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="pulse-ring absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'oklch(55% 0.13 160)' }}
                />
                <span
                  className="relative h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'oklch(45% 0.15 160)' }}
                />
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
              className="mt-3 text-base font-semibold lg:text-lg"
              style={{ color: 'oklch(55% 0.13 160)' }}
            >
              กองช่าง องค์การบริหารส่วนตำบลหัวงัว
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.5, duration: reduce ? 0 : 0.6 }}
              className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted lg:mx-0 lg:text-lg"
            >
              ระบบรับแจ้งเหตุและติดตามงานบริการสาธารณูปโภคออนไลน์
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
                className="h-12 px-7 text-base shadow-lg"
                style={{
                  background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
                  color: 'oklch(99% 0.005 145)',
                  boxShadow: '0 10px 40px -10px oklch(55% 0.13 160 / 0.3)',
                }}
                asChild
              >
                <Link href="#tracking">
                  <Bell className="mr-2 h-5 w-5" />
                  แจ้งเหตุออนไลน์
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-2 px-7 text-base hover:bg-surface-sunken"
                asChild
              >
                <Link href="#tracking">
                  <Search className="mr-2 h-5 w-5" />
                  ติดตามงาน
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
                <ShieldCheck className="h-4 w-4" style={{ color: 'oklch(55% 0.13 160)' }} />
                <span>ข้อมูลโปร่งใส</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" style={{ color: 'oklch(55% 0.13 160)' }} />
                <span>ตอบสนอง 24 ชม.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4" style={{ color: 'oklch(55% 0.13 160)' }} />
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

function HeroTrackingCard({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative">
      {/* Floating accent cards */}
      <motion.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="glass absolute -left-6 -top-6 z-20 hidden rounded-2xl p-3 shadow-lg sm:block"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'oklch(94% 0.04 160)' }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: 'oklch(55% 0.13 160)' }} />
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
        className="glass absolute -bottom-4 -right-4 z-20 hidden rounded-2xl p-3 shadow-lg sm:block"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'oklch(95% 0.05 80)' }}
          >
            <Clock className="h-4 w-4" style={{ color: 'oklch(82% 0.14 80)' }} />
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
        className="relative overflow-hidden rounded-3xl border bg-surface-raised shadow-2xl"
        style={{ boxShadow: '0 25px 50px -12px oklch(55% 0.13 160 / 0.1)' }}
      >
        {/* Header */}
        <div
          className="p-5 text-white"
          style={{
            background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs" style={{ color: 'oklch(94% 0.04 160)' }}>
                เลขใบแจ้ง
              </p>
              <p className="text-sm font-bold">SSC-2026-0847</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 backdrop-blur" style={{ backgroundColor: 'oklch(100% 0 0 / 0.2)' }}>
              <motion.span
                animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: 'oklch(82% 0.14 80)' }}
              />
              <span className="text-[11px] font-medium">กำลังดำเนินการ</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Service info */}
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'oklch(95% 0.05 80)' }}
            >
              <Zap className="h-5 w-5" style={{ color: 'oklch(82% 0.14 80)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ไฟฟ้าสาธารณะ</p>
              <p className="line-clamp-2 text-xs text-muted">
                หลอดไฟถนนหน้าบ้านเลขที่ 88 หมู่ 5 ขาด 3 ดวง
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 rounded-lg p-2.5 text-xs text-muted" style={{ backgroundColor: 'oklch(96% 0.02 145 / 0.5)' }}>
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'oklch(55% 0.13 160)' }} />
            <span className="truncate">หมู่ที่ 5 บ้านหัวงัว ต.หัวงัว อ.ยางตลาด จ.กาฬสินธุ์</span>
          </div>

          {/* Progress timeline */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">ความคืบหน้า</span>
              <span className="font-bold" style={{ color: 'oklch(55% 0.13 160)' }}>
                65%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'oklch(96% 0.02 145)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : 0.8, ease: 'easeOut' }}
                className="relative h-full rounded-full"
                style={{
                  background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
                }}
              >
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
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                      step.active ? 'ring-4' : ''
                    }`}
                    style={{
                      backgroundColor: step.done
                        ? 'oklch(55% 0.13 160)'
                        : 'oklch(96% 0.02 145)',
                      color: step.done ? 'oklch(99% 0.005 145)' : 'oklch(50% 0.02 160)',
                      ...(step.active && { outline: '3px solid oklch(94% 0.04 160)' }),
                    }}
                  >
                    {step.done ? '✓' : i + 1}
                  </motion.div>
                  <span className="text-center text-[10px] text-muted">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: 'oklch(90% 0.01 145)' }}>
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(to bottom right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
                  color: 'oklch(99% 0.005 145)',
                }}
              >
                สช
              </div>
              <div>
                <p className="text-[11px] font-medium">นายสมชาย ใจดี</p>
                <p className="text-[10px] text-muted">ช่างไฟฟ้า • เจ้าหน้าที่</p>
              </div>
            </div>
            <span className="text-[10px] font-medium" style={{ color: 'oklch(55% 0.13 160)' }}>
              อัปเดต 2 นาทีที่แล้ว
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
