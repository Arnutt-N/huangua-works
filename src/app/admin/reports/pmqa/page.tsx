import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { requireStaff } from '@/lib/auth/require-staff';
import { AdminShell } from '@/components/admin/admin-shell';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { ALL_STATUSES, STATUS_LABELS_TH } from '@/lib/cases/state-machine';
import { getPmqaReportData } from '@/lib/pmqa';
import { formatThaiDateTime } from '@/lib/thai-date';

export const metadata: Metadata = {
  title: 'รายงาน PMQA — อบต.หัวงัว',
  description: 'รายงานสรุปเรื่องร้องเรียนตามเกณฑ์ PMQA จำแนกตามหมวดหมู่ สถานะ และปีงบประมาณ',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    fiscalYear?: string;
  }>;
}

export default async function PmqaReportPage({ searchParams }: PageProps) {
  const { user: staffUser } = await requireStaff();
  const params = await searchParams;

  const parsedYear = params.fiscalYear ? parseInt(params.fiscalYear, 10) : undefined;
  const report = await getPmqaReportData({
    fiscalYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
  });

  return (
    <AdminShell user={staffUser} active="reports" title="รายงานเกณฑ์ PMQA">
      <div className="space-y-6">
        {/* แถบนำทางด้านบนและตัวเลือกปีงบประมาณ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              กลับไปหน้าจัดการเรื่อง
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-ink">
              รายงานตามเกณฑ์ PMQA (พ.ศ. {report.fiscalYear})
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              สรุปเรื่องร้องเรียนตามหมวดหมู่/สถานะ/ปีงบประมาณไทย (1 ต.ค.{' '}
              {report.fiscalYear - 1} – 30 ก.ย. {report.fiscalYear})
            </p>
          </div>

          {/* กล่องเลือกปีงบประมาณ */}
          <div className="glass-panel flex items-center gap-2 rounded-xl p-2 shadow-sm">
            <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="text-xs font-semibold text-muted">ปีงบประมาณ:</span>
            <div className="flex items-center gap-1">
              {report.availableFiscalYears.map((year) => {
                const isActive = year === report.fiscalYear;
                return (
                  <Link
                    key={year}
                    href={`/admin/reports/pmqa?fiscalYear=${year}`}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-accent-strong text-surface shadow-xs'
                        : 'text-muted hover:bg-surface-sunken hover:text-ink'
                    }`}
                  >
                    พ.ศ. {year}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* แผง KPI การ์ดสรุปภาพรวม */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-panel rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                เรื่องร้องเรียนทั้งหมด
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-sunken text-accent-strong">
                <Inbox className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink">
                {report.totalCases.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted">เรื่อง</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              รับแจ้งในปีงบประมาณ {report.fiscalYear}
            </p>
          </div>

          <div className="glass-panel rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                ดำเนินการแล้วเสร็จ
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success-ink">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink">
                {report.resolvedCount.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted">เรื่อง</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-success-ink">
                อัตราความสำเร็จ {report.resolutionRate}%
              </span>
              <span className="text-muted">(เสร็จสิ้น/ปิดเรื่อง)</span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                อยู่ระหว่างดำเนินการ
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning-ink">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink">
                {report.openCount.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted">เรื่อง</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              สัดส่วน{' '}
              {report.totalCases > 0
                ? Math.round((report.openCount / report.totalCases) * 1000) / 10
                : 0}
              % ของเรื่องทั้งหมด
            </p>
          </div>

          <div className="glass-panel rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                ยุติเรื่อง / ไม่รับดำเนินการ
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-danger-ink">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink">
                {report.rejectedCount.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted">เรื่อง</span>
            </div>
            <p className="mt-1 text-xs text-muted">ไม่อยู่ในอำนาจหน้าที่/ไม่เข้าเกณฑ์</p>
          </div>
        </div>

        {/* แผงแจกแจงแยกตามสถานะย่อยทั้ง 8 สถานะ */}
        <div className="glass-panel rounded-xl p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <BarChart3 className="h-4 w-4 text-accent-strong" aria-hidden="true" />
              จำแนกตามขั้นตอนวงจรชีวิต (8 สถานะ)
            </h2>
            <span className="text-xs text-muted">สถานะตาม State Machine</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {ALL_STATUSES.map((status) => {
              const count = report.statusCounts[status] ?? 0;
              const pct =
                report.totalCases > 0
                  ? Math.round((count / report.totalCases) * 1000) / 10
                  : 0;
              return (
                <div
                  key={status}
                  className="flex flex-col items-center rounded-lg border border-border bg-surface-sunken/40 p-3 text-center"
                >
                  <CaseStatusBadge status={status} className="text-xs" />
                  <span className="mt-2 text-xl font-bold text-ink">
                    {count.toLocaleString('th-TH')}
                  </span>
                  <span className="text-[11px] text-muted">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ตารางสรุปจำแนกตามหมวดหมู่เรื่องร้องเรียน */}
        <div className="glass-panel overflow-hidden rounded-xl shadow-sm">
          <div className="border-b border-border bg-surface-sunken/60 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">
                  สรุปจำแนกตามหมวดหมู่เรื่องร้องเรียน
                </h2>
                <p className="text-xs text-muted">
                  ร้อยละและอัตราความสำเร็จในการแก้ไขปัญหาแยกตามประเภทงาน
                </p>
              </div>
              <span className="text-xs font-semibold text-muted">
                {report.categories.length} หมวดหมู่
              </span>
            </div>
          </div>

          {report.categories.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              ไม่พบข้อมูลหมวดหมู่เรื่องร้องเรียน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken/30 text-xs font-semibold text-muted">
                    <th scope="col" className="px-5 py-3">
                      หมวดหมู่เรื่อง
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      จำนวน (เรื่อง)
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      สัดส่วน (%)
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      แล้วเสร็จ
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      รอดำเนินการ
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      ยุติเรื่อง
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      อัตราสำเร็จ (%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.categories.map((cat) => (
                    <tr
                      key={cat.categoryId}
                      className="transition-colors hover:bg-surface-sunken/40"
                    >
                      <td className="px-5 py-3 font-semibold text-ink">
                        {cat.categoryName}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-ink">
                        {cat.total.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right text-muted">
                        {cat.percentageOfTotal}%
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-success-ink">
                        {cat.resolvedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-warning-ink">
                        {cat.openCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-danger-ink">
                        {cat.rejectedCount.toLocaleString('th-TH')}
                      </td>
                      <td
                        className="px-5 py-3 text-right"
                        aria-label={`อัตราความสำเร็จ ${cat.resolutionRate}%`}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                              className="h-full rounded-full bg-accent-strong"
                              style={{ width: `${Math.min(100, cat.resolutionRate)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-bold text-ink">
                            {cat.resolutionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-sunken/50 font-semibold text-ink">
                    <td className="px-5 py-3">รวมทั้งสิ้น</td>
                    <td className="px-3 py-3 text-right">
                      {report.totalCases.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {report.totalCases > 0 ? 100 : 0}%
                    </td>
                    <td className="px-3 py-3 text-right text-success-ink">
                      {report.resolvedCount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-3 text-right text-warning-ink">
                      {report.openCount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-3 text-right text-danger-ink">
                      {report.rejectedCount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-accent-strong">
                      {report.resolutionRate}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ตารางสถิติรายเดือนในรอบปีงบประมาณ (12 เดือน) */}
        <div className="glass-panel overflow-hidden rounded-xl shadow-sm">
          <div className="border-b border-border bg-surface-sunken/60 px-5 py-4">
            <h2 className="text-base font-bold text-ink">
              สถิติรายเดือนในรอบปีงบประมาณ พ.ศ. {report.fiscalYear}
            </h2>
            <p className="text-xs text-muted">
              การกระจายตัวของเรื่องร้องเรียนตลอดทั้งปีงบประมาณ (ไตรมาส 1 – ไตรมาส 4)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/30 text-xs font-semibold text-muted">
                  <th scope="col" className="px-5 py-3">
                    เดือน (ปีงบ)
                  </th>
                  <th scope="col" className="px-3 py-3">
                    ไตรมาส
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    รับแจ้ง (เรื่อง)
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    แล้วเสร็จ
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    รอดำเนินการ
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    ยุติเรื่อง
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.monthlyBreakdown.map((m) => {
                  const quarter = Math.ceil(m.fiscalMonthIndex / 3);
                  return (
                    <tr
                      key={m.fiscalMonthIndex}
                      className="transition-colors hover:bg-surface-sunken/40"
                    >
                      <td className="px-5 py-2.5 font-medium text-ink">
                        {m.monthName} {m.buddhistYear}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        ไตรมาส {quarter}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink">
                        {m.total.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-success-ink">
                        {m.resolvedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-warning-ink">
                        {m.openCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-danger-ink">
                        {m.rejectedCount.toLocaleString('th-TH')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ท้ายหน้า: เวลาที่ประมวลผลรายงาน */}
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            รายงานเพื่อการบริหารจัดการภาครัฐ (PMQA หมวด 3 & หมวด 7)
          </span>
          <span>ข้อมูล ณ วันที่ {formatThaiDateTime(report.generatedAt)}</span>
        </div>
      </div>
    </AdminShell>
  );
}
