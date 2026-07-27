import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { BrandMark } from '@/components/site/brand-mark';
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

          <div className="glass-panel relative mt-6 overflow-hidden rounded-2xl p-6 shadow-lg sm:p-8">
            <div
              className="accent-rule pointer-events-none absolute inset-x-0 top-0 h-1"
              aria-hidden="true"
            />
            <BrandMark className="mb-4" />
            <h1 className="text-2xl font-bold">
              <span className="gradient-text">เข้าระบบเจ้าหน้าที่</span>
            </h1>
            <p className="mt-2 text-sm text-muted">
              สำหรับเจ้าหน้าที่ อบต.หัวงัว เข้าดูคิวและดำเนินเรื่องแจ้งเหตุ
            </p>

            <LoginForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}