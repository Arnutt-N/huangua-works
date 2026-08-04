'use client';

import { motion } from 'framer-motion';
import { Zap, Droplets, MapPin, Activity, Wrench, TreePine } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * § field เป็น "ชื่อ class" ไม่ใช่ค่าสี — ตั้งใจเปลี่ยนชื่อจาก color/bgColor
 * เพื่อให้ typecheck ชี้ทุก call site ตอนย้าย ถ้าคงชื่อเดิมไว้แล้วใส่ชื่อ class ลงไป
 * มันจะ compile ผ่านแล้วไป render เป็น style={{ color: 'text-accent' }} ซึ่ง browser
 * ทิ้งเงียบ ๆ — สีหายโดยไม่มีอะไรเตือน
 *
 * § ไอคอนบนพื้น *-soft ต้องใช้ *-ink เท่านั้น (กฎใน tokens.css §status ink)
 * สีเต็มบนพื้น soft ให้ ~1.5–3.6:1 ซึ่งอ่านไม่ออก
 */
const services = [
  {
    title: 'ไฟฟ้าสาธารณะ',
    description: 'หลอดไฟถนนชำรุด ไฟฟ้าสาธารณะขัดข้อง',
    icon: Zap,
    iconClass: 'text-warning-ink',
    bgClass: 'bg-warning-soft',
  },
  {
    title: 'ประปาหมู่บ้าน',
    description: 'ท่อประปารั่ว น้ำไม่ไหล คุณภาพน้ำ',
    icon: Droplets,
    iconClass: 'text-accent',
    bgClass: 'bg-accent-100',
  },
  {
    title: 'ถนน',
    description: 'ถนนชำรุด หลุมบ่อ ต้องการซ่อมแซม',
    icon: MapPin,
    iconClass: 'text-danger-ink',
    bgClass: 'bg-danger-soft',
  },
  {
    title: 'การระบายน้ำ',
    description: 'ท่อระบายน้ำอุดตัน น้ำท่วมขัง',
    icon: Activity,
    iconClass: 'text-accent',
    bgClass: 'bg-accent-100',
  },
  {
    title: 'ซ่อมบำรุง',
    description: 'สิ่งก่อสร้างสาธารณะ อาคาร สะพาน',
    icon: Wrench,
    iconClass: 'text-warning-ink',
    bgClass: 'bg-warning-soft',
  },
  {
    title: 'สิ่งแวดล้อม',
    description: 'ขยะสาธารณะ ต้นไม้หักโค่น',
    icon: TreePine,
    iconClass: 'text-accent',
    bgClass: 'bg-accent-100',
  },
];

export function Services() {
  return (
    <section id="services" className="bg-surface-sunken relative py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold lg:text-4xl">
            <span className="gradient-text">บริการของเรา</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted lg:text-lg">
            แจ้งเหตุได้ทุกประเภท ทีมงานพร้อมดำเนินการตรวจสอบและแก้ไขอย่างรวดเร็ว
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
              className="glass rounded-lg p-6 shadow-lg transition-shadow hover:shadow-xl"
            >
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl', service.bgClass)}>
                <service.icon className={cn('h-7 w-7', service.iconClass)} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{service.title}</h3>
              <p className="mt-2 text-sm text-muted">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
