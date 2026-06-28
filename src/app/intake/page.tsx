import { ArrowRight, ArrowLeft, MapPin, Paperclip } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { FieldHint, Input, Label, Textarea } from '../../components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { SiteHeader } from '../../components/site/site-header';
import { SiteFooter } from '../../components/site/site-footer';

export const metadata: Metadata = { title: 'แจ้งเรื่องใหม่' };

/**
 * /intake — ฟอร์มแจ้งเรื่องร้องเรียก/ร้องทุกข์ (UI skeleton)
 * โครงสร้างฟอร์มครบ แต่ยังไม่บันทึกจริง/ไม่ validate CID checksum (P0 + Supabase)
 * ใช้ Field/Select primitives, touch >=44px, label ข้างบน field, PDPA consent
 */

const categories = [
  'ทางชำรุด',
  'ไฟฟ้า',
  'น้ำ · ระบาย',
  'สาธารณูปโภค',
  'สิ่งแวดล้อม',
  'สวัสดิการ',
  'อื่นๆ',
] as const;

export default function IntakePage() {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          กลับหน้าหลัก
        </Link>

        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">แจ้งเรื่องใหม่</h1>
        <p className="mt-3 text-lg text-muted">
          กรอกเรื่องของท่าน เจ้าหน้าที่รับและติดตามให้ทุกขั้นตอน โปร่งใส ตรวจสอบได้
        </p>

        <p className="mt-5 rounded-md border border-border bg-surface-sunken px-4 py-3 text-sm text-muted">
          หน้านี้เป็นโครงสร้างฟอร์ม (skeleton) ยังไม่บันทึกจริง ระบบจะเชื่อมฐานข้อมูลในเฟสถัดไป
        </p>

        <form className="mt-8 flex flex-col gap-8" noValidate>
          {/* ข้อมูลผู้แจ้ง */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">ข้อมูลผู้แจ้ง</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">ชื่อ - นามสกุล</Label>
                <Input id="name" name="name" placeholder="เช่น นายสมชาย ใจดี" />
              </div>
              <div>
                <Label htmlFor="cid">เลขบัตรประชาชน 13 หลัก</Label>
                <Input id="cid" name="cid" inputMode="numeric" placeholder="x-xxxx-xxxxx-xx-x" />
                <FieldHint>ใช้ยืนยันตัวตนและติดตามเรื่อง เก็บเป็นรหัส (hash) ไม่รั่วไหล</FieldHint>
              </div>
            </div>
            <div>
              <Label htmlFor="phone">เบอร์โทรติดต่อ</Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="08x-xxx-xxxx" />
            </div>
          </section>

          {/* เรื่องที่แจ้ง */}
          <section className="flex flex-col gap-4 border-t border-border pt-8">
            <h2 className="text-xl font-semibold">เรื่องที่แจ้ง</h2>
            <div>
              <Label htmlFor="cat">หมวดเรื่อง</Label>
              <Select>
                <SelectTrigger id="cat">
                  <SelectValue placeholder="เลือกหมวดที่ใกล้เรื่องของท่าน" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">หัวเรื่อง</Label>
              <Input id="title" name="title" placeholder="เช่น ถนนหน้าบ้านเป็นหลุมเป็นบ่อ" />
            </div>
            <div>
              <Label htmlFor="detail">รายละเอียด</Label>
              <Textarea
                id="detail"
                name="detail"
                rows={5}
                placeholder="บอกเล่าเรื่องที่เกิด เวลา ความเสียหาย ฯลฯ"
              />
              <FieldHint>ยิ่งละเอียด เจ้าหน้าที่เข้าใจและดำเนินการได้เร็วขึ้น</FieldHint>
            </div>
          </section>

          {/* ที่ตั้ง */}
          <section className="flex flex-col gap-4 border-t border-border pt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <MapPin className="h-5 w-5 text-accent-strong" aria-hidden="true" />
              ที่ตั้ง
            </h2>
            <div>
              <Label htmlFor="addr">ที่อยู่ / จุดที่เกิดเรื่อง</Label>
              <Input id="addr" name="addr" placeholder="บ้าน/หมู่ที่/ถนน/จุดสังเกต" />
              <FieldHint>ระบุให้ชัดเจน เจ้าหน้าที่จะได้ลงพื้นที่ถูกจุด</FieldHint>
            </div>
          </section>

          {/* ไฟล์แนบ */}
          <section className="flex flex-col gap-4 border-t border-border pt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Paperclip className="h-5 w-5 text-accent-strong" aria-hidden="true" />
              รูปภาพประกอบ (ไม่จำเป็น)
            </h2>
            <div className="rounded-md border border-dashed border-border-strong bg-surface-raised px-4 py-8 text-center">
              <p className="text-sm text-muted">ลากไฟล์มาวาง หรือเลือกจากเครื่อง (สูงสุด 5 รูป)</p>
              <p className="mt-1 text-xs text-muted">ยังไม่เปิดใช้งานในโครงสร้างนี้</p>
            </div>
          </section>

          {/* PDPA consent */}
          <section className="border-t border-border pt-8">
            <label className="flex items-start gap-3 rounded-md border border-border bg-surface-raised p-4">
              <input
                type="checkbox"
                aria-label="ยินยอมให้เก็บข้อมูลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล PDPA"
                className="mt-1 h-5 w-5 flex-none rounded border-border-strong text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              />
              <span className="text-sm text-ink">
                ฉันยินยอมให้ อบต.หัวงัว เก็บรวบรวมและใช้ข้อมูลข้างต้นเพื่อดำเนินการเรื่องร้องเรียก/ร้องทุกข์
                ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) พ.ศ. 2562
              </span>
            </label>
          </section>

          {/* actions */}
          <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
            <Button type="button" size="lg">
              ส่งเรื่อง
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="secondary" size="lg">
              บันทึกฉบับร่าง
            </Button>
          </div>
          <p className="text-xs text-muted">
            ปุ่มข้างต้นยังไม่บันทึกจริง (skeleton) ระบบจะเปิดให้ส่งเรื่องได้ในเฟสถัดไป
          </p>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}