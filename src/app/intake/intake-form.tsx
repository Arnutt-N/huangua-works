'use client';

import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MapPin, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { FieldError, FieldHint, Input, Label, Textarea } from '../../components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { isValidCid, sanitizeCid } from '../../lib/cid-checksum';

export interface IntakeCategory {
  id: string;
  name: string;
}

interface FormState {
  fullName: string;
  cid: string;
  phone: string;
  categoryId: string;
  title: string;
  detail: string;
  addr: string;
  consent: boolean;
}

const initialForm: FormState = {
  fullName: '',
  cid: '',
  phone: '',
  categoryId: '',
  title: '',
  detail: '',
  addr: '',
  consent: false,
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

interface SubmitResult {
  caseId: string;
  message: string;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.fullName.trim()) errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
  if (!isValidCid(form.cid)) errors.cid = 'เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)';
  if (!form.categoryId) errors.categoryId = 'กรุณาเลือกหมวดเรื่อง';
  if (!form.title.trim()) errors.title = 'กรุณากรอกหัวเรื่อง';
  if (!form.detail.trim()) errors.detail = 'กรุณากรอกรายละเอียด';
  if (!form.addr.trim()) errors.addr = 'กรุณาระบุที่ตั้ง';
  if (!form.consent) errors.consent = 'กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง';

  return errors;
}

export function IntakeForm({ categories }: { categories: IntakeCategory[] }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cases/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: sanitizeCid(form.cid),
          fullName: form.fullName.trim(),
          phoneNumber: form.phone.trim() || undefined,
          categoryId: form.categoryId,
          title: form.title.trim(),
          description: form.detail.trim(),
          location: form.addr.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(
          res.status === 409 && data.existingCaseId
            ? `${data.error} (เลขที่เรื่องเดิม: ${data.existingCaseId})`
            : data.error || 'ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่',
        );
        return;
      }

      setResult({ caseId: data.caseId, message: data.message });
    } catch {
      setSubmitError('เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mt-8 rounded-md border border-success bg-success-soft px-6 py-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold text-ink">รับเรื่องเรียบร้อย</h2>
        <p className="mt-2 text-muted">{result.message}</p>
        <p className="mt-4 rounded-md border border-border bg-surface-raised px-4 py-3 font-mono text-lg font-semibold text-ink">
          {result.caseId}
        </p>
        <p className="mt-2 text-sm text-muted">จดเลขที่เรื่องนี้ไว้เพื่อใช้ติดตามสถานะภายหลัง</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-accent-strong px-7 text-on-accent hover:bg-accent-strong/90"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-8 flex flex-col gap-8" noValidate onSubmit={handleSubmit}>
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          {submitError}
        </div>
      )}

      {/* ข้อมูลผู้แจ้ง */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">ข้อมูลผู้แจ้ง</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">ชื่อ - นามสกุล</Label>
            <Input
              id="name"
              name="name"
              placeholder="เช่น นายสมชาย ใจดี"
              invalid={!!fieldErrors.fullName}
              value={form.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
            />
            <FieldError>{fieldErrors.fullName}</FieldError>
          </div>
          <div>
            <Label htmlFor="cid">เลขบัตรประชาชน 13 หลัก</Label>
            <Input
              id="cid"
              name="cid"
              inputMode="numeric"
              placeholder="x-xxxx-xxxxx-xx-x"
              invalid={!!fieldErrors.cid}
              value={form.cid}
              onChange={(e) => updateField('cid', e.target.value)}
            />
            {fieldErrors.cid ? (
              <FieldError>{fieldErrors.cid}</FieldError>
            ) : (
              <FieldHint>ใช้ยืนยันตัวตนและติดตามเรื่อง เก็บเป็นรหัส (hash) ไม่รั่วไหล</FieldHint>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="phone">เบอร์โทรติดต่อ</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="08x-xxx-xxxx"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
          />
        </div>
      </section>

      {/* เรื่องที่แจ้ง */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">เรื่องที่แจ้ง</h2>
        <div>
          <Label htmlFor="cat">หมวดเรื่อง</Label>
          <Select value={form.categoryId} onValueChange={(v) => updateField('categoryId', v)}>
            <SelectTrigger id="cat" aria-invalid={!!fieldErrors.categoryId || undefined}>
              <SelectValue placeholder="เลือกหมวดที่ใกล้เรื่องของท่าน" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{fieldErrors.categoryId}</FieldError>
        </div>
        <div>
          <Label htmlFor="title">หัวเรื่อง</Label>
          <Input
            id="title"
            name="title"
            placeholder="เช่น ถนนหน้าบ้านเป็นหลุมเป็นบ่อ"
            invalid={!!fieldErrors.title}
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
          />
          <FieldError>{fieldErrors.title}</FieldError>
        </div>
        <div>
          <Label htmlFor="detail">รายละเอียด</Label>
          <Textarea
            id="detail"
            name="detail"
            rows={5}
            placeholder="บอกเล่าเรื่องที่เกิด เวลา ความเสียหาย ฯลฯ"
            invalid={!!fieldErrors.detail}
            value={form.detail}
            onChange={(e) => updateField('detail', e.target.value)}
          />
          {fieldErrors.detail ? (
            <FieldError>{fieldErrors.detail}</FieldError>
          ) : (
            <FieldHint>ยิ่งละเอียด เจ้าหน้าที่เข้าใจและดำเนินการได้เร็วขึ้น</FieldHint>
          )}
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
          <Input
            id="addr"
            name="addr"
            placeholder="บ้าน/หมู่ที่/ถนน/จุดสังเกต"
            invalid={!!fieldErrors.addr}
            value={form.addr}
            onChange={(e) => updateField('addr', e.target.value)}
          />
          {fieldErrors.addr ? (
            <FieldError>{fieldErrors.addr}</FieldError>
          ) : (
            <FieldHint>ระบุให้ชัดเจน เจ้าหน้าที่จะได้ลงพื้นที่ถูกจุด</FieldHint>
          )}
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
          <p className="mt-1 text-xs text-muted">ยังไม่เปิดใช้งานในเฟสนี้</p>
        </div>
      </section>

      {/* PDPA consent */}
      <section className="border-t border-border pt-8">
        <label className="flex items-start gap-3 rounded-md border border-border bg-surface-raised p-4">
          <input
            type="checkbox"
            aria-label="ยินยอมให้เก็บข้อมูลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล PDPA"
            className="mt-1 h-5 w-5 flex-none rounded border-border-strong text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            checked={form.consent}
            onChange={(e) => updateField('consent', e.target.checked)}
          />
          <span className="text-sm text-ink">
            ฉันยินยอมให้ อบต.หัวงัว เก็บรวบรวมและใช้ข้อมูลข้างต้นเพื่อดำเนินการเรื่องร้องเรียก/ร้องทุกข์
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) พ.ศ. 2562
          </span>
        </label>
        <FieldError>{fieldErrors.consent}</FieldError>
      </section>

      {/* actions */}
      <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              กำลังส่งเรื่อง...
            </>
          ) : (
            <>
              ส่งเรื่อง
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
