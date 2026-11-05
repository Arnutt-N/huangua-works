'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ArrowUpDown, ChevronRight } from 'lucide-react';
import type { DepartmentBreakdownItem } from './admin-dashboard-types';
import { cn } from '@/lib/cn';

export interface DepartmentAttributionTableProps {
  departments: DepartmentBreakdownItem[];
}

type SortColumn = 'name' | 'count';
type SortDirection = 'asc' | 'desc';

export function DepartmentAttributionTable({
  departments,
}: DepartmentAttributionTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>('count');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const maxCount = useMemo(
    () => Math.max(1, ...departments.map((d) => d.count)),
    [departments],
  );

  const sortedDepts = useMemo(() => {
    return [...departments].sort((a, b) => {
      if (sortCol === 'name') {
        const cmp = a.name.localeCompare(b.name, 'th');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? a.count - b.count : b.count - a.count;
    });
  }, [departments, sortCol, sortDir]);

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'count' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="glass-panel flex flex-col justify-between rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-ink">ภาระงานตามหน่วยงานรับผิดชอบ</h2>
        </div>
        <span className="text-xs text-muted">
          ทั้งหมด {departments.length} หน่วยงาน
        </span>
      </div>

      {departments.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted">
          ยังไม่มีข้อมูลการมอบหมายหน่วยงาน
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-80 text-left text-xs">
            <caption className="sr-only">ตารางสถิติเรื่องร้องเรียนแยกตามหน่วยงานรับผิดชอบ</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="pb-2.5 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong rounded"
                    aria-label={`เรียงตามหน่วยงาน (${sortCol === 'name' ? (sortDir === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย') : 'ยังไม่ได้เรียง'})`}
                  >
                    หน่วยงาน
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className="pb-2.5 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('count')}
                    className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong rounded"
                    aria-label={`เรียงตามจำนวนเรื่อง (${sortCol === 'count' ? (sortDir === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย') : 'ยังไม่ได้เรียง'})`}
                  >
                    จำนวนเรื่อง
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th scope="col" className="pb-2.5 font-semibold text-right">
                  สัดส่วน
                </th>
                <th scope="col" className="pb-2.5 font-semibold text-right">
                  ดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedDepts.map((item, idx) => {
                const targetHref = '/admin/reports';

                return (
                  <tr
                    key={item.id ?? `${item.name}-${idx}`}
                    className="group transition-colors hover:bg-surface-raised"
                  >
                    <th scope="row" className="py-2.5 font-medium text-ink">
                      <span className="block max-w-[180px] sm:max-w-[240px] truncate" title={item.name}>
                        {item.name}
                      </span>
                    </th>
                    <td className="py-2.5 text-right font-bold tabular-nums text-ink">
                      {item.count.toLocaleString('th-TH')}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted">
                      <div className="flex items-center justify-end gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-pill bg-ink/10 sm:block" aria-hidden="true">
                          <span
                            className="block h-full rounded-pill bg-accent-strong"
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                          />
                        </span>
                        {item.percentage.toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={targetHref}
                        aria-label={`ดูเรื่องของ ${item.name} จำนวน ${item.count} เรื่อง`}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 font-semibold text-accent-strong hover:bg-accent-sunken hover:underline"
                      >
                        ดูรายการ
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
