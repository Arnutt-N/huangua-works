import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { SiteFooter } from '../../components/site/site-footer';
import { QueueBookingForm } from './queue-booking-form';

export const metadata: Metadata = { title: 'จองคิวนัดช่าง' };

/**
 * /queue — ประชาชนจองวัน/ช่วงเวลาให้ช่าง อบต. เข้าดูหน้างาน (P2-03)
 * หน้า static — ตารางช่วงว่างดึงผ่าน GET /api/queue ฝั่ง client
 */
export default function QueuePage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <Navbar />
      <main className="relative overflow-hidden mesh-gradient">
        <div className="absolute inset-0 thai-pattern pointer-events-none" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            กลับหน้าแรก
          </Link>

          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">จองคิวนัดช่าง</h1>
          <p className="mt-3 text-lg text-muted">
            เลือกวันและช่วงเวลาที่สะดวก เจ้าหน้าที่จะโทรยืนยันนัดหมายกับท่านอีกครั้ง
          </p>

          <QueueBookingForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
