'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Palette,
  Ruler,
  Component,
  AlertTriangle,
  RefreshCw,
  ClipboardList,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { KpiCard } from '@/components/admin/kpi-card';
import { RoleBadge } from '@/components/admin/role-badge';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import { ALL_STATUSES } from '@/lib/cases/state-machine';
import { ALL_ROLES } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';
import { TOKEN_GROUPS, PAIR_CHECKS } from './_lib/catalog';
import { contrast, levelOf, toHex, tokenToRgb, type Level, type Rgb } from './_lib/contrast';

interface ResolvedToken {
  name: string;
  use: string;
  hex: string;
  onSurface: number | null;
}

interface ResolvedPair {
  label: string;
  where: string;
  min: number;
  ratio: number;
  level: Level;
  pass: boolean;
}

const LEVEL_STYLE: Record<Level, string> = {
  AAA: 'bg-success-soft text-success-ink ring-success-ink/20',
  AA: 'bg-success-soft text-success-ink ring-success-ink/20',
  'AA-large': 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  fail: 'bg-danger-soft text-danger-ink ring-danger-ink/20',
};

export function DesignClient() {
  const [groups, setGroups] = useState<{ title: string; note?: string; tokens: ResolvedToken[] }[]>([]);
  const [pairs, setPairs] = useState<ResolvedPair[]>([]);
  const [theme, setTheme] = useState('light');

  /**
   * อ่านค่าที่ browser render จริงแล้วคำนวณใหม่
   * § ต้องรันฝั่ง client เท่านั้น — ค่าเหล่านี้มาจาก computed style ของ DOM จริง
   * ไม่ใช่จากไฟล์ tokens.css จึงสะท้อน gamut mapping ที่ browser ทำให้
   */
  const measure = useCallback(() => {
    const surface = tokenToRgb('--color-surface');
    setTheme(document.documentElement.dataset.theme ?? 'light');

    setGroups(
      TOKEN_GROUPS.map((g) => ({
        title: g.title,
        note: g.note,
        tokens: g.tokens.map((t) => {
          const rgb = tokenToRgb(t.name);
          return {
            name: t.name,
            use: t.use,
            hex: rgb ? toHex(rgb) : '—',
            onSurface: rgb && surface ? contrast(rgb, surface) : null,
          };
        }),
      })),
    );

    setPairs(
      PAIR_CHECKS.map((p) => {
        const fg = tokenToRgb(p.fg);
        const bg = tokenToRgb(p.bg);
        const ratio = fg && bg ? contrast(fg, bg) : 0;
        return {
          label: p.label,
          where: p.where,
          min: p.min,
          ratio,
          level: levelOf(ratio),
          pass: ratio >= p.min,
        };
      }),
    );
  }, []);

  useEffect(() => {
    /* § วัดใน requestAnimationFrame ไม่ใช่ทันทีใน effect
     * 1) ต้องรอให้ browser apply style ของธีมใหม่ก่อน ไม่งั้นอ่านได้ค่าเก่า
     * 2) เลี่ยง setState แบบ synchronous ใน effect ซึ่งทำให้เกิด cascading render */
    let raf = requestAnimationFrame(measure);
    // วัดใหม่เมื่อธีมเปลี่ยน — toggle ที่ user-menu สลับ data-theme บน <html>
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [measure]);

  const failed = pairs.filter((p) => !p.pass);

  return (
    <div className="space-y-6">
      {/* สรุปผลตรวจ — วางบนสุดเพราะเป็นสิ่งที่ต้องรู้ก่อนอย่างอื่น */}
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminCardTitle icon={<AlertTriangle className="h-4 w-4" />}>
            ผลตรวจ contrast — ธีม{theme === 'dark' ? 'มืด' : 'สว่าง'}
          </AdminCardTitle>
          <Button variant="ghost" onClick={measure} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            วัดใหม่
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted">
          ตัวเลขทั้งหมดคำนวณจากสีที่เบราว์เซอร์แสดงจริง (ผ่าน canvas) ไม่ใช่จากตัวเลขใน{' '}
          <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">tokens.css</code> —
          จึงเห็นผลของ gamut mapping ที่สคริปต์ <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">check-contrast</code>{' '}
          คำนวณต่างออกไปเล็กน้อย สลับธีมด้วยปุ่มมุมขวาบนแล้วตัวเลขจะอัปเดตเอง
        </p>
        <p className="mt-3 text-sm font-semibold">
          {failed.length === 0 ? (
            <span className="text-success-ink">ผ่านครบทั้ง {pairs.length} คู่</span>
          ) : (
            <span className="text-danger-ink">
              ไม่ผ่าน {failed.length} จาก {pairs.length} คู่
            </span>
          )}
        </p>
      </AdminCard>

      {/* คู่สีที่ใช้จริง */}
      <AdminCard>
        <AdminCardTitle icon={<Ruler className="h-4 w-4" />}>คู่สีที่ใช้จริงในโค้ด</AdminCardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="pb-2 pr-4 font-semibold">คู่สี</th>
                <th className="pb-2 pr-4 font-semibold">ใช้ที่</th>
                <th className="pb-2 pr-4 text-right font-semibold">วัดได้</th>
                <th className="pb-2 pr-4 text-right font-semibold">ต้อง ≥</th>
                <th className="pb-2 font-semibold">ระดับ</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.label} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{p.label}</td>
                  <td className="py-2 pr-4 text-xs text-muted">{p.where}</td>
                  <td
                    className={cn(
                      'py-2 pr-4 text-right font-mono tabular-nums',
                      p.pass ? 'text-ink' : 'text-danger-ink font-bold',
                    )}
                  >
                    {p.ratio.toFixed(2)}:1
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums text-muted">
                    {p.min}
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(
                        'inline-flex rounded-pill px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                        LEVEL_STYLE[p.level],
                      )}
                    >
                      {p.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Palette */}
      <AdminCard>
        <AdminCardTitle icon={<Palette className="h-4 w-4" />}>Design tokens</AdminCardTitle>
        <p className="mt-2 text-sm text-muted">
          ค่า hex คือสีที่เบราว์เซอร์แสดงจริงหลัง gamut mapping — ตัวเลขใน{' '}
          <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">tokens.css</code> อาจต่างจากนี้
        </p>
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="text-sm font-semibold text-ink">{g.title}</h3>
              {g.note && <p className="mt-0.5 text-xs text-muted">{g.note}</p>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.tokens.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface-raised p-3"
                  >
                    <span
                      className="h-11 w-11 flex-none rounded-md border border-border-strong"
                      style={{ backgroundColor: `var(${t.name})` }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-semibold">
                        {t.name.replace('--color-', '')}
                      </p>
                      <p className="truncate text-xs text-muted">{t.use}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
                        {t.hex}
                        {t.onSurface !== null && ` · ${t.onSurface.toFixed(2)}:1`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Components */}
      <AdminCard>
        <AdminCardTitle icon={<Component className="h-4 w-4" />}>Components</AdminCardTitle>
        <div className="mt-5 space-y-7">
          <section>
            <h3 className="text-sm font-semibold">ปุ่ม</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button>ปุ่มหลัก</Button>
              <Button variant="secondary">ปุ่มรอง</Button>
              <Button variant="outline">ปุ่มขอบ</Button>
              <Button variant="ghost">ปุ่มโปร่ง</Button>
              <Button variant="destructive">ลบ</Button>
              <Button disabled>ปิดใช้งาน</Button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">สถานะเรื่อง</h3>
            <p className="mt-0.5 text-xs text-muted">
              ทุกป้ายใช้พื้น <code className="text-[11px]">*-soft</code> คู่กับข้อความ{' '}
              <code className="text-[11px]">*-ink</code> — ห้ามใช้สีเต็มเป็นสีข้อความ
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <CaseStatusBadge key={s} status={s} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">บทบาทผู้ใช้</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => (
                <RoleBadge key={r} role={r} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">การ์ดตัวเลข</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="เรื่องทั้งหมด" value="1,248" icon={ClipboardList} />
              <KpiCard label="รอดำเนินการ" value="37" icon={Clock} variant="gold" />
              <KpiCard label="เลย SLA" value="4" icon={AlertTriangle} variant="danger" />
              <KpiCard label="ปิดเรื่องแล้ว" value="1,207" icon={CheckCircle2} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">ช่องกรอกข้อมูล</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ds-input">ชื่อ-นามสกุล</Label>
                <Input id="ds-input" placeholder="นายสมชาย ใจดี" aria-describedby="ds-hint" />
                <FieldHint id="ds-hint">ข้อความช่วยเหลือใต้ช่องกรอก</FieldHint>
              </div>
              <div>
                <Label htmlFor="ds-textarea">รายละเอียด</Label>
                <Textarea id="ds-textarea" rows={3} placeholder="อธิบายปัญหาที่พบ" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">มุมโค้ง</h3>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              {(['sm', 'md', 'lg', 'xl', 'pill'] as const).map((r) => (
                <div key={r} className="text-center">
                  <div
                    className="bg-accent-100 border-accent-200 h-16 w-16 border"
                    style={{ borderRadius: `var(--radius-${r})` }}
                  />
                  <p className="mt-1 font-mono text-[11px] text-muted">{r}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">เงา</h3>
            <div className="mt-3 flex flex-wrap gap-5">
              <div className="text-center">
                <div className="shadow-accent-glow h-16 w-24 rounded-md bg-surface-raised" />
                <p className="mt-1 font-mono text-[11px] text-muted">accent-glow</p>
              </div>
              <div className="text-center">
                <div className="shadow-accent-drop h-16 w-24 rounded-md bg-surface-raised" />
                <p className="mt-1 font-mono text-[11px] text-muted">accent-drop</p>
              </div>
            </div>
          </section>
        </div>
      </AdminCard>
    </div>
  );
}
