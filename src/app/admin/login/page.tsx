import { ArrowLeft, LogIn } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../../components/site/site-header';
import { SiteFooter } from '../../../components/site/site-footer';
import { Button } from '../../../components/ui/button';
import { FieldHint, Input, Label } from '../../../components/ui/field';

export const metadata: Metadata = { title: 'เข้าระบบเจ้าหน้าที่' };

/**
 * /admin/login — ฟอร์มเข้าระบบเจ้าหน้าที่ (UI skeleton)
 * บัตร 13 หลัก + รหัสผ่าน ปุ่มเข้าระบบลิงก์ไป /admin (dashboard ตัวอย่าง)
 * ยังไม่ตรวจสอบสิทธิ์จริง (P0: Supabase auth + RLS)
 */
export default function AdminLoginPage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          กลับหน้าหลัก
        </Link>

        <div className="mt-6 rounded-lg border border-border bg-surface-raised p-6 sm:p-8">
          <h1 className="text-2xl font-bold">เข้าระบบเจ้าหน้าที่</h1>
          <p className="mt-2 text-sm text-muted">
            สำหรับเจ้าหน้าที่ อบต.หัวงัว เข้าดูคิวและดำเนินเรื่องร้องเรียก/ร้องทุกข์
          </p>

          <form className="mt-6 flex flex-col gap-4" noValidate>
            <div>
              <Label htmlFor="cid">เลขบัตรประชาชน 13 หลัก</Label>
              <Input id="cid" inputMode="numeric" placeholder="x-xxxx-xxxxx-xx-x" />
              <FieldHint>ใช้ยืนยันตัวตน ระบบเก็บเป็นรหัส (hash) ไม่รั่วไหล</FieldHint>
            </div>
            <div>
              <Label htmlFor="pwd">รหัสผ่าน</Label>
              <Input id="pwd" type="password" placeholder="รหัสผ่าน" />
            </div>
            <Button asChild size="lg" className="mt-2">
              <Link href="/admin">
                <LogIn className="h-5 w-5" aria-hidden="true" />
                เข้าระบบ
              </Link>
            </Button>
          </form>

          <p className="mt-5 text-xs text-muted">
            ระบบยังไม่ตรวจสอบสิทธิ์จริง (skeleton) กดเข้าระบบแล้วจะเห็นแดชบอร์ดตัวอย่าง
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}