import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff, ArrowLeft, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'ไม่มีสัญญาณอินเทอร์เน็ต · อบต.หัวงัว',
  description: 'คุณกำลังอยู่ในโหมดออฟไลน์ ระบบได้จัดเก็บข้อมูลชั่วคราวในอุปกรณ์ของท่าน',
};

export default function OfflinePage() {
  return (
    <div className="min-h-dvh bg-surface text-ink flex flex-col justify-between">
      <main className="relative flex-1 flex items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
            <WifiOff className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl text-ink">
              ไม่มีสัญญาณอินเทอร์เน็ต
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              อุปกรณ์ของท่านไม่ได้เชื่อมต่ออินเทอร์เน็ต หรืออยู่ในจุดอับสัญญาณภาคสนาม
              หากท่านบันทึกข้อมูลแบบร่างไว้ ข้อมูลจะยังคงปลอดภัยในอุปกรณ์ของท่าน
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-raised p-4 text-left text-sm space-y-2">
            <div className="font-semibold text-ink">คำแนะนำสำหรับเจ้าหน้าที่ลงพื้นที่</div>
            <ul className="list-disc list-inside space-y-1 text-muted text-xs">
              <li>ท่านสามารถถ่ายรูปและบันทึกโน้ตภาคสนามเก็บไว้ในเครื่องได้</li>
              <li>ระบบจะทำการเชื่อมต่อและส่งข้อมูลอัตโนมัติเมื่อกลับเข้าสู่พื้นที่ที่มีสัญญาณ</li>
              <li>หากต้องการตรวจสอบข้อมูล ให้กดปุ่มลองโหลดใหม่ด้านล่าง</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="secondary" className="w-full sm:w-auto min-h-touch gap-2" asChild>
              <Link href="/admin/queue">
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                คิวนัดหมายงานช่าง
              </Link>
            </Button>

            <Button variant="secondary" className="w-full sm:w-auto min-h-touch gap-2" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                กลับหน้าแรก
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted">
        องค์การบริหารส่วนตำบลหัวงัว อำเภอยางตลาด จังหวัดกาฬสินธุ์
      </footer>
    </div>
  );
}
