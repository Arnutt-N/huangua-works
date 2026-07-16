import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '../../../components/site/site-header';
import { SiteFooter } from '../../../components/site/site-footer';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'เข้าระบบเจ้าหน้าที่' };

/**
 * /admin/login — เข้าระบบเจ้าหน้าที่ผ่าน Supabase Auth (email+password)
 * middleware.ts เด้งกลับ /admin ถ้า login อยู่แล้ว
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

          <LoginForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}