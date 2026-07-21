import { desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { caseStatsDaily } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { StatsClient, type StatItem } from './stats-client';

/**
 * Stats — แสดงตัวเลขจริงจาก `case_stats_daily` (refresh โดย cron `stats-refresh`)
 *
 * ถ้ายังไม่มีข้อมูล (ระบบใหม่ / cron ยังไม่ทำงาน / DB ล่ม) → แสดง "—" แทน
 * ไม่แสดงตัวเลขปลอมเพราะเป็นความน่าเชื่อถือของหน่วยงานราชการ
 *
 * เดิมเป็นเลขปลอมตายตัว (23/18 ชม./2,847/94%) — เปลี่ยนเป็นข้อมูลจริงแล้ว
 *
 * หมายเหตุเรื่อง rendering:
 * - Component นี้ query DB (async) → ต้องถูกห่อด้วย <Suspense> ใน page
 * - ใช้ try/catch เพื่อ resilience: ถ้า DB ล่มตอน build/runtime จะแสดง "—" ไม่พังทั้งหน้า
 */
export async function Stats() {
  let latest: typeof caseStatsDaily.$inferSelect | undefined;
  try {
    latest = await firstOrUndefined(
      getDb().then((db) =>
        db
          .select()
          .from(caseStatsDaily)
          .orderBy(desc(caseStatsDaily.date))
          .limit(1)
      )
    );
  } catch {
    // Build-time ไม่มี DB / DB ล่ม / case_stats_daily ยังว่าง → แสดง "—"
    latest = undefined;
  }

  const hasData = !!latest;

  const stats: StatItem[] = [
    {
      label: 'เรื่องดำเนินการ',
      value: hasData ? formatNumber(latest!.totalInProgress + latest!.totalReceived) : '—',
      // change% ไม่แสดงเพราะต้องเทียบกับวันก่อนหน้า (เก็บไว้ทำใน PR #3 reports)
      change: null,
      icon: 'TrendingUp',
      color: 'oklch(55% 0.13 160)',
      bgColor: 'oklch(94% 0.04 160)',
    },
    {
      label: 'เวลาตอบสนองเฉลี่ย',
      value: hasData && latest!.avgResolutionDays != null ? `${latest!.avgResolutionDays} วัน` : '—',
      change: null,
      icon: 'Clock',
      color: 'oklch(82% 0.14 80)',
      bgColor: 'oklch(95% 0.05 80)',
    },
    {
      label: 'เรื่องรับทั้งหมด',
      value: hasData ? formatNumber(latest!.totalReceived) : '—',
      change: null,
      icon: 'Users',
      color: 'oklch(55% 0.13 160)',
      bgColor: 'oklch(94% 0.04 160)',
    },
    {
      label: 'เรื่องปิดสำเร็จ',
      value: hasData ? formatNumber(latest!.totalClosed) : '—',
      change: null,
      icon: 'CheckCircle2',
      color: 'oklch(55% 0.13 160)',
      bgColor: 'oklch(94% 0.04 160)',
    },
  ];

  return <StatsClient stats={stats} hasData={hasData} />;
}

function formatNumber(n: number): string {
  return n.toLocaleString('th-TH');
}
