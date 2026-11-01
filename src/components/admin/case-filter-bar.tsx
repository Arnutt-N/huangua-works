'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { ALL_STATUSES, STATUS_LABELS_TH } from '@/lib/cases/state-machine';

/**
 * CaseFilterBar — filter สำหรับหน้าคิวเรื่อง
 *
 * ใช้ URL search params เป็น source of truth (bookmarkable + shareable)
 * ส่ง form แบบ GET → Next.js searchParams อ่านที่ server
 *
 * ทุกการเปลี่ยน filter จะ reset page=1 (ไม่ค้างหน้าเดิม)
 * ปุ่ม "ล้าง" กลับไป path ปัจจุบันแบบไม่มี params (ไม่ hardcode path)
 *
 * Props: categories (สำหรับ dropdown) — ส่งจาก server component
 */
interface CategoryOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'open', label: 'กำลังดำเนินการทั้งหมด (เปิด)' },
  ...ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS_TH[s] })),
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'ทุกความเร่งด่วน' },
  { value: 'normal', label: 'ปกติ' },
  { value: 'urgent', label: 'ฉุกเฉิน' },
];

export function CaseFilterBar({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // local state สำหรับ search box (instant typing, submit ที่กด Enter)
  // § FLOW-03: ซิงค์ draft กับ queryParam โดยตรง แทนการเรียก setState ใน useEffect
  // (ตามกฎ react-hooks/set-state-in-effect) เพื่อให้ค่าคำค้นปรับตาม URL ทันทีตั้งแต่ render แรก
  const queryParam = searchParams.get('q') ?? '';
  const [draftQ, setDraftQ] = useState<{ base: string; value: string }>({
    base: queryParam,
    value: queryParam,
  });
  const q = draftQ.base === queryParam ? draftQ.value : queryParam;
  const setQ = (value: string) => setDraftQ({ base: queryParam, value });

  const currentStatus = searchParams.get('status') ?? 'all';
  const currentCategory = searchParams.get('category') ?? 'all';
  const currentPriority = searchParams.get('priority') ?? 'all';
  const currentFrom = searchParams.get('from') ?? '';
  const currentTo = searchParams.get('to') ?? '';
  const presetParam = searchParams.get('preset');
  const currentPreset = presetParam ?? (currentFrom || currentTo ? 'custom' : null);

  const hasActiveFilter =
    currentStatus !== 'all' ||
    currentCategory !== 'all' ||
    currentPriority !== 'all' ||
    !!currentFrom ||
    !!currentTo ||
    !!presetParam ||
    !!searchParams.get('q');

  // สร้าง URL ใหม่จาก filter ปัจจุบัน + ล้าง page
  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete('page'); // reset pagination เมื่อ filter เปลี่ยน
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  // § Tranche F: อัปเดตช่วงวันที่พร้อม preset key ในครั้งเดียว ป้องกันหลาย transition
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
      router.push(query ? `${pathname}?${query}` : pathname);
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
      router.push(pathname);
    });
  }

  return (
    <div
      className="glass-panel rounded-xl p-4 shadow-sm sm:p-5"
      aria-label="ตัวกรองเรื่อง"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          {/* Search */}
          <div className="relative">
            <Label htmlFor="q" className="sr-only">
              ค้นหา
            </Label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              id="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาเลขที่เรื่อง / หัวเรื่อง / ที่ตั้ง"
              className="pl-10"
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="f-status" className="sr-only">
              สถานะ
            </Label>
            <Select
              name="status"
              value={currentStatus}
              onValueChange={(v) => updateFilter('status', v)}
            >
              <SelectTrigger id="f-status" className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="f-category" className="sr-only">
              หมวด
            </Label>
            <Select
              name="category"
              value={currentCategory}
              onValueChange={(v) => updateFilter('category', v)}
            >
              <SelectTrigger id="f-category" className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวด</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <Label htmlFor="f-priority" className="sr-only">
              ความเร่งด่วน
            </Label>
            <Select
              name="priority"
              value={currentPriority}
              onValueChange={(v) => updateFilter('priority', v)}
            >
              <SelectTrigger id="f-priority" className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => (
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
