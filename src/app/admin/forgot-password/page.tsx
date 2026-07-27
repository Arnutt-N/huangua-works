import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '../../../components/site/site-footer';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'ลืมรหัสผ่าน' };

/**
 * /admin/forgot-password — ขอรีเซ็ตรหัสผ่านเจ้าหน้าที่ (public, ไม่ต้อง login)
 * proxy.ts อนุญาต path นี้ผ่าน authorized allowlist (ดู src/auth.config.ts)
 */
export default function ForgotPasswordPage() {
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
            <h1 className="text-2xl font-bold text-ink">ลืมรหัสผ่าน</h1>
            <p className="mt-2 text-sm text-muted">
              กรอกอีเมลที่ลงทะเบียนไว้ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
            </p>

            <ForgotPasswordForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
