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
import { PrintButton } from '@/components/admin/print-button';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { ALL_STATUSES } from '@/lib/cases/state-machine';
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
        {/* หัวหนังสือราชการสำหรับพิมพ์ (แสดงเฉพาะโหมดพิมพ์เท่านั้น) */}
        <div className="hidden text-center print:mb-6 print:block">
          <h1 className="text-xl font-bold text-black">
            องค์การบริหารส่วนตำบลหัวงัว อำเภอยางตลาด จังหวัดกาฬสินธุ์
          </h1>
          <p className="mt-1 text-base font-semibold text-black">
            รายงานสรุปสถิติการดำเนินการจัดการเรื่องร้องเรียน/ร้องทุกข์ ตามเกณฑ์ PMQA (หมวด 3 และ หมวด 7)
          </p>
          <p className="mt-0.5 text-sm text-neutral-800">
            ประจำปีงบประมาณ พ.ศ. {report.fiscalYear} (ตั้งแต่วันที่ 1 ตุลาคม พ.ศ.{' '}
            {report.fiscalYear - 1} ถึงวันที่ 30 กันยายน พ.ศ. {report.fiscalYear})
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            ข้อมูล ณ วันที่ {formatThaiDateTime(report.generatedAt)}
          </p>
        </div>

        {/* แถบนำทางด้านบนและตัวเลือกปีงบประมาณ (ซ่อนในโหมดพิมพ์เพื่อป้องกันหัวข้อซ้ำซ้อน) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
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

          {/* ส่วนเครื่องมือ: ตัวเลือกปีงบประมาณ และปุ่มสั่งพิมพ์ */}
          <div className="flex flex-wrap items-center gap-2">
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

            <PrintButton />
          </div>
        </div>

        {/* แผง KPI การ์ดสรุปภาพรวม */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-3">
          <div className="glass-panel rounded-xl p-5 shadow-sm print:break-inside-avoid print:rounded-lg print:border print:border-neutral-300 print:bg-white print:p-4 print:text-black print:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted print:text-neutral-700">
                เรื่องร้องเรียนทั้งหมด
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-sunken text-accent-strong print:hidden">
                <Inbox className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink print:text-black">
                {report.totalCases.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted print:text-neutral-600">เรื่อง</span>
            </div>
            <p className="mt-1 text-xs text-muted print:text-neutral-600">
              รับแจ้งในปีงบประมาณ {report.fiscalYear}
            </p>
          </div>

          <div className="glass-panel rounded-xl p-5 shadow-sm print:break-inside-avoid print:rounded-lg print:border print:border-neutral-300 print:bg-white print:p-4 print:text-black print:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted print:text-neutral-700">
                ดำเนินการแล้วเสร็จ
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success-ink print:hidden">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink print:text-black">
                {report.resolvedCount.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted print:text-neutral-600">เรื่อง</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-success-ink print:font-bold print:text-black">
                อัตราความสำเร็จ {report.resolutionRate}%
              </span>
              <span className="text-muted print:text-neutral-600">(เสร็จสิ้น/ปิดเรื่อง)</span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 shadow-sm print:break-inside-avoid print:rounded-lg print:border print:border-neutral-300 print:bg-white print:p-4 print:text-black print:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted print:text-neutral-700">
                อยู่ระหว่างดำเนินการ
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning-ink print:hidden">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink print:text-black">
                {report.openCount.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted print:text-neutral-600">เรื่อง</span>
            </div>
            <p className="mt-1 text-xs text-muted print:text-neutral-600">
              สัดส่วน{' '}
              {report.totalCases > 0
                ? Math.round((report.openCount / report.totalCases) * 1000) / 10
                : 0}
              % ของเรื่องทั้งหมด
            </p>
          </div>

          <div className="glass-panel rounded-xl p-5 shadow-sm print:break-inside-avoid print:rounded-lg print:border print:border-neutral-300 print:bg-white print:p-4 print:text-black print:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted print:text-neutral-700">
                ยุติเรื่อง / ไม่รับดำเนินการ
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-danger-ink print:hidden">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink print:text-black">
                {report.rejectedCount.toLocaleString('th-TH')}
              </span>
              <span className="text-xs text-muted print:text-neutral-600">เรื่อง</span>
            </div>
            <p className="mt-1 text-xs text-muted print:text-neutral-600">ไม่อยู่ในอำนาจหน้าที่/ไม่เข้าเกณฑ์</p>
          </div>
        </div>

        {/* แผงแจกแจงแยกตามสถานะย่อยทั้ง 8 สถานะ (จัดแบบ 4 คอลัมน์ x 2 แถว ในโหมดพิมพ์) */}
        <div className="glass-panel rounded-xl p-5 shadow-sm print:break-inside-avoid print:rounded-lg print:border print:border-neutral-300 print:bg-white print:p-4 print:text-black print:shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink print:text-black">
              <BarChart3 className="h-4 w-4 text-accent-strong print:hidden" aria-hidden="true" />
              จำแนกตามขั้นตอนวงจรชีวิต (8 สถานะ)
            </h2>
            <span className="text-xs text-muted print:text-neutral-600">สถานะตาม State Machine</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 print:grid-cols-4 print:gap-2">
            {ALL_STATUSES.map((status) => {
              const count = report.statusCounts[status] ?? 0;
              const pct =
                report.totalCases > 0
                  ? Math.round((count / report.totalCases) * 1000) / 10
                  : 0;
              return (
                <div
                  key={status}
                  className="flex flex-col items-center rounded-lg border border-border bg-surface-sunken/40 p-3 text-center print:break-inside-avoid print:border-neutral-300 print:bg-white print:p-2.5 print:text-black"
                >
                  <CaseStatusBadge status={status} className="text-xs" />
                  <span className="mt-2 text-xl font-bold text-ink print:text-black">
                    {count.toLocaleString('th-TH')}
                  </span>
                  <span className="text-[11px] text-muted print:text-neutral-600">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ตารางสรุปจำแนกตามหมวดหมู่เรื่องร้องเรียน */}
        <div className="glass-panel overflow-hidden rounded-xl shadow-sm print:rounded-lg print:border print:border-neutral-400 print:bg-white print:text-black print:shadow-none">
          <div className="border-b border-border bg-surface-sunken/60 px-5 py-4 print:border-neutral-300 print:bg-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink print:text-black">
                  สรุปจำแนกตามหมวดหมู่เรื่องร้องเรียน
                </h2>
                <p className="text-xs text-muted print:text-neutral-600">
                  ร้อยละและอัตราความสำเร็จในการแก้ไขปัญหาแยกตามประเภทงาน
                </p>
              </div>
              <span className="text-xs font-semibold text-muted print:text-neutral-700">
                {report.categories.length} หมวดหมู่
              </span>
            </div>
          </div>

          {report.categories.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted print:text-black">
              ไม่พบข้อมูลหมวดหมู่เรื่องร้องเรียน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm print:text-xs">
                <thead className="print:table-header-group">
                  <tr className="border-b border-border bg-surface-sunken/30 text-xs font-semibold text-muted print:border-neutral-300 print:bg-neutral-100 print:text-black">
                    <th scope="col" className="px-5 py-3 print:px-3 print:py-2">
                      หมวดหมู่เรื่อง
                    </th>
                    <th scope="col" className="px-3 py-3 text-right print:py-2">
                      จำนวน (เรื่อง)
                    </th>
                    <th scope="col" className="px-3 py-3 text-right print:py-2">
                      สัดส่วน (%)
                    </th>
                    <th scope="col" className="px-3 py-3 text-right print:py-2">
                      แล้วเสร็จ
                    </th>
                    <th scope="col" className="px-3 py-3 text-right print:py-2">
                      รอดำเนินการ
                    </th>
                    <th scope="col" className="px-3 py-3 text-right print:py-2">
                      ยุติเรื่อง
                    </th>
                    <th scope="col" className="px-5 py-3 text-right print:px-3 print:py-2">
                      อัตราสำเร็จ (%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border print:divide-neutral-200">
                  {report.categories.map((cat) => (
                    <tr
                      key={cat.categoryId}
                      className="transition-colors hover:bg-surface-sunken/40 print:break-inside-avoid print:text-black"
                    >
                      <td className="px-5 py-3 font-semibold text-ink print:px-3 print:py-2 print:text-black">
                        {cat.categoryName}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-ink print:py-2 print:text-black">
                        {cat.total.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right text-muted print:py-2 print:text-neutral-700">
                        {cat.percentageOfTotal}%
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-success-ink print:py-2 print:text-black">
                        {cat.resolvedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-warning-ink print:py-2 print:text-black">
                        {cat.openCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-danger-ink print:py-2 print:text-black">
                        {cat.rejectedCount.toLocaleString('th-TH')}
                      </td>
                      <td
                        className="px-5 py-3 text-right print:px-3 print:py-2"
                        aria-label={`อัตราความสำเร็จ ${cat.resolutionRate}%`}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken print:hidden">
                            <div
                              className="h-full rounded-full bg-accent-strong"
                              style={{ width: `${Math.min(100, cat.resolutionRate)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-bold text-ink print:w-auto print:text-black">
                            {cat.resolutionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="print:table-footer-group">
                  <tr className="border-t-2 border-border bg-surface-sunken/50 font-semibold text-ink print:border-neutral-400 print:bg-neutral-100 print:text-black">
                    <td className="px-5 py-3 print:px-3 print:py-2">รวมทั้งสิ้น</td>
                    <td className="px-3 py-3 text-right print:py-2">
                      {report.totalCases.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-3 text-right print:py-2">
                      {report.totalCases > 0 ? 100 : 0}%
                    </td>
                    <td className="px-3 py-3 text-right text-success-ink print:py-2 print:text-black">
                      {report.resolvedCount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-3 text-right text-warning-ink print:py-2 print:text-black">
                      {report.openCount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-3 py-3 text-right text-danger-ink print:py-2 print:text-black">
                      {report.rejectedCount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-accent-strong print:px-3 print:py-2 print:text-black">
                      {report.resolutionRate}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ตารางสถิติรายเดือนในรอบปีงบประมาณ (12 เดือน) */}
        <div className="glass-panel overflow-hidden rounded-xl shadow-sm print:rounded-lg print:border print:border-neutral-400 print:bg-white print:text-black print:shadow-none">
          <div className="border-b border-border bg-surface-sunken/60 px-5 py-4 print:border-neutral-300 print:bg-neutral-100">
            <h2 className="text-base font-bold text-ink print:text-black">
              สถิติรายเดือนในรอบปีงบประมาณ พ.ศ. {report.fiscalYear}
            </h2>
            <p className="text-xs text-muted print:text-neutral-600">
              การกระจายตัวของเรื่องร้องเรียนตลอดทั้งปีงบประมาณ (ไตรมาส 1 – ไตรมาส 4)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm print:text-xs">
              <thead className="print:table-header-group">
                <tr className="border-b border-border bg-surface-sunken/30 text-xs font-semibold text-muted print:border-neutral-300 print:bg-neutral-100 print:text-black">
                  <th scope="col" className="px-5 py-3 print:px-3 print:py-2">
                    เดือน (ปีงบ)
                  </th>
                  <th scope="col" className="px-3 py-3 print:py-2">
                    ไตรมาส
                  </th>
                  <th scope="col" className="px-3 py-3 text-right print:py-2">
                    รับแจ้ง (เรื่อง)
                  </th>
                  <th scope="col" className="px-3 py-3 text-right print:py-2">
                    แล้วเสร็จ
                  </th>
                  <th scope="col" className="px-3 py-3 text-right print:py-2">
                    รอดำเนินการ
                  </th>
                  <th scope="col" className="px-3 py-3 text-right print:py-2">
                    ยุติเรื่อง
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border print:divide-neutral-200">
                {report.monthlyBreakdown.map((m) => {
                  const quarter = Math.ceil(m.fiscalMonthIndex / 3);
                  return (
                    <tr
                      key={m.fiscalMonthIndex}
                      className="transition-colors hover:bg-surface-sunken/40 print:break-inside-avoid print:text-black"
                    >
                      <td className="px-5 py-2.5 font-medium text-ink print:px-3 print:py-2 print:text-black">
                        {m.monthName} {m.buddhistYear}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted print:py-2 print:text-neutral-700">
                        ไตรมาส {quarter}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink print:py-2 print:text-black">
                        {m.total.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-success-ink print:py-2 print:text-black">
                        {m.resolvedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-warning-ink print:py-2 print:text-black">
                        {m.openCount.toLocaleString('th-TH')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-danger-ink print:py-2 print:text-black">
                        {m.rejectedCount.toLocaleString('th-TH')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ส่วนท้ายหน้าจอปกติ: เวลาที่ประมวลผลรายงาน */}
        <div className="flex items-center justify-between text-xs text-muted print:hidden">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            รายงานเพื่อการบริหารจัดการภาครัฐ (PMQA หมวด 3 & หมวด 7)
          </span>
          <span>ข้อมูล ณ วันที่ {formatThaiDateTime(report.generatedAt)}</span>
        </div>

        {/* ส่วนลงลายมือชื่อสำหรับรายงานราชการ (แสดงเฉพาะโหมดพิมพ์เท่านั้น) */}
        <div className="hidden pt-8 print:block print:break-inside-avoid">
          <div className="grid grid-cols-2 gap-8 text-center text-sm text-black">
            <div className="space-y-1">
              <p className="font-medium">ลงชื่อ........................................................</p>
              <p className="text-xs text-neutral-800">(........................................................)</p>
              <p className="text-xs text-neutral-800">เจ้าหน้าที่ผู้รับผิดชอบงานรับเรื่องร้องเรียน/ร้องทุกข์</p>
              <p className="text-xs text-neutral-800">วันที่ ........ เดือน .................... พ.ศ. ........</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">ลงชื่อ........................................................</p>
              <p className="text-xs text-neutral-800">(........................................................)</p>
              <p className="text-xs text-neutral-800">นายกองค์การบริหารส่วนตำบลหัวงัว</p>
              <p className="text-xs text-neutral-800">วันที่ ........ เดือน .................... พ.ศ. ........</p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
