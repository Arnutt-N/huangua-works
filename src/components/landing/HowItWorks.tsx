'use client';

import { motion } from 'framer-motion';
import { Bell, Search, Users, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'แจ้งเหตุ',
    description: 'กรอกรายละเอียดปัญหา แนบรูปภาพ และระบุตำแหน่ง',
    icon: Bell,
    color: 'oklch(55% 0.13 160)',
  },
  {
    number: '02',
    title: 'ตรวจสอบ',
    description: 'เจ้าหน้าที่รับเรื่อง ตรวจสอบความถูกต้อง และจัดลำดับความสำคัญ',
    icon: Search,
    color: 'oklch(45% 0.15 160)',
  },
  {
    number: '03',
    title: 'มอบหมาย',
    description: 'มอบหมายงานให้ทีมช่างที่เหมาะสม พร้อมแผนการดำเนินงาน',
    icon: Users,
    color: 'oklch(55% 0.13 160)',
  },
  {
    number: '04',
    title: 'เสร็จสิ้น',
    description: 'ดำเนินการแก้ไข ถ่ายภาพหลักฐาน และปิดงานพร้อมรายงาน',
    icon: CheckCircle2,
    color: 'oklch(55% 0.13 160)',
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
                <div
                  className="absolute left-1/2 top-16 hidden h-px w-full lg:block"
                  style={{
                    background:
                      'linear-gradient(to right, oklch(55% 0.13 160 / 0.3), oklch(45% 0.15 160 / 0.3))',
                  }}
                />
              )}

              <div className="relative flex flex-col items-center text-center">
                <div
                  className="flex h-32 w-32 items-center justify-center rounded-full border-4"
                  style={{
                    backgroundColor: 'oklch(99% 0.005 145)',
                    borderColor: step.color,
                  }}
                >
                  <step.icon className="h-12 w-12" style={{ color: step.color }} />
                </div>

                {/* ตัวเลขขั้น — วางบนขอบวงกลม (overlap ตั้งใจ) แต่ใช้ padding-top ดัน h3 ลงมาไม่ให้ทับ */}
                <div
                  className="absolute top-28 flex h-12 w-12 items-center justify-center rounded-full font-bold shadow-lg ring-4 ring-white"
                  style={{
                    backgroundColor: step.color,
                    color: 'oklch(99% 0.005 145)',
                  }}
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
