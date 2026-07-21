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
import { STATUS_LABELS_TH } from '@/lib/cases/state-machine';
import type { CaseStatus } from '@/lib/cases/state-machine';

/**
 * CaseFilterBar — filter สำหรับ /admin dashboard
 *
 * ใช้ URL search params เป็น source of truth (bookmarkable + shareable)
 * ส่ง form แบบ GET → Next.js searchParams อ่านที่ server
 *
 * ทุกการเปลี่ยน filter จะ reset page=1 (ไม่ค้างหน้าเดิม)
 * ปุ่ม "ล้าง" กลับไป /admin เปล่า
 *
 * Props: categories (สำหรับ dropdown) — ส่งจาก server component
 */
interface CategoryOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'ทุกสถานะ' },
  ...(
    [
      'received',
      'reviewing',
      'assigned',
      'in_progress',
      'done',
      'closed',
      'rejected',
    ] as CaseStatus[]
  ).map((s) => ({ value: s, label: STATUS_LABELS_TH[s] })),
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'ทุกความเร่งด่วน' },
  { value: 'normal', label: 'ปกติ' },
  { value: 'urgent', label: 'ฉุกเฉิน' },
];

export function CaseFilterBar({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // local state สำหรับ search box (instant typing, submit ที่กด Enter)
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  const currentStatus = searchParams.get('status') ?? 'all';
  const currentCategory = searchParams.get('category') ?? 'all';
  const currentPriority = searchParams.get('priority') ?? 'all';

  const hasActiveFilter =
    currentStatus !== 'all' ||
    currentCategory !== 'all' ||
    currentPriority !== 'all' ||
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
    startTransition(() => {
      router.push(`/admin?${params.toString()}`);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateFilter('q', q.trim());
  }

  function handleClear() {
    setQ('');
    startTransition(() => {
      router.push('/admin');
    });
  }

  return (
    <div
      className="rounded-lg border border-border bg-surface-raised p-4 sm:p-5"
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
