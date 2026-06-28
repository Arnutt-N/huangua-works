import { AlertTriangle, Clock, Filter, LogOut, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../components/site/site-header';
import { SiteFooter } from '../../components/site/site-footer';
import { Button } from '../../components/ui/button';
import { CaseStatusBadge, type CaseStatus } from '../../components/ui/case-status-badge';
import { Input, Label } from '../../components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../lib/cn';

export const metadata: Metadata = { title: 'แดชบอร์ดเจ้าหน้าที่' };

/**
 * /admin — แดชบอร์ดเจ้าหน้าที่ (UI skeleton)
 * คิวเรื่องแบบ data list (table-like rows ไม่ใช่ card grid) + สรุปตามบริบท
   + ตัวกรอง (Select) + มอบหมาย/สถานะ/SLA
 * ยังไม่ต่อ auth/DB ปุ่มทั้งหมด no-op คิวด้านล่างเป็น mock
 */

interface QueueItem {
  id: string;
  title: string;
  category: string;
  place: string;
  assignee: string;
  status: CaseStatus;
  statusLabel: string;
  age: string;
  overSla?: boolean;
  urgent?: boolean;
}

const queue: QueueItem[] = [
  {
    id: 'HN-2568-000123',
    title: 'ถนนบ้านหนองโน เป็นหลุมเป็นบ่อ',
    category: 'ทางชำรุด',
    place: 'บ.หนองโน',
    assignee: 'รองนายก ฝ่ายช่าง',
    status: 'in_progress',
    statusLabel: 'ดำเนินการ',
    age: '3 วัน',
  },
  {
    id: 'HN-2568-000124',
    title: 'ไฟฟ้าดับในหมู่บ้าน',
    category: 'ไฟฟ้า',
    place: 'ม.4',
    assignee: 'เจ้าหน้าที่รับเรื่อง',
    status: 'reviewing',
    statusLabel: 'ตรวจสอบ',
    age: '2 ชม.',
  },
  {
    id: 'HN-2568-000125',
    title: 'สัตว์เลี้ยงรบกวนเวลากลางคืน',
    category: 'สิ่งแวดล้อม',
    place: 'บ.กลาง',
    assignee: 'ยังไม่มอบหมาย',
    status: 'received',
    statusLabel: 'รับเรื่อง',
    age: '1 ชม.',
    urgent: true,
  },
  {
    id: 'HN-2568-000118',
    title: 'ระบบระบายน้ำตัน น้ำท่วมขัง',
    category: 'น้ำ · ระบาย',
    place: 'บ.หนองงิ้ว',
    assignee: 'รองนายก ฝ่ายช่าง',
    status: 'in_progress',
    statusLabel: 'ดำเนินการ',
    age: '6 วัน',
    overSla: true,
    urgent: true,
  },
  {
    id: 'HN-2568-000120',
    title: 'ไฟถนนดับ ม.7',
    category: 'สาธารณูปโภค',
    place: 'ม.7',
    assignee: 'เจ้าหน้าที่รับเรื่อง',
    status: 'assigned',
    statusLabel: 'มอบหมาย',
    age: '1 วัน',
  },
  {
    id: 'HN-2568-000112',
    title: 'ขอความช่วยเหลือผู้สูงอายุ',
    category: 'สวัสดิการ',
    place: 'บ.หนองโน',
    assignee: 'ปลัด อบต.',
    status: 'done',
    statusLabel: 'เสร็จ',
    age: 'ปิดแล้ว',
  },
];

const roles = [
  'นายก อบต.',
  'รองนายก ฝ่ายช่าง',
  'รองนายก ฝ่ายสวัสดิการ',
  'ปลัด อบต.',
  'เจ้าหน้าที่ผู้รับเรื่อง',
] as const;

const statusFilters = [
  'ทั้งหมด',
  'รับเรื่อง',
  'ตรวจสอบ',
  'มอบหมาย',
  'ดำเนินการ',
  'เสร็จ',
  'ปิดเรื่อง',
  'ฉุกเฉิน',
] as const;

const catFilters = [
  'ทั้งหมด',
  'ทางชำรุด',
  'ไฟฟ้า',
  'น้ำ · ระบาย',
  'สาธารณูปโภค',
  'สิ่งแวดล้อม',
  'สวัสดิการ',
] as const;

const urgencyFilters = ['ทั้งหมด', 'ปกติ', 'ฉุกเฉิน'] as const;

function FilterSelect({
  id,
  label,
  options,
}: {
  id: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select>
        <SelectTrigger id={id}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* หัวแดชบอร์ด + บทบาท + ออกจากระบบ */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">แดชบอร์ดเจ้าหน้าที่</h1>
            <p className="mt-2 text-sm text-muted">
              คิวเรื่องร้องเรียก/ร้องทุกข์ พร้อมสถานะ มอบหมาย และ SLA
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-56">
              <Label htmlFor="role" className="sr-only">
                บทบาท
              </Label>
              <Select>
                <SelectTrigger id="role">
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild variant="secondary">
              <Link href="/admin/login">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                ออกจากระบบ
              </Link>
            </Button>
          </div>
        </div>

        <p className="mt-5 rounded-md border border-border bg-surface-sunken px-4 py-3 text-sm text-muted">
          หน้านี้เป็นโครง (skeleton) ยังไม่มีระบบล็อกอิน/ฐานข้อมูลจริง ใครเข้ามาก็เห็นคิวตัวอย่างนี้
        </p>

        {/* สรุปตามบริบท (บรรทัดเดียว ไม่ใช่ stat wall) */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">สรุปวันนี้</span>
          <span>
            รับใหม่ <strong className="text-ink">12</strong>
          </span>
          <span>
            รอดำเนินการ <strong className="text-ink">8</strong>
          </span>
          <span className="inline-flex items-center gap-1 text-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            เลย SLA <strong>2</strong>
          </span>
        </div>

        {/* ตัวกรอง */}
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <Label htmlFor="q" className="sr-only">
              ค้นหา
            </Label>
            <Input id="q" placeholder="ค้นหาเลขติดตาม / หัวเรื่อง / ที่ตั้ง" />
          </div>
          <FilterSelect id="f-status" label="สถานะ" options={statusFilters} />
          <FilterSelect id="f-cat" label="หมวด" options={catFilters} />
          <Button type="button" variant="secondary">
            <Filter className="h-4 w-4" aria-hidden="true" />
            กรอง
          </Button>
        </div>
        <div className="mt-3">
          <FilterSelect id="f-urgency" label="ความเร่งด่วน" options={urgencyFilters} />
        </div>

        {/* คิวเรื่อง (data list) */}
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface-raised">
          <div className="hidden border-b border-border px-4 py-3 text-xs font-semibold text-muted sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto] sm:gap-4">
            <span>เรื่อง</span>
            <span>หมวด</span>
            <span>ที่ตั้ง</span>
            <span>มอบหมาย</span>
            <span className="text-right">สถานะ · อายุ</span>
          </div>
          <ul>
            {queue.map((item) => (
              <li
                key={item.id}
                className="border-b border-border px-4 py-4 transition-colors duration-normal ease-out-expo last:border-0 hover:bg-surface-sunken/50 sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.2fr_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{item.id}</span>
                    {item.urgent ? (
                      <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                        ฉุกเฉิน
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-semibold text-ink">{item.title}</p>
                </div>
                <span className="mt-1 hidden text-sm text-muted sm:mt-0 sm:block">
                  {item.category}
                </span>
                <span className="mt-1 hidden items-center gap-1 text-sm text-muted sm:mt-0 sm:flex">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.place}
                </span>
                <span className="mt-1 hidden text-sm text-muted sm:mt-0 sm:block">
                  {item.assignee}
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:flex-col sm:items-end sm:gap-1">
                  <CaseStatusBadge status={item.status} label={item.statusLabel} />
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs',
                      item.overSla ? 'font-semibold text-danger' : 'text-muted',
                    )}
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {item.age}
                    {item.overSla ? ' · เลย SLA' : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}