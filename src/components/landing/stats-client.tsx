'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Clock, Users, CheckCircle2, type LucideIcon } from 'lucide-react';

export interface StatItem {
  label: string;
  value: string;
  /** เปอร์เซ็นต์เปลี่ยนแปลง (เช่น "+12%") หรือ null ถ้าไม่แสดง */
  change: string | null;
  icon: 'TrendingUp' | 'Clock' | 'Users' | 'CheckCircle2';
  color: string;
  bgColor: string;
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
                className="glass rounded-2xl p-6 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: stat.bgColor }}
                  >
                    <Icon className="h-6 w-6" style={{ color: stat.color }} />
                  </div>
                  {stat.change && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: stat.bgColor,
                        color: stat.color,
                      }}
                    >
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
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
