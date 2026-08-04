'use client';

import { motion } from 'framer-motion';
import { Bell, Search, Users, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * § แยกเป็นสอง field แทนค่าสีตัวเดียว — ค่าเดิม `color` ถูกใช้ 3 บทบาทพร้อมกัน
 * (ขอบวงกลม, สีไอคอน, พื้นของตัวเลข) ซึ่งเขียนเป็น class เดียวไม่ได้
 *
 * เคยพิจารณาใช้ currentColor + border-current/bg-current เพื่อเหลือ field เดียว
 * แต่ตัวเลขต้องมี text-on-accent อยู่บนพื้นนั้นด้วย ซึ่งจะเปลี่ยน currentColor
 * ของ element เดียวกันไปเป็นสีขาว ทำให้ bg-current กลายเป็นขาวตามไปด้วย
 */
const steps = [
  {
    number: '01',
    title: 'แจ้งเหตุ',
    description: 'กรอกรายละเอียดปัญหา แนบรูปภาพ และระบุตำแหน่ง',
    icon: Bell,
    toneClass: 'text-accent',
    numberBgClass: 'bg-accent',
  },
  {
    number: '02',
    title: 'ตรวจสอบ',
    description: 'เจ้าหน้าที่รับเรื่อง ตรวจสอบความถูกต้อง และจัดลำดับความสำคัญ',
    icon: Search,
    toneClass: 'text-accent-strong',
    numberBgClass: 'bg-accent-strong',
  },
  {
    number: '03',
    title: 'มอบหมาย',
    description: 'มอบหมายงานให้หน่วยงานที่รับผิดชอบ พร้อมแผนการดำเนินงาน',
    icon: Users,
    toneClass: 'text-accent',
    numberBgClass: 'bg-accent',
  },
  {
    number: '04',
    title: 'เสร็จสิ้น',
    description: 'ดำเนินการแก้ไข ถ่ายภาพหลักฐาน และปิดงานพร้อมรายงาน',
    icon: CheckCircle2,
    toneClass: 'text-accent',
    numberBgClass: 'bg-accent',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold lg:text-4xl">
            <span className="gradient-text">ขั้นตอนการทำงาน</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted lg:text-lg">
            ระบบติดตามแบบเรียลไทม์ ทุกขั้นตอนโปร่งใส ตรวจสอบได้ตลอดเวลา
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              {/* Connector line — เชื่อมระหว่างวงกลม (lg+ เท่านั้น) */}
              {i < steps.length - 1 && (
                <div className="bg-accent-gradient absolute left-1/2 top-16 hidden h-px w-full opacity-30 lg:block" />
              )}

              <div className="relative flex flex-col items-center text-center">
                <div
                  className={cn(
                    'bg-surface flex h-32 w-32 items-center justify-center rounded-full border-4 border-current',
                    step.toneClass,
                  )}
                >
                  <step.icon className="h-12 w-12" />
                </div>

                {/* ตัวเลขขั้น — วางบนขอบวงกลม (overlap ตั้งใจ) แต่ใช้ padding-top ดัน h3 ลงมาไม่ให้ทับ */}
                <div
                  className={cn(
                    'text-on-accent absolute top-28 flex h-12 w-12 items-center justify-center rounded-full font-bold shadow-lg ring-4 ring-white',
                    step.numberBgClass,
                  )}
                >
                  {step.number}
                </div>

                <h3 className="mt-16 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
