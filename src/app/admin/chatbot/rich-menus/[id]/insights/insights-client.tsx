'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BarChart3, Eye, Info, MousePointerClick } from 'lucide-react';
import {
  adminApi,
  type RichMenuInsightDaily,
  type RichMenuInsightSummary,
} from '@/app/admin/_lib/admin-api';
import { PageHeader } from '@/components/admin/page-header';
import { cn } from '@/lib/cn';

const PRESETS = [
  { label: '7 วัน', days: 7 },
  { label: '14 วัน', days: 14 },
  { label: '30 วัน', days: 30 },
  { label: '60 วัน', days: 60 },
  { label: '90 วัน', days: 90 },
];

function yyyymmdd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function displayDate(v: string): string {
  return v.length === 8 ? `${v.slice(6, 8)}/${v.slice(4, 6)}` : v;
}

function ImpressionsChart({
  points,
}: {
  points: { date: string; count: number; unique: number }[];
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center gap-2 text-sm text-muted">
        <Info className="h-4 w-4" /> ไม่มีข้อมูลในช่วงเวลาที่เลือก
      </div>
    );
  }
  const W = 640;
  const H = 220;
  const PAD = 24;
  const max = Math.max(...points.map((p) => Math.max(p.count, p.unique)), 1);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - PAD - (v * (H - PAD * 2)) / max;
  const line = (key: 'count' | 'unique') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full min-w-[420px]" role="img" aria-label="กราฟแสดงผลรายวัน">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD}
            x2={W - PAD}
            y1={y(max * t)}
            y2={y(max * t)}
            className="stroke-border/50"
            strokeDasharray="3 3"
          />
        ))}
        <path d={line('count')} fill="none" className="stroke-accent-strong" strokeWidth={2} />
        <path d={line('unique')} fill="none" className="stroke-success" strokeWidth={2} strokeDasharray="4 3" />
        {points.map((p, i) =>
          i % Math.ceil(points.length / 8) === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[9px]">
              {p.date}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent-strong" /> Impressions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-success" /> Unique Users
        </span>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

export function RichMenuInsightsClient({ menuId }: { menuId: string }) {
  const [summary, setSummary] = useState<RichMenuInsightSummary | null>(null);
  const [daily, setDaily] = useState<RichMenuInsightDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const fromStr = yyyymmdd(from);
    const toStr = yyyymmdd(to);

    const timer = setTimeout(() => {
      void (async () => {
        const [summaryRes, dailyRes] = await Promise.all([
          adminApi.getRichMenuInsightSummary(menuId, fromStr, toStr),
          adminApi.getRichMenuInsightDaily(menuId, fromStr, toStr),
        ]);
        if (cancelled) return;
        if (!summaryRes.ok) setError(summaryRes.error);
        else {
          setSummary(summaryRes.data);
          setError(null);
        }
        if (dailyRes.ok) setDaily(dailyRes.data);
        setLoading(false);
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [menuId, days]);

  const points =
    daily?.impression?.metrics.map((m) => ({
      date: displayDate(m.date),
      count: m.count,
      unique: m.unique_users,
    })) ?? [];
  const totalClicks = summary?.clicks?.reduce((sum, c) => sum + c.count, 0) ?? 0;
  const restricted = summary?.privacy_restricted || daily?.privacy_restricted;
  const maxClicks = Math.max(...(summary?.clicks ?? []).map((c) => c.count), 1);

  return (
    <div className="space-y-4">
      <PageHeader title="สถิติ Rich Menu" subtitle="ข้อมูลการใช้งานจาก LINE Insight API">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                days === p.days
                  ? 'border-accent-strong bg-accent-sunken text-accent-strong'
                  : 'border-border text-muted hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Link
          href="/admin/chatbot/rich-menus"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Link>
      </PageHeader>

      {restricted && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-warning-ink" />
          <div>
            <p className="text-sm font-medium text-warning-ink">ข้อมูลไม่เพียงพอ</p>
            <p className="mt-0.5 text-xs text-warning-ink/80">
              LINE จะแสดงสถิติเมื่อเมนูมีข้อมูลสะสมรายวันแล้ว และมีผู้ใช้งานอย่างน้อย 20 คนในช่วงเวลาที่เลือก
            </p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">กำลังโหลดสถิติ...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Impressions"
              value={summary?.impression?.count.toLocaleString('th-TH') ?? '—'}
              icon={<Eye className="h-4 w-4" />}
            />
            <KpiCard
              label="Unique Viewers"
              value={summary?.impression?.unique_users.toLocaleString('th-TH') ?? '—'}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <KpiCard
              label="Total Clicks"
              value={totalClicks.toLocaleString('th-TH')}
              icon={<MousePointerClick className="h-4 w-4" />}
            />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-ink">Impressions รายวัน</h3>
            <ImpressionsChart points={points} />
          </div>

          {summary?.clicks && summary.clicks.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-ink">สรุปคลิกตามปุ่ม</h3>
              <ul className="space-y-2">
                {summary.clicks.map((c) => (
                  <li key={c.bound} className="flex items-center gap-3 text-sm">
                    <span className="w-16 flex-none text-xs text-muted">ปุ่ม {c.bound}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                      <span
                        className="block h-full rounded-full bg-accent-strong"
                        style={{ width: `${(c.count / maxClicks) * 100}%` }}
                      />
                    </span>
                    <span className="w-24 flex-none text-right font-semibold text-ink">
                      {c.count.toLocaleString('th-TH')}
                    </span>
                    <span className="w-20 flex-none text-right text-xs text-muted">
                      {c.unique_users.toLocaleString('th-TH')} users
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(summary?.metrics_from || daily?.metrics_from) && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Info className="h-3.5 w-3.5" />
              ช่วงข้อมูลจริง: {summary?.metrics_from ?? daily?.metrics_from ?? '—'} –{' '}
              {summary?.metrics_to ?? daily?.metrics_to ?? '—'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
