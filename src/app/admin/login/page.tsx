import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '../../../components/site/site-footer';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'เข้าระบบเจ้าหน้าที่' };

/**
 * /admin/login — เข้าระบบเจ้าหน้าที่ผ่าน Auth.js v5 (email+password)
 * proxy.ts (authorized callback) เด้งกลับ /admin ถ้า login อยู่แล้ว
 * § searchParams.reset === 'ok' → แสดงป้าย "รีเซ็ตรหัสสำเร็จ" (redirect มาจาก /admin/reset-password)
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <Navbar />
      <main className="relative overflow-hidden mesh-gradient">
        <div className="absolute inset-0 thai-pattern pointer-events-none" />
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            กลับหน้าหลัก
          </Link>

          {/* § หัวการ์ดเป็นตัวอักษรสีทึบ ไม่ใช้ .gradient-text
              เหตุผลไม่ใช่แค่รสนิยม — .gradient-text ไล่ผ่าน accent-gold (L82%)
              เป็นจุดกลาง ซึ่งบนพื้นการ์ดขาวให้ contrast แค่ 1.73:1 (ต่ำกว่าเกณฑ์
              ทั้ง 4.5:1 ของข้อความปกติและ 3:1 ของข้อความใหญ่) คือบั๊กชนิดเดียวกับ
              text-warning บน warning-soft ที่ 1.52:1 ที่เพิ่งไล่แก้ไปทั้งระบบ
              อีกทั้ง "เข้าระบบเจ้าหน้าที่" คือ label ของฟอร์ม ไม่ใช่หัวข้อโปรโมต —
              landing สงวน .gradient-text ไว้ให้ H1 hero กับหัว section เท่านั้น
              และหน้านี้เป็นประตูเข้าแอดมินซึ่งหัวเรื่องทุกหน้าเป็นสีทึบอยู่แล้ว */}
          <div className="glass-panel mt-6 rounded-xl p-6 shadow-lg sm:p-8">
            <h1 className="text-2xl font-bold text-ink">เข้าระบบเจ้าหน้าที่</h1>
            <p className="mt-2 text-sm text-muted">
              สำหรับเจ้าหน้าที่ อบต.หัวงัว เข้าดูคิวและดำเนินเรื่องแจ้งเหตุ
            </p>

            {reset === 'ok' && (
              <div
                role="status"
                className="mt-4 flex items-start gap-2 rounded-md border border-success-ink/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success-ink"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าระบบด้วยรหัสผ่านใหม่
              </div>
            )}

            <LoginForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}