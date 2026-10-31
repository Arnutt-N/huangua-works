'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePresetFilter } from '@/components/admin/date-preset-filter';
import { STANDARD_DATE_PRESETS, presetOptionToDates } from '@/lib/date-range';

/**
 * AuditFilterBar — filter สำหรับ /admin/audit
 *
 * กรองตาม action, resource, ค้นหาตาม user/IP/resourceId
 */
const RESOURCE_OPTIONS = [
  { value: 'all', label: 'ทุก resource' },
  { value: 'cases', label: 'cases' },
  { value: 'users', label: 'users' },
  { value: 'auth', label: 'auth' },
  { value: 'departments', label: 'departments' },
  { value: 'consent', label: 'consent' },
  { value: 'categories', label: 'categories' },
];

interface AuditFilterBarProps {
  actions: string[];
}

export function AuditFilterBar({ actions }: AuditFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  const currentAction = searchParams.get('action') ?? 'all';
  const currentResource = searchParams.get('resource') ?? 'all';
  const currentFrom = searchParams.get('from') ?? '';
  const currentTo = searchParams.get('to') ?? '';
  const presetParam = searchParams.get('preset');
  const currentPreset = presetParam ?? (currentFrom || currentTo ? 'custom' : null);

  const hasActiveFilter =
    currentAction !== 'all' ||
    currentResource !== 'all' ||
    !!currentFrom ||
    !!currentTo ||
    !!presetParam ||
    !!searchParams.get('q');

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete('page');
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/audit?${query}` : '/admin/audit');
    });
  }

  // § Tranche F: อัปเดตช่วงวันที่พร้อม preset key ในครั้งเดียว
  function updateDateFilter(nextPreset: string | null, nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPreset) {
      params.set('preset', nextPreset);
    } else {
      params.delete('preset');
    }
    if (nextFrom) {
      params.set('from', nextFrom);
    } else {
      params.delete('from');
    }
    if (nextTo) {
      params.set('to', nextTo);
    } else {
      params.delete('to');
    }
    params.delete('page');
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/audit?${query}` : '/admin/audit');
    });
  }

  function handlePresetChange(key: string) {
    if (key === 'custom') {
      updateDateFilter('custom', currentFrom, currentTo);
      return;
    }
    const opt = STANDARD_DATE_PRESETS.find((p) => p.key === key);
    if (!opt) return;
    const dates = presetOptionToDates(opt);
    updateDateFilter(key, dates.from, dates.to);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateFilter('q', q.trim());
  }

  function handleClear() {
    setQ('');
    startTransition(() => {
      router.push('/admin/audit');
    });
  }

  return (
    <div
      className="glass-panel rounded-xl p-4 shadow-sm sm:p-5"
      aria-label="ตัวกรองประวัติ"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Label htmlFor="aq" className="sr-only">
              ค้นหา
            </Label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id="aq"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล / IP / resource id"
              className="pl-10"
            />
          </div>

          <div>
            <Label htmlFor="af-action" className="sr-only">
              action
            </Label>
            <Select
              name="action"
              value={currentAction}
              onValueChange={(v) => updateFilter('action', v)}
            >
              <SelectTrigger id="af-action" className="min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก action</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="af-resource" className="sr-only">
              resource
            </Label>
            <Select
              name="resource"
              value={currentResource}
              onValueChange={(v) => updateFilter('resource', v)}
            >
              <SelectTrigger id="af-resource" className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preset & Custom Date Filter (Tranche F) */}
        <DatePresetFilter
          preset={currentPreset}
          customStart={currentFrom}
          customEnd={currentTo}
          onPresetChange={handlePresetChange}
          onCustomStartChange={(v) => updateDateFilter('custom', v, currentTo)}
          onCustomEndChange={(v) => updateDateFilter('custom', currentFrom, v)}
          showClear={Boolean(currentFrom || currentTo || currentPreset)}
          onClear={() => updateDateFilter(null, '', '')}
          disabled={isPending}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            {hasActiveFilter ? 'กำลังใช้ตัวกรอง' : 'ไม่มีตัวกรอง'}
          </p>
          <div className="flex items-center gap-2">
            {hasActiveFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isPending}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                ล้างตัวกรอง
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'กำลังค้นหา...' : 'ค้นหา'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
