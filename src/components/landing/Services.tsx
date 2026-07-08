'use client';

import { motion } from 'framer-motion';
import { Zap, Droplets, MapPin, Activity, Wrench, TreePine } from 'lucide-react';

const services = [
  {
    title: 'ไฟฟ้าสาธารณะ',
    description: 'หลอดไฟถนนชำรุด ไฟฟ้าสาธารณะขัดข้อง',
    icon: Zap,
    color: 'oklch(82% 0.14 80)',
    bgColor: 'oklch(95% 0.05 80)',
  },
  {
    title: 'ประปาหมู่บ้าน',
    description: 'ท่อประปารั่ว น้ำไม่ไหล คุณภาพน้ำ',
    icon: Droplets,
    color: 'oklch(55% 0.13 160)',
    bgColor: 'oklch(94% 0.04 160)',
  },
  {
    title: 'ถนน',
    description: 'ถนนชำรุด หลุมบ่อ ต้องการซ่อมแซม',
    icon: MapPin,
    color: 'oklch(60% 0.22 25)',
    bgColor: 'oklch(95% 0.05 25)',
  },
  {
    title: 'การระบายน้ำ',
    description: 'ท่อระบายน้ำอุดตัน น้ำท่วมขัง',
    icon: Activity,
    color: 'oklch(55% 0.13 160)',
    bgColor: 'oklch(94% 0.04 160)',
  },
  {
    title: 'ซ่อมบำรุง',
    description: 'สิ่งก่อสร้างสาธารณะ อาคาร สะพาน',
    icon: Wrench,
    color: 'oklch(82% 0.14 80)',
    bgColor: 'oklch(95% 0.05 80)',
  },
  {
    title: 'สิ่งแวดล้อม',
    description: 'ขยะสาธารณะ ต้นไม้หักโค่น',
    icon: TreePine,
    color: 'oklch(55% 0.13 160)',
    bgColor: 'oklch(94% 0.04 160)',
  },
];

export function Services() {
  return (
    <section id="services" className="relative py-16 lg:py-24" style={{ backgroundColor: 'oklch(96% 0.02 145)' }}>
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
              className="glass rounded-2xl p-6 shadow-lg transition-shadow hover:shadow-xl"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: service.bgColor }}
              >
                <service.icon className="h-7 w-7" style={{ color: service.color }} />
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
