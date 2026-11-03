'use client';

import {
  AlertCircle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  MessageCircle,
  User,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorSummary, type ErrorSummaryItem } from '@/components/ui/error-summary';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  QUEUE_BOOKING_WINDOW_DAYS,
  QUEUE_CATEGORY_LABELS,
  queuePhoneSchema,
  type QueueCategory,
} from '@/lib/validation';
import { formatThaiDateLong } from '@/lib/thai-date';
import { HONEYPOT_FIELD, MIN_SUBMIT_MS } from '@/lib/anti-spam';
import { useLiff } from '@/components/liff/liff-provider';
import {
  buildSlotAvailability,
  isBusinessDay,
  queueDateRange,
  type QueueSlotAvailability,
} from './slots';
import { HUA_NGUA_VILLAGES } from './villages';

interface BookingResult {
  dateTh: string;
  slotLabel: string;
  categoryLabel?: string;
  serviceType: string;
  hasLineNotification?: boolean;
}

const CATEGORY_PRESETS: Record<QueueCategory, readonly string[]> = {
  technician: [
    'ไฟฟ้าสาธารณะดับ/ชำรุด',
    'ท่อประปาแตก/น้ำไม่ไหล',
    'ถนนชำรุด/ผิวทางเสียหาย',
    'ตัดกิ่งไม้ใกล้สายไฟ/สิ่งแวดล้อม',
  ],
  government: [
    'ขออนุญาตก่อสร้างอาคาร (ข.1)',
    'ภาษีที่ดินและสิ่งปลูกสร้าง / ภาษีป้าย',
    'ลงทะเบียนเบี้ยยังชีพผู้สูงอายุ/ผู้พิการ',
    'จดทะเบียนพาณิชย์/ขอใบอนุญาต',
  ],
};

const QUEUE_FIELD_LABELS: Record<string, string> = {
  date: 'วันที่นัด',
  slot: 'ช่วงเวลาที่สะดวก',
  fullName: 'ชื่อ-นามสกุล ผู้ติดต่อ',
  phoneNumber: 'เบอร์โทรศัพท์ติดต่อกลับ',
  villageId: 'หมู่บ้านที่ต้องการให้เข้าตรวจหน้างาน',
  serviceType: 'เรื่องหรือหัวข้อที่ต้องการนัดหมาย',
  note: 'รายละเอียดเพิ่มเติม',
  consent: 'ความยินยอมเก็บรวบรวมข้อมูล',
};

const QUEUE_FIELD_DOM_IDS: Record<string, string> = {
  date: 'queue-date',
  slot: 'queue-slot',
  fullName: 'queue-name',
  phoneNumber: 'queue-phone',
  villageId: 'queue-village',
  serviceType: 'queue-service',
  note: 'queue-note',
  consent: 'queue-consent',
};

function SectionCard({ children }: { children: React.ReactNode }) {
  return <section className="glass mt-6 rounded-xl p-6 shadow-sm sm:p-8">{children}</section>;
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-start gap-3 text-xl font-semibold">
      <span className="bg-accent-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="text-accent-strong h-5 w-5" aria-hidden="true" />
      </span>
      <span className="pt-1">{children}</span>
    </h2>
  );
}

