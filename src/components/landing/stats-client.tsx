'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Clock, Users, CheckCircle2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StatItem {
  label: string;
  value: string;
  /** เปอร์เซ็นต์เปลี่ยนแปลง (เช่น "+12%") หรือ null ถ้าไม่แสดง */
  change: string | null;
  icon: 'TrendingUp' | 'Clock' | 'Users' | 'CheckCircle2';
  /**
   * § ชื่อ Tailwind class ไม่ใช่ค่าสี — เปลี่ยนชื่อจาก color/bgColor ตั้งใจให้
   * typecheck ชี้ทุก call site ตอนย้ายจาก inline style ถ้าคงชื่อเดิมไว้ ค่าที่เป็น
   * ชื่อ class จะไหลเข้า style={{ color: 'text-accent' }} แล้ว browser ทิ้งเงียบ ๆ
   */
  colorClass: string;
  bgClass: string;
}

const ICONS: Record<StatItem['icon'], LucideIcon> = {
  TrendingUp,
  Clock,
  Users,
  CheckCircle2,
};

/**
 * Client component สำหรับแสดง Stats พร้อม framer-motion animation
 * (แยกจาก Stats.tsx ซึ่งเป็น Server Component ดึงข้อมูลจาก DB)
 */
export function StatsClient({ stats, hasData }: { stats: StatItem[]; hasData: boolean }) {
  return (
    <section className="relative py-16 lg:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = ICONS[stat.icon];
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-lg p-6 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', stat.bgClass)}>
                    <Icon className={cn('h-6 w-6', stat.colorClass)} />
                  </div>
                  {stat.change && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        stat.bgClass,
                        stat.colorClass,
                      )}
                    >
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className={cn('text-3xl font-bold', stat.colorClass)}>{stat.value}</p>
                  <p className="mt-1 text-sm text-muted">{stat.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
        {!hasData && (
          <p className="mt-6 text-center text-xs text-muted">
            *สถิติจะแสดงเมื่อระบบเริ่มมีข้อมูลใช้งานจริง
          </p>
        )}
      </div>
    </section>
  );
}
