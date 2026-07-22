'use client';

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Paperclip,
  User,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

interface GeoOption {
  id: number;
  nameTh: string;
}

interface FormState {
  fullName: string;
  cid: string;
  phone: string;
  categoryId: string;
  title: string;
  detail: string;
  provinceId: string;
  districtId: string;
  subDistrictId: string;
  village: string;
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
  provinceId: '',
  districtId: '',
  subDistrictId: '',
  village: '',
  addr: '',
  consent: false,
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

interface SubmitResult {
  caseId: string;
  trackingCode: string;
  message: string;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.fullName.trim()) errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
  if (!isValidCid(form.cid)) errors.cid = 'เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)';
  if (!form.categoryId) errors.categoryId = 'กรุณาเลือกหมวดเรื่อง';
  if (!form.title.trim()) errors.title = 'กรุณากรอกหัวเรื่อง';
  if (!form.detail.trim()) errors.detail = 'กรุณากรอกรายละเอียด';
  if (!form.provinceId) errors.provinceId = 'กรุณาเลือกจังหวัด';
  if (!form.districtId) errors.districtId = 'กรุณาเลือกอำเภอ';
  if (!form.subDistrictId) errors.subDistrictId = 'กรุณาเลือกตำบล';
  if (!form.consent) errors.consent = 'กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง';

  return errors;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border bg-surface-raised p-6 shadow-sm sm:p-8" style={{ borderColor: 'oklch(90% 0.01 145)' }}>
      {children}
    </section>
  );
}

function SectionHeading({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: 'oklch(94% 0.04 160)' }}
      >
        <Icon className="h-5 w-5" style={{ color: 'oklch(45% 0.15 160)' }} aria-hidden="true" />
      </span>
      {children}
    </h2>
  );
}