export function QueueBookingForm() {
  const { authenticated, displayName } = useLiff();

  const [category, setCategory] = useState<QueueCategory>('technician');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<QueueSlotAvailability[]>(() => buildSlotAvailability([]));
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [villageId, setVillageId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  // § กันสแปม: honeypot + จับเวลากรอกฟอร์ม (ดู src/lib/anti-spam.ts)
  const honeypotRef = useRef<HTMLInputElement>(null);
  const formStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    formStartedAtRef.current = Date.now();
  }, []);

  const range = queueDateRange();
  const dateRequestId = useRef(0);
  const dateRef = useRef('');
  const categoryRef = useRef<QueueCategory>('technician');

  function loadAvailability(targetDate: string, targetCategory: QueueCategory) {
    const requestId = ++dateRequestId.current;
    setSlotsLoading(true);
    fetch(`/api/queue?date=${encodeURIComponent(targetDate)}&category=${encodeURIComponent(targetCategory)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          slots?: QueueSlotAvailability[];
          error?: string;
        };
        if (requestId !== dateRequestId.current) return;
        if (!res.ok || !data.slots) {
          setFieldErrors((e) => ({ ...e, date: data.error ?? 'โหลดช่วงเวลาไม่สำเร็จ' }));
          return;
        }
        setFieldErrors((e) => {
          const next = { ...e };
          delete next.date;
          return next;
        });
        setSlots(data.slots);
      })
      .catch(() => {
        if (requestId !== dateRequestId.current) return;
        setFieldErrors((e) => ({ ...e, date: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }));
      })
      .finally(() => {
        if (requestId === dateRequestId.current) setSlotsLoading(false);
      });
  }

  function handleCategoryChange(newCategory: QueueCategory) {
    setCategory(newCategory);
    categoryRef.current = newCategory;
    setSlot('');
    setServiceType('');
    if (newCategory === 'government') {
      setVillageId('');
    }
    if (date && isBusinessDay(date)) {
      loadAvailability(date, newCategory);
    }
  }

  function handleDateChange(value: string) {
    setDate(value);
    dateRef.current = value;
    setSlot('');
    if (!value) {
      setSlots(buildSlotAvailability([]));
      return;
    }
    if (!isBusinessDay(value)) {
      setSlots(buildSlotAvailability([]));
      return;
    }
    loadAvailability(value, categoryRef.current);
  }

  function applyPreset(preset: string) {
    setServiceType(preset);
    setFieldErrors((e) => {
      const next = { ...e };
      delete next.serviceType;
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!date) errors.date = 'กรุณาเลือกวันที่นัด';
    else if (!isBusinessDay(date)) errors.date = 'รับนัดเฉพาะวันจันทร์–ศุกร์ (วันราชการ)';
    if (!slot) errors.slot = 'กรุณาเลือกช่วงเวลา';
    if (fullName.trim().length < 2) errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    if (!queuePhoneSchema.safeParse(phoneNumber.trim()).success)
      errors.phoneNumber = 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0';
    if (category === 'technician' && !villageId) {
      errors.villageId = 'กรุณาเลือกหมู่บ้านที่ต้องการให้ช่างลงพื้นที่';
    }
    if (serviceType.trim().length < 2)
      errors.serviceType = 'กรุณาระบุเรื่องที่ต้องการติดต่อหรือประเภทงานบริการ';
    if (note.trim().length > 500) errors.note = 'รายละเอียดยาวเกิน 500 ตัวอักษร';
    if (!consent) errors.consent = 'กรุณายินยอมให้เก็บชื่อ–เบอร์โทรเพื่อติดต่อเรื่องการนัดหมาย';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitCount((c) => c + 1);
      return;
    }

    const websiteUrl = honeypotRef.current?.value || undefined;
    const formStartedAt = formStartedAtRef.current || undefined;

    setSubmitting(true);
    setSubmitError(null);
    try {
      // § ผู้ใช้กรอกไวหรือเติมอัตโนมัติรอครบเกณฑ์ก่อนส่ง ไม่ได้รับ error เพราะเร็วเกินไป
      const remaining =
        formStartedAt === undefined
          ? 0
          : Math.min(MIN_SUBMIT_MS, MIN_SUBMIT_MS - (Date.now() - formStartedAt));
      if (remaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
      }

      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          category,
          serviceType: serviceType.trim(),
          note: note.trim(),
          villageId: villageId || undefined,
          bookingDate: date,
          slot,
          consent: true,
          websiteUrl,
          formStartedAt,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        booking?: BookingResult;
      };
      if (!res.ok || !data.success || !data.booking) {
        if (res.status === 409) {
          if (dateRef.current === date) loadAvailability(date, categoryRef.current);
          setSlot('');
        }
        setSubmitError(data.error ?? 'จองคิวไม่สำเร็จ กรุณาลองใหม่');
        return;
      }
      setResult(data.booking);
    } catch {
      setSubmitError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <SectionCard>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success-ink" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold">จองคิวสำเร็จ</h2>
          <p className="mt-2 text-muted">เจ้าหน้าที่จะตรวจสอบข้อมูลและโทรประสานงานยืนยันนัดหมายกับท่านอีกครั้ง</p>

          {result.hasLineNotification && (
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-success-ink/30 bg-success-soft px-4 py-1.5 text-sm font-semibold text-success-ink">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              ส่งข้อมูลยืนยันการจองคิวไปยัง LINE ของท่านแล้ว
            </div>
          )}

          <dl className="bg-surface-raised mx-auto mt-6 max-w-md space-y-2 rounded-xl border border-border p-5 text-left">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">หมวดงาน</dt>
              <dd className="font-semibold">{result.categoryLabel ?? QUEUE_CATEGORY_LABELS[category]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">วันที่นัด</dt>
              <dd className="font-semibold">{result.dateTh}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">ช่วงเวลา</dt>
              <dd className="font-semibold">{result.slotLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">เรื่องที่นัดหมาย</dt>
              <dd className="font-semibold">{result.serviceType}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setResult(null);
                setDate('');
                dateRef.current = '';
                setSlot('');
                setFullName('');
                setPhoneNumber('');
                setVillageId('');
                setServiceType('');
                setNote('');
                setConsent(false);
              }}
            >
              จองคิวอื่นเพิ่ม
            </Button>
            <Button asChild>
              <Link href="/">กลับหน้าแรก</Link>
            </Button>
          </div>
        </div>
      </SectionCard>
    );
  }

  const isWeekendSelected = !!date && !isBusinessDay(date);

  const errorSummaryItems: ErrorSummaryItem[] = Object.entries(fieldErrors).map(([key, msg]) => ({
    fieldId: QUEUE_FIELD_DOM_IDS[key] ?? key,
    fieldLabel: QUEUE_FIELD_LABELS[key],
    message: msg,
  }));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorSummary errors={errorSummaryItems} submitCount={submitCount} className="mt-6" />
      {authenticated && displayName && (
        <div className="glass mt-6 flex items-center justify-between rounded-xl border border-accent-strong/30 bg-accent-sunken p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-strong text-on-accent">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">
                เข้าสู่ระบบผ่าน LINE: <span className="text-accent-strong">{displayName}</span>
              </p>
              <p className="text-xs text-muted">ท่านจะได้รับการแจ้งเตือนยืนยันและสถานะนัดหมายทาง LINE</p>
            </div>
          </div>
          {!fullName && (
            <button
              type="button"
              onClick={() => setFullName(displayName)}
              className="inline-flex min-h-touch items-center text-xs font-semibold text-accent-strong hover:underline"
            >
              ใช้ชื่อจาก LINE
            </button>
          )}
        </div>
      )}

      {/* เลือกหมวดหมู่งาน */}
      <SectionCard>
        <SectionHeading icon={Wrench}>เลือกประเภทบริการ</SectionHeading>
        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2.5 sm:flex-row" role="radiogroup" aria-label="ประเภทบริการ">
            <button
              type="button"
              role="radio"
              aria-checked={category === 'technician'}
              onClick={() => handleCategoryChange('technician')}
              className={`flex min-h-touch flex-1 items-center gap-3 rounded-xl border p-4 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong ${
                category === 'technician'
                  ? 'border-accent-strong bg-accent-sunken text-accent-strong shadow-xs'
                  : 'border-border bg-surface-raised text-ink hover:border-accent-strong'
              }`}
            >
              <Wrench className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <span className="block text-base">งานช่างและบริการสาธารณูปโภค</span>
                <span className="block text-xs font-normal text-muted">ลงพื้นที่ตรวจหน้างาน (ไฟฟ้า ประปา ถนน)</span>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={category === 'government'}
              onClick={() => handleCategoryChange('government')}
              className={`flex min-h-touch flex-1 items-center gap-3 rounded-xl border p-4 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong ${
                category === 'government'
                  ? 'border-accent-strong bg-accent-sunken text-accent-strong shadow-xs'
                  : 'border-border bg-surface-raised text-ink hover:border-accent-strong'
              }`}
            >
              <Building2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <span className="block text-base">งานติดต่อราชการทั่วไป</span>
                <span className="block text-xs font-normal text-muted">ณ ที่ทำการ อบต.หัวงัว (ภาษี เบี้ยยังชีพ ช่าง)</span>
              </div>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* เลือกวันและช่วงเวลา */}
      <SectionCard>
        <SectionHeading icon={CalendarCheck}>เลือกวันและช่วงเวลา</SectionHeading>
        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="queue-date">วันที่นัด</Label>
            <Input
              id="queue-date"
              type="date"
              value={date}
              min={range.min}
              max={range.max}
              onChange={(e) => handleDateChange(e.target.value)}
              invalid={!!fieldErrors.date}
              aria-describedby={fieldErrors.date ? 'queue-date-error' : 'queue-date-hint'}
            />
            <FieldHint id="queue-date-hint">
              รับนัดวันจันทร์–ศุกร์ ล่วงหน้าไม่เกิน {QUEUE_BOOKING_WINDOW_DAYS} วัน
              {date && isBusinessDay(date) ? ` · ${formatThaiDateLong(new Date(`${date}T00:00:00`))}` : ''}
            </FieldHint>
            <FieldError id="queue-date-error">{fieldErrors.date}</FieldError>
          </div>

          {isWeekendSelected && (
            <div className="rounded-xl border border-warning-border bg-warning-soft p-4 text-sm font-semibold text-warning-ink">
              อบต.หัวงัว ปิดทำการในวันหยุดราชการ (เปิดให้บริการวันจันทร์–ศุกร์ เวลา 08:30–16:30 น.)
            </div>
          )}

          {!isWeekendSelected && (
            <fieldset aria-describedby={fieldErrors.slot ? 'queue-slot-error' : undefined}>
              <legend className="mb-2 block text-sm font-semibold text-ink">ช่วงเวลาที่สะดวก</legend>
              {slotsLoading ? (
                <p className="text-muted flex min-h-touch items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  กำลังตรวจสอบช่วงว่าง…
                </p>
              ) : (
                <div
                  id="queue-slot"
                  tabIndex={-1}
                  className="grid grid-cols-1 gap-2.5 rounded-xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="ช่วงเวลา"
                >
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={slot === s.id}
                      disabled={!s.available}
                      onClick={() => setSlot(s.id)}
                      className={`min-h-touch rounded-lg border px-4 py-3 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong ${
                        slot === s.id
                          ? 'border-accent-strong bg-accent-sunken text-accent-strong shadow-xs'
                          : s.available
                            ? 'border-border bg-surface-raised text-ink hover:border-accent-strong'
                            : 'cursor-not-allowed border-border bg-surface-sunken text-muted'
                      }`}
                    >
                      <span>{s.label}</span>
                      {!s.available && <span className="ml-2 text-xs font-normal text-muted">(คิวเต็ม)</span>}
                    </button>
                  ))}
                </div>
              )}
              <FieldError id="queue-slot-error">{fieldErrors.slot}</FieldError>
            </fieldset>
          )}
        </div>
      </SectionCard>

      {/* ข้อมูลผู้จอง */}
      <SectionCard>
        <SectionHeading icon={User}>ข้อมูลผู้จองและสถานที่</SectionHeading>
        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="queue-name">ชื่อ-นามสกุล ผู้ติดต่อ</Label>
            <Input
              id="queue-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              invalid={!!fieldErrors.fullName}
              aria-describedby={fieldErrors.fullName ? 'queue-name-error' : undefined}
              placeholder="เช่น นายสมชาย ใจดี"
            />
            <FieldError id="queue-name-error">{fieldErrors.fullName}</FieldError>
          </div>

          <div>
            <Label htmlFor="queue-phone">เบอร์โทรศัพท์ติดต่อกลับ (จำเป็น)</Label>
            <Input
              id="queue-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              invalid={!!fieldErrors.phoneNumber}
              aria-describedby={fieldErrors.phoneNumber ? 'queue-phone-error' : 'queue-phone-hint'}
              placeholder="เช่น 0812345678"
            />
            <FieldHint id="queue-phone-hint">เจ้าหน้าที่จะโทรประสานงานตามหมายเลขนี้ก่อนถึงวันนัด</FieldHint>
            <FieldError id="queue-phone-error">{fieldErrors.phoneNumber}</FieldError>
          </div>

          {category === 'technician' && (
            <div>
              <Label htmlFor="queue-village">หมู่บ้านที่ต้องการให้เข้าตรวจหน้างาน (ตำบลหัวงัว)</Label>
              <Select value={villageId} onValueChange={(val) => setVillageId(val)}>
                <SelectTrigger
                  id="queue-village"
                  aria-label="เลือกหมู่บ้าน"
                  aria-invalid={!!fieldErrors.villageId || undefined}
                  aria-describedby={fieldErrors.villageId ? 'queue-village-error' : undefined}
                >
                  <SelectValue placeholder="เลือกหมู่บ้าน (หมู่ 1 - หมู่ 13)" />
                </SelectTrigger>
                <SelectContent>
                  {HUA_NGUA_VILLAGES.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="queue-village-error">{fieldErrors.villageId}</FieldError>
            </div>
          )}
        </div>
      </SectionCard>

      {/* เรื่องที่ต้องการติดต่อ */}
      <SectionCard>
        <SectionHeading icon={category === 'technician' ? Wrench : Building2}>
          {category === 'technician' ? 'งานช่างที่ต้องการให้ลงพื้นที่' : 'เรื่องที่ต้องการติดต่อราชการ'}
        </SectionHeading>
        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="queue-service">เรื่องหรือหัวข้อที่ต้องการนัดหมาย</Label>
            <Input
              id="queue-service"
              type="text"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              invalid={!!fieldErrors.serviceType}
              aria-describedby={fieldErrors.serviceType ? 'queue-service-error' : undefined}
              placeholder={
                category === 'technician'
                  ? 'เช่น ซ่อมไฟฟ้าสาธารณะ, ท่อประปาแตก'
                  : 'เช่น ยื่นแบบขออนุญาตก่อสร้าง, ติดต่อภาษีที่ดิน'
              }
            />
            <FieldError id="queue-service-error">{fieldErrors.serviceType}</FieldError>

            <div className="mt-3">
              <span className="block text-xs font-semibold text-muted">หัวข้อที่พบบ่อย (กดเพื่อเลือก):</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORY_PRESETS[category].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="inline-flex min-h-touch items-center rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent-strong hover:bg-accent-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="queue-note">รายละเอียดเพิ่มเติม (ถ้ามี)</Label>
            <Textarea
              id="queue-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              invalid={!!fieldErrors.note}
              aria-describedby={fieldErrors.note ? 'queue-note-error' : undefined}
              placeholder={
                category === 'technician'
                  ? 'เช่น จุดสังเกต เสาไฟฟ้าต้นที่เท่าไร หรือจุดที่มีปัญหาน้ำรั่ว'
                  : 'เช่น ต้องการปรึกษาเอกสารประกอบ หรือสอบถามขั้นตอนเบื้องต้น'
              }
            />
            <FieldError id="queue-note-error">{fieldErrors.note}</FieldError>
          </div>

          <div>
            <label className="flex min-h-touch cursor-pointer items-start gap-3" htmlFor="queue-consent">
              <input
                id="queue-consent"
                type="checkbox"
                aria-label="ยินยอมให้ อบต.หัวงัว เก็บชื่อ–เบอร์โทรเพื่อติดต่อเรื่องการนัดหมาย"
                aria-invalid={!!fieldErrors.consent || undefined}
                aria-describedby={fieldErrors.consent ? 'queue-consent-error' : undefined}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-5 w-5 flex-none rounded border-border-strong text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              />
              <span className="text-sm">
                ข้าพเจ้ายินยอมให้ อบต.หัวงัว เก็บรวบรวมและใช้ชื่อ–นามสกุล และเบอร์โทรศัพท์
                เพื่อใช้สำหรับการประสานงานและแจ้งเตือนสถานะการนัดหมายตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </span>
            </label>
            <FieldError id="queue-consent-error">{fieldErrors.consent}</FieldError>
          </div>
        </div>
      </SectionCard>

      {submitError && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-danger-ink/30 bg-danger-soft p-4 font-semibold text-danger-ink"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      )}

      {/* § Honeypot กันบอท — ผู้ใช้จริงมองไม่เห็น (อยู่นอกจอ ไม่รับโฟกัส ไม่อ่านออกเสียง) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <input
          ref={honeypotRef}
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          aria-label="เว็บไซต์"
        />
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="mt-6 w-full">
        {submitting && <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {submitting ? 'กำลังบันทึกการจองคิว…' : 'ยืนยันการจองคิว'}
      </Button>
    </form>
  );
}
