'use client';

import { AlertCircle, CalendarCheck, CheckCircle2, Loader2, User, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { FieldError, FieldHint, Input, Label, Textarea } from '../../components/ui/field';
import { QUEUE_BOOKING_WINDOW_DAYS, queuePhoneSchema } from '../../lib/validation';
import { formatThaiDateLong } from '../../lib/thai-date';
import {
  buildSlotAvailability,
  isBusinessDay,
  queueDateRange,
  type QueueSlotAvailability,
} from './slots';

interface BookingResult {
  dateTh: string;
  slotLabel: string;
  serviceType: string;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <section className="glass mt-6 rounded-xl p-6 shadow-sm sm:p-8">{children}</section>;
}

function SectionHeading({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold">
      <span className="bg-accent-100 flex h-10 w-10 items-center justify-center rounded-xl">
        <Icon className="text-accent-strong h-5 w-5" aria-hidden="true" />
      </span>
      {children}
    </h2>
  );
}

export function QueueBookingForm() {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<QueueSlotAvailability[]>(() => buildSlotAvailability([]));
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  const range = queueDateRange();
  // § กัน response เก่าทับ response ใหม่เมื่อเปลี่ยนวันรัว ๆ (ยิงใน handler ไม่มี effect cleanup)
  const dateRequestId = useRef(0);
  // § วันที่ล่าสุดในช่อง — คู่กับ state `date` ไว้ให้ async continuation (409 refresh)
  // เทียบว่าผู้ใช้เปลี่ยนวันระหว่างรอ response หรือไม่ (closure ใน handler จับค่าเก่า)
  const dateRef = useRef('');

  // § ทางโหลดตารางช่วงว่างทางเดียว — ทั้งเปลี่ยนวันและรีเฟรชหลัง 409 ผ่านนี่เท่านั้น
  // ทุกครั้งที่ยิงจะขึ้นเลข request ใหม่ response ที่เลขไม่ตรงจะถูกทิ้งเสมอ
  function loadAvailability(value: string) {
    const requestId = ++dateRequestId.current;
    setSlotsLoading(true);
    fetch(`/api/queue?date=${value}`)
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

  // § โหลดช่วงว่างใน onChange ตรง ๆ ไม่ผ่าน useEffect — วันหยุดราชการ (ส–อา)
  // ไม่ต้องยิง API เพราะ server ปฏิเสธอยู่แล้ว แค่แสดงทุกช่วงว่าไม่ว่าง
  function handleDateChange(value: string) {
    setDate(value);
    dateRef.current = value;
    setSlot('');
    if (!value) {
      setSlots(buildSlotAvailability([]));
      return;
    }
    if (!isBusinessDay(value)) {
      setSlots(buildSlotAvailability(['slot_1', 'slot_2', 'slot_3', 'slot_4']));
      return;
    }
    loadAvailability(value);
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
    if (serviceType.trim().length < 2) errors.serviceType = 'กรุณาระบุประเภทงานช่าง';
    if (note.trim().length > 500) errors.note = 'รายละเอียดยาวเกิน 500 ตัวอักษร';
    if (!consent) errors.consent = 'กรุณายินยอมให้เก็บชื่อ–เบอร์โทรเพื่อติดต่อเรื่องนัดช่าง';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          serviceType: serviceType.trim(),
          note: note.trim(),
          bookingDate: date,
          slot,
          consent: true,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        booking?: BookingResult;
      };
      if (!res.ok || !data.success || !data.booking) {
        // § 409 = ช่วงนี้มีคนจองตัดหน้าไปแล้ว — รีเฟรชตารางช่วงว่างให้เห็นสถานะใหม่ทันที
        // แต่เฉพาะเมื่อผู้ใช้ยังอยู่ที่วันเดิม: ถ้าเปลี่ยนวันระหว่างรอ POST แล้วดึงวันเก่า
        // มาทับ จะเอาตารางผิดวันมาแสดง (fetch ของวันใหม่ออกไปก่อนแล้ว)
        if (res.status === 409) {
          if (dateRef.current === date) loadAvailability(date);
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
          <p className="mt-2 text-muted">เจ้าหน้าที่จะโทรยืนยันนัดหมายกับท่านอีกครั้ง</p>
          <dl className="bg-surface-raised mx-auto mt-6 max-w-md space-y-2 rounded-xl border border-border p-5 text-left">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">วันที่นัด</dt>
              <dd className="font-semibold">{result.dateTh}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">ช่วงเวลา</dt>
              <dd className="font-semibold">{result.slotLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">งานช่าง</dt>
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
                setFullName('');
                setPhoneNumber('');
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

  return (
    <form onSubmit={handleSubmit} noValidate>
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
              {date && !isBusinessDay(date) ? '' : date ? ` · ${formatThaiDateLong(new Date(`${date}T00:00:00`))}` : ''}
            </FieldHint>
            <FieldError id="queue-date-error">{fieldErrors.date}</FieldError>
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold text-ink">ช่วงเวลา</legend>
            {slotsLoading ? (
              <p className="text-muted flex min-h-touch items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                กำลังโหลดช่วงว่าง…
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="ช่วงเวลา">
                {slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={slot === s.id}
                    disabled={!s.available}
                    onClick={() => setSlot(s.id)}
                    className={`min-h-touch rounded-md border px-4 py-3 text-left font-semibold transition-colors ${
                      slot === s.id
                        ? 'border-accent-strong bg-accent-sunken text-accent-strong'
                        : s.available
                          ? 'border-border bg-surface-raised text-ink hover:border-accent-strong'
                          : 'cursor-not-allowed border-border bg-surface-raised text-muted opacity-50'
                    }`}
                  >
                    {s.label}
                    {!s.available && <span className="ml-2 text-sm font-normal">(เต็มแล้ว)</span>}
                  </button>
                ))}
              </div>
            )}
            <FieldError>{fieldErrors.slot}</FieldError>
          </fieldset>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading icon={User}>ข้อมูลผู้จอง</SectionHeading>
        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="queue-name">ชื่อ-นามสกุล</Label>
            <Input
              id="queue-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              invalid={!!fieldErrors.fullName}
              placeholder="เช่น สมชาย ใจดี"
            />
            <FieldError>{fieldErrors.fullName}</FieldError>
          </div>
          <div>
            <Label htmlFor="queue-phone">เบอร์โทรติดต่อกลับ</Label>
            <Input
              id="queue-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              invalid={!!fieldErrors.phoneNumber}
              placeholder="เช่น 0812345678"
            />
            <FieldError>{fieldErrors.phoneNumber}</FieldError>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading icon={Wrench}>งานช่างที่ต้องการ</SectionHeading>
        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="queue-service">ประเภทงานช่าง</Label>
            <Input
              id="queue-service"
              type="text"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              invalid={!!fieldErrors.serviceType}
              placeholder="เช่น ไฟฟ้าดับ ท่อประปาแตก ถนนชำรุด"
            />
            <FieldError>{fieldErrors.serviceType}</FieldError>
          </div>
          <div>
            <Label htmlFor="queue-note">รายละเอียดเพิ่มเติม (ถ้ามี)</Label>
            <Textarea
              id="queue-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              invalid={!!fieldErrors.note}
              placeholder="เช่น จุดที่เสีย ที่ตั้งบ้าน จุดสังเกต"
            />
            <FieldError>{fieldErrors.note}</FieldError>
          </div>
          <div>
            <label className="flex min-h-touch cursor-pointer items-start gap-3" htmlFor="queue-consent">
              <input
                id="queue-consent"
                type="checkbox"
                aria-label="ยินยอมให้ อบต.หัวงัว เก็บชื่อ–เบอร์โทรเพื่อติดต่อเรื่องนัดช่าง"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-5 w-5 flex-none rounded border-border-strong text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              />
              <span className="text-sm">
                ข้าพเจ้ายินยอมให้ อบต.หัวงัว เก็บชื่อ–นามสกุลและเบอร์โทรศัพท์
                เพื่อใช้ติดต่อเรื่องนัดช่างเท่านั้น
              </span>
            </label>
            <FieldError>{fieldErrors.consent}</FieldError>
          </div>
        </div>
      </SectionCard>

      {submitError && (
        <p role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-danger-ink/30 bg-danger-soft p-4 font-semibold text-danger-ink">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting} className="mt-6 w-full">
        {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {submitting ? 'กำลังจองคิว…' : 'ยืนยันการจองคิว'}
      </Button>
    </form>
  );
}
