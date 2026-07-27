import { ArrowLeft, LinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '../../../components/site/site-footer';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'ตั้งรหัสผ่านใหม่' };

/**
 * /admin/reset-password?token=... — ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล (public)
 * token ถูกส่งมาจากลิงก์อีเมล — ถ้าไม่มี/รูปแบบผิด แสดงหน้า "ลิงก์ไม่ถูกต้อง"
 * การ validate token จริง (หมดอายุ/ใช้แล้ว) ทำใน server action ตอน submit
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // ตรวจรูปแบบเบื้องต้น (64 hex) — กัน render ฟอร์มทั้งที่ลิงก์ขาดแน่นอน
  const hasValidShape = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <Navbar />
      <main className="relative overflow-hidden mesh-gradient">
        <div className="absolute inset-0 thai-pattern pointer-events-none" />
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <Link
            href="/admin/login"
            className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            กลับหน้าเข้าระบบ
          </Link>

          <div className="glass-panel mt-6 rounded-xl p-6 shadow-lg sm:p-8">
            <h1 className="text-2xl font-bold text-ink">ตั้งรหัสผ่านใหม่</h1>

            {hasValidShape ? (
              <>
                <p className="mt-2 text-sm text-muted">
                  กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ
                </p>
                <ResetPasswordForm token={token as string} />
              </>
            ) : (
              <>
                <p className="mt-2 flex items-start gap-2 text-sm text-muted">
                  <LinkIcon className="mt-0.5 h-4 w-4 flex-none text-danger-ink" aria-hidden="true" />
                  ลิงก์รีเซ็ตนี้ไม่ถูกต้องหรือหมดอายุแล้ว ลิงก์ใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง
                </p>
                <Link
                  href="/admin/forgot-password"
                  className="mt-6 inline-flex min-h-touch items-center justify-center rounded-md bg-accent-gradient px-7 font-semibold text-on-accent shadow-md hover:opacity-90"
                >
                  ขอลิงก์ใหม่
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
