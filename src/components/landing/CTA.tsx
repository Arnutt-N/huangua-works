'use client';

import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

export function CTA() {
  return (
    <section className="relative py-16 lg:py-24 mesh-gradient">
      <div className="absolute inset-0 thai-pattern pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-8 text-center shadow-2xl lg:p-12"
        >
          <h2 className="text-3xl font-bold lg:text-4xl">
            <span className="gradient-text">พร้อมเริ่มใช้งานแล้วหรือยัง?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted lg:text-lg">
            แจ้งเหตุได้ทันที ติดตามสถานะแบบเรียลไทม์
            ทีมงานพร้อมให้บริการตลอด 24 ชั่วโมง
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 px-8 text-base shadow-lg"
              style={{
                background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
                color: 'oklch(99% 0.005 145)',
                boxShadow: '0 10px 40px -10px oklch(55% 0.13 160 / 0.3)',
              }}
              asChild
            >
              <Link href="/intake">
                <Bell className="mr-2 h-5 w-5" />
                เริ่มแจ้งเหตุเลย
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-2 px-8 text-base hover:bg-surface-sunken"
              asChild
            >
              <Link href="#services">ดูบริการทั้งหมด</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