export function IntakeForm({ categories }: { categories: IntakeCategory[] }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [provinces, setProvinces] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<GeoOption[]>([]);
  const [loadingGeo, setLoadingGeo] = useState<'provinces' | 'districts' | 'subdistricts' | null>(null);

  useEffect(() => {
    fetch('/api/provinces')
      .then((r) => r.json())
      .then((d) => setProvinces(d.provinces ?? []))
      .catch(() => {});
  }, []);

  const loadDistricts = useCallback((provinceId: string) => {
    if (!provinceId) { setDistricts([]); setSubdistricts([]); return; }
    setLoadingGeo('districts');
    fetch(`/api/districts?provinceId=${provinceId}`)
      .then((r) => r.json())
      .then((d) => setDistricts(d.districts ?? []))
      .catch(() => setDistricts([]))
      .finally(() => setLoadingGeo(null));
  }, []);

  const loadSubdistricts = useCallback((districtId: string) => {
    if (!districtId) { setSubdistricts([]); return; }
    setLoadingGeo('subdistricts');
    fetch(`/api/subdistricts?districtId=${districtId}`)
      .then((r) => r.json())
      .then((d) => setSubdistricts(d.subdistricts ?? []))
      .catch(() => setSubdistricts([]))
      .finally(() => setLoadingGeo(null));
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleProvinceChange(value: string) {
    setForm((prev) => ({ ...prev, provinceId: value, districtId: '', subDistrictId: '' }));
    setDistricts([]);
    setSubdistricts([]);
    loadDistricts(value);
  }

  function handleDistrictChange(value: string) {
    setForm((prev) => ({ ...prev, districtId: value, subDistrictId: '' }));
    setSubdistricts([]);
    loadSubdistricts(value);
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
          location: form.addr.trim() || undefined,
          provinceId: Number(form.provinceId),
          districtId: Number(form.districtId),
          subDistrictId: Number(form.subDistrictId),
          village: form.village.trim() || undefined,
          consent: form.consent,
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

      setResult({ caseId: data.caseId, trackingCode: data.trackingCode, message: data.message });
    } catch {
      setSubmitError('เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mt-8 rounded-3xl border bg-surface-raised px-6 py-10 text-center shadow-lg" style={{ borderColor: 'oklch(90% 0.01 145)' }}>
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'oklch(94% 0.04 160)' }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: 'oklch(45% 0.15 160)' }} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-ink">รับเรื่องเรียบร้อย</h2>
        <p className="mt-2 text-muted">{result.message}</p>
        <p className="mt-5 text-sm font-semibold text-ink">เลขติดตามเรื่องของท่าน</p>
        <p
          data-testid="tracking-code"
          data-case-id={result.caseId}
          className="mx-auto mt-2 inline-block rounded-xl border px-6 py-3 font-mono text-2xl font-bold tracking-widest text-ink"
          style={{ borderColor: 'oklch(90% 0.01 145)', backgroundColor: 'oklch(96% 0.02 145 / 0.5)' }}
        >
          {result.trackingCode}
        </p>
        <p className="mt-3 text-sm text-muted">
          จดเลขติดตามนี้ไว้เพื่อใช้ติดตามสถานะภายหลัง — ห้ามให้ผู้อื่น เพราะสามารถใช้ดูสถานะเรื่องของท่านได้
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/track?id=${result.trackingCode}`}
            className="inline-flex min-h-touch items-center justify-center gap-2 rounded-xl px-7 font-semibold text-white"
            style={{
              background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
              boxShadow: '0 10px 40px -10px oklch(55% 0.13 160 / 0.3)',
            }}
          >
            ติดตามเรื่องนี้
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-touch items-center justify-center gap-2 rounded-xl border-2 px-7 font-semibold text-accent-strong hover:bg-accent-sunken"
            style={{ borderColor: 'oklch(80% 0.015 145)' }}
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="mt-8 flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger bg-danger-soft px-5 py-4 text-sm font-semibold text-danger"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          {submitError}
        </div>
      )}

      {/* ข้อมูลผู้แจ้ง */}
      <SectionCard>
        <SectionHeading icon={User}>ข้อมูลผู้แจ้ง</SectionHeading>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
        <div className="mt-4">
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
      </SectionCard>

      {/* เรื่องที่แจ้ง */}
      <SectionCard>
        <SectionHeading icon={FileText}>เรื่องที่แจ้ง</SectionHeading>
        <div className="mt-5 flex flex-col gap-4">
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
        </div>
      </SectionCard>

      {/* ที่ตั้ง */}
      <SectionCard>
        <SectionHeading icon={MapPin}>ที่ตั้ง</SectionHeading>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="province">จังหวัด</Label>
            <Select value={form.provinceId} onValueChange={handleProvinceChange}>
              <SelectTrigger id="province" aria-invalid={!!fieldErrors.provinceId || undefined}>
                <SelectValue placeholder="เลือกจังหวัด" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{fieldErrors.provinceId}</FieldError>
          </div>
          <div>
            <Label htmlFor="district">อำเภอ</Label>
            <Select
              value={form.districtId}
              onValueChange={handleDistrictChange}
              disabled={!form.provinceId || loadingGeo === 'districts'}
            >
              <SelectTrigger id="district" aria-invalid={!!fieldErrors.districtId || undefined}>
                <SelectValue placeholder={loadingGeo === 'districts' ? 'กำลังโหลด...' : 'เลือกอำเภอ'} />
              </SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{fieldErrors.districtId}</FieldError>
          </div>
          <div>
            <Label htmlFor="subdistrict">ตำบล</Label>
            <Select
              value={form.subDistrictId}
              onValueChange={(v) => updateField('subDistrictId', v)}
              disabled={!form.districtId || loadingGeo === 'subdistricts'}
            >
              <SelectTrigger id="subdistrict" aria-invalid={!!fieldErrors.subDistrictId || undefined}>
                <SelectValue placeholder={loadingGeo === 'subdistricts' ? 'กำลังโหลด...' : 'เลือกตำบล'} />
              </SelectTrigger>
              <SelectContent>
                {subdistricts.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{fieldErrors.subDistrictId}</FieldError>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="village">หมู่บ้าน / หมู่ที่</Label>
            <Input
              id="village"
              name="village"
              placeholder="เช่น บ้านหัวงัว หมู่ 5"
              value={form.village}
              onChange={(e) => updateField('village', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="addr">รายละเอียดเพิ่มเติม / จุดสังเกต</Label>
            <Input
              id="addr"
              name="addr"
              placeholder="เช่น หน้าวัดหัวงัว ติดกับร้านสะดวกซื้อ"
              value={form.addr}
              onChange={(e) => updateField('addr', e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      {/* ไฟล์แนบ */}
      <SectionCard>
        <SectionHeading icon={Paperclip}>รูปภาพประกอบ (ไม่จำเป็น)</SectionHeading>
        <div className="mt-5 rounded-xl border border-dashed px-4 py-8 text-center" style={{ borderColor: 'oklch(80% 0.015 145)', backgroundColor: 'oklch(96% 0.02 145 / 0.3)' }}>
          <p className="text-sm text-muted">ลากไฟล์มาวาง หรือเลือกจากเครื่อง (สูงสุด 5 รูป)</p>
          <p className="mt-1 text-xs text-muted">ยังไม่เปิดใช้งานในเฟสนี้</p>
        </div>
      </SectionCard>

      {/* PDPA consent */}
      <div className="rounded-3xl border bg-surface-raised p-6 shadow-sm sm:p-8" style={{ borderColor: 'oklch(90% 0.01 145)' }}>
        <label className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'oklch(90% 0.01 145)', backgroundColor: 'oklch(96% 0.02 145 / 0.3)' }}>
          <input
            type="checkbox"
            aria-label="ยินยอมให้เก็บข้อมูลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล PDPA"
            className="mt-1 h-5 w-5 flex-none rounded border-border-strong text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            checked={form.consent}
            onChange={(e) => updateField('consent', e.target.checked)}
          />
          <span className="text-sm text-ink">
            ฉันยินยอมให้ อบต.หัวงัว เก็บรวบรวมและใช้ข้อมูลข้างต้นเพื่อดำเนินการเรื่องแจ้งเหตุ
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) พ.ศ. 2562
          </span>
        </label>
        <FieldError>{fieldErrors.consent}</FieldError>
      </div>

      {/* actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 px-8 text-base"
          style={{
            background: 'linear-gradient(to right, oklch(55% 0.13 160), oklch(45% 0.15 160))',
            color: 'oklch(99% 0.005 145)',
            boxShadow: '0 10px 40px -10px oklch(55% 0.13 160 / 0.3)',
          }}
        >
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
