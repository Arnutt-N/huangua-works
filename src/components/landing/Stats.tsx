'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Clock, Users, CheckCircle2 } from 'lucide-react';

const stats = [
  {
    label: 'เรื่องดำเนินการวันนี้',
    value: '23',
    change: '+12%',
    icon: TrendingUp,
    color: 'oklch(55% 0.13 160)',
    bgColor: 'oklch(94% 0.04 160)',
  },
  {
    label: 'เวลาตอบสนองเฉลี่ย',
    value: '18 ชม.',
    change: '-24%',
    icon: Clock,
    color: 'oklch(82% 0.14 80)',
    bgColor: 'oklch(95% 0.05 80)',
  },
  {
    label: 'ผู้ใช้งานทั้งหมด',
    value: '2,847',
    change: '+8%',
    icon: Users,
    color: 'oklch(55% 0.13 160)',
    bgColor: 'oklch(94% 0.04 160)',
  },
  {
    label: 'อัตราความสำเร็จ',
    value: '94%',
    change: '+2%',
    icon: CheckCircle2,
    color: 'oklch(55% 0.13 160)',
    bgColor: 'oklch(94% 0.04 160)',
  },
];

export function Stats() {
  return (
    <section className="relative py-16 lg:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: stat.bgColor,
                    color: stat.color,
                  }}
                >
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
