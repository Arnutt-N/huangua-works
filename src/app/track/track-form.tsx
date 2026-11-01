'use client';

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FolderTree,
  Loader2,
  Phone,
  Search,
  Star,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { CaseStatusBadge } from '../../components/ui/case-status-badge';
import { Button } from '../../components/ui/button';
import { FieldHint, Input, Label } from '../../components/ui/field';
import { clearTrackDraft, readTrackDraft, saveTrackDraft } from '../../components/forms/non-pii-draft';
import { cn } from '../../lib/cn';
import { COPY } from '../../lib/copy';
import { statusProgress, type CaseStatus } from '../../lib/cases/state-machine';
import { formatThaiDateTimeShort } from '../../lib/thai-date';

interface CaseDetail {
  case: {
    id: string;
    trackingCode?: string;
    createdAt: string;
    status: CaseStatus;
    title: string;
  };
  category: { id: string; name: string } | null;
  updates: Array<{
    id: string;
    createdAt: string;
    updateType: string;
    newValue: string | null;
  }>;
}

interface TimelineEntry {
  status: CaseStatus;
  at: string;
}

// § คำอธิบายสถานะภาษาประชาชน ให้เข้าใจง่ายและทราบขั้นตอนต่อไป
const CITIZEN_STATUS_DESCRIPTIONS: Record<CaseStatus, string> = {
  pending: 'ระบบได้รับข้อมูลและรอเจ้าหน้าที่รับเรื่องเข้าสู่กระบวนการ',
  received: 'เจ้าหน้าที่รับเรื่องเข้าสู่ระบบเรียบร้อยแล้ว',
  reviewing: 'อยู่ระหว่างตรวจสอบข้อเท็จจริงและจัดสรรเจ้าหน้าที่รับผิดชอบ',
  awaiting_budget: 'อยู่ระหว่างการพิจารณาจัดสรรและขออนุมัติงบประมาณ',
  assigned: 'มอบหมายเจ้าหน้าที่ผู้รับผิดชอบเข้าพื้นที่แล้ว',
  in_progress: 'เจ้าหน้าที่กำลังลงพื้นที่และดำเนินการแก้ไขปัญหา',
  done: 'ดำเนินการแก้ไขปัญหาเสร็จสิ้นแล้ว',
  closed: 'ปิดเรื่องสมบูรณ์',
  rejected: 'ไม่สามารถรับเรื่องได้ เนื่องจากอยู่นอกเขตอำนาจหน้าที่หรือข้อมูลไม่เพียงพอ',
};

function getStatusIcon(status: CaseStatus) {
  switch (status) {
    case 'pending':
    case 'received':
      return Clock;
    case 'reviewing':
    case 'awaiting_budget':
      return Search;
    case 'assigned':
      return UserCheck;
    case 'in_progress':
      return Wrench;
    case 'done':
    case 'closed':
      return CheckCircle2;
    case 'rejected':
      return XCircle;
    default:
      return Clock;
  }
}

function buildTimeline(detail: CaseDetail): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ status: 'pending', at: detail.case.createdAt }];
  for (const u of detail.updates) {
    if (u.updateType === 'status_change' && u.newValue) {
      entries.push({ status: u.newValue as CaseStatus, at: u.createdAt });
    }
  }
  return entries;
}

async function fetchCase(id: string): Promise<{ ok: true; data: CaseDetail } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/cases/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'ค้นหาไม่สำเร็จ กรุณาลองใหม่' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' };
  }
}

export function TrackForm({ initialId }: { initialId?: string }) {
  const [trackId, setTrackId] = useState(initialId ?? '');
  const [isSearching, setIsSearching] = useState(() => Boolean(initialId));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaseDetail | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopyCode(code: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback safely
      }
    }
  }

  useEffect(() => {
    // § ไม่อ่าน storage ขณะ SSR และไม่ให้ draft ชนะเลขติดตามจาก URL
    const timer = window.setTimeout(() => {
      const draft = readTrackDraft();
      setTrackId((current) => initialId ?? (current || draft?.trackId || ''));
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialId]);

  useEffect(() => {
    if (draftReady) saveTrackDraft(trackId);
  }, [trackId, draftReady]);

  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;

    fetchCase(initialId).then((result) => {
      if (cancelled) return;
      if (result.ok) setResult(result.data);
      else setError(result.error);
      setIsSearching(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initialId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = trackId.trim().toUpperCase();
    if (!trimmed) {
      setError('กรุณากรอกเลขติดตามเรื่อง');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResult(null);

    // § ซิงค์ URL search params เพื่อให้บุ๊กมาร์กหรือแชร์ลิงก์ได้โดยไม่ต้อง reload
    if (typeof window !== 'undefined') {
      const nextUrl = `/track?id=${encodeURIComponent(trimmed)}`;
      window.history.replaceState(null, '', nextUrl);
    }

    const result = await fetchCase(trimmed);
    if (result.ok) setResult(result.data);
    else setError(result.error);
    setIsSearching(false);
  }

  const timeline = result ? buildTimeline(result) : [];
  const canRate = !!result && (result.case.status === 'done' || result.case.status === 'closed');
  const displayCode = result?.case.trackingCode || trackId.trim();

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="glass-panel mt-8 rounded-xl p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-sunken">
            <Search className="h-5 w-5 text-accent-strong" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">ค้นหาเรื่อง</h2>
        </div>

        <p className="mt-3 text-sm text-muted">
          บันทึกเฉพาะเลขติดตามที่ครบเป็นดราฟต์บนเครื่องนี้อัตโนมัติ ไม่บันทึกข้อมูลผู้แจ้ง
          หากใช้เครื่องร่วมกับผู้อื่น ให้กดล้างดราฟต์เมื่อใช้งานเสร็จ
        </p>

        <div className="mt-5">
          <Label htmlFor="trackId">{COPY.TRACKING_CODE}เรื่อง</Label>
          <Input
            id="trackId"
            placeholder="เช่น HG483729156"
            invalid={!!error}
            aria-describedby={error ? 'trackId-error' : 'trackId-hint'}
            value={trackId}
            onChange={(e) => setTrackId(e.target.value.toUpperCase())}
          />
        </div>

        <Button
          type="submit"
          className="shadow-accent-glow mt-5 h-11 px-7"
          disabled={isSearching}
        >
          {isSearching ? (
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Search className="h-5 w-5" aria-hidden="true" />
          )}
          {isSearching ? 'กำลังค้นหา...' : 'ค้นหาเรื่อง'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 px-7"
          disabled={isSearching}
          onClick={() => {
            clearTrackDraft();
            setTrackId('');
            setError(null);
            setResult(null);
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', '/track');
            }
          }}
        >
          ล้างดราฟต์
        </Button>

        {error ? (
          <p id="trackId-error" role="alert" className="mt-3 flex items-start gap-2 text-sm font-semibold text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            {error}
          </p>
        ) : (
          <FieldHint id="trackId-hint">เลขติดตามอยู่ในหน้ายืนยันหลังส่งเรื่องที่หน้าแจ้งเรื่องใหม่</FieldHint>
        )}
      </form>

      {result && (
        <section aria-labelledby="result" className="mt-8">
          <div className="glass-panel rounded-xl p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{COPY.TRACKING_CODE}เรื่อง</span>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-ink">{displayCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(displayCode)}
                      aria-label={copied ? 'คัดลอกเลขติดตามแล้ว' : 'คัดลอกเลขติดตาม'}
                      className="inline-flex min-h-touch items-center gap-1 rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-success-ink" aria-hidden="true" />
                          <span className="text-success-ink">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          <span>คัดลอก</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <h3 className="mt-1.5 text-lg font-semibold text-ink">{result.case.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {result.category && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent-sunken px-2 py-0.5 text-xs font-medium text-accent-strong">
                      <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{result.category.name}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    แจ้ง {formatThaiDateTimeShort(new Date(result.case.createdAt))}
                  </span>
                </div>
              </div>
              <CaseStatusBadge status={result.case.status} register="citizen" />
            </div>

            {/* Overall Progress Bar */}
            <div className="mt-6 rounded-xl border border-border bg-surface-raised p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">ความคืบหน้าการดำเนินงาน</span>
                <span className="font-bold tabular-nums text-accent-strong">
                  {statusProgress(result.case.status)}%
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-pill bg-ink/10 ring-1 ring-ink/5 ring-inset">
                <div
                  className={cn(
                    'h-full rounded-pill transition-all duration-slow ease-out-expo',
                    result.case.status === 'rejected'
                      ? 'bg-danger-ink'
                      : result.case.status === 'done' || result.case.status === 'closed'
                        ? 'bg-success-ink'
                        : 'bg-accent-strong',
                  )}
                  style={{ width: `${statusProgress(result.case.status)}%` }}
                />
              </div>
            </div>

            <ol className="relative mt-6">
              <span
                aria-hidden="true"
                className="absolute bottom-2 left-[1.375rem] top-2 w-px bg-border"
              />
              {timeline.map((entry, i) => {
                const isCurrent = i === timeline.length - 1;
                const StatusIcon = getStatusIcon(entry.status);
                return (
                  <li key={`${entry.status}-${entry.at}`} className="relative pb-6 last:pb-0">
                    <div className="flex gap-4">
                      <span
                        className={cn(
                          'relative z-10 flex h-11 w-11 flex-none items-center justify-center rounded-full ring-1',
                          isCurrent
                            ? 'bg-accent-strong text-on-accent ring-accent-strong'
                            : 'bg-success-soft text-success-ink ring-success-ink/30',
                        )}
                      >
                        <StatusIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CaseStatusBadge status={entry.status} register="citizen" />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {CITIZEN_STATUS_DESCRIPTIONS[entry.status]}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {formatThaiDateTimeShort(new Date(entry.at))}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* § key ตาม code ที่ trim แล้ว — สลับเคสค้นหาแล้วฟอร์มรีเซ็ต ไม่ค้าง state เก่า (B-4) */}
      {canRate && result && <FeedbackCard key={displayCode} trackingCode={displayCode} />}

      {/* กล่องช่วยเหลือและติดต่อ อบต.หัวงัว */}
      <div className="glass-panel mt-8 rounded-xl p-6 shadow-sm sm:p-8">
        <h3 className="text-base font-semibold text-ink">ต้องการความช่วยเหลือหรือสอบถามเพิ่มเติม?</h3>
        <p className="mt-1 text-sm text-muted">
          หากมีข้อสงสัยหรือต้องการสอบถามความคืบหน้าเพิ่มเติม สามารถติดต่อเจ้าหน้าที่ อบต.หัวงัว ได้โดยตรง:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={COPY.ORG_PHONE_TEL}
            className="flex min-h-touch items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 text-sm font-medium text-ink transition hover:border-accent-strong hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
              <Phone className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs text-muted">โทรศัพท์สำนักงาน</p>
              <p className="font-semibold text-ink">{COPY.ORG_PHONE}</p>
            </div>
          </a>
          <div className="flex min-h-touch items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 text-sm font-medium text-ink">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-success-soft text-success-ink">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs text-muted">เวลาทำการ</p>
              <p className="font-semibold text-ink">จันทร์ - ศุกร์ 08:30 - 16:30 น.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const RATING_LABELS = ['', 'ต้องปรับปรุง', 'พอใช้', 'ปานกลาง', 'ดี', 'ดีมาก'];

/** ให้ดาวหลังเรื่องเสร็จ/ปิด — เคสละครั้ง ตอบหรือไม่ตอบก็ได้ (ไม่ขวางอะไร) */
function FeedbackCard({ trackingCode }: { trackingCode: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) {
      setState('error');
      setMessage('กรุณาเลือกดาวก่อนส่ง');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackingCode, rating, comment: comment.trim() || undefined }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setState('error');
        setMessage(body.error ?? 'ส่งไม่สำเร็จ');
        return;
      }
      setState('done');
    } catch {
      setState('error');
      setMessage('ส่งไม่สำเร็จ กรุณาลองใหม่');
    }
  }

  if (state === 'done') {
    return (
      <p role="status" className="glass-panel mt-8 rounded-xl p-6 text-center font-medium text-success-ink shadow-sm">
        ขอบคุณสำหรับคะแนนครับ
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel mt-8 rounded-xl p-6 shadow-sm sm:p-8">
      <fieldset>
        <legend className="text-xl font-semibold">ให้คะแนนการบริการ</legend>
        <div role="radiogroup" aria-label="คะแนน 1 ถึง 5 ดาว" className="mt-3 flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={cn(
                'group flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-lg border p-2 transition',
                'focus-within:ring-2 focus-within:ring-accent-strong focus-within:ring-offset-2',
                rating >= n
                  ? 'border-warning-ink bg-warning-soft text-warning-ink'
                  : 'border-border text-muted hover:border-ink/30 hover:text-ink',
              )}
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
                aria-label={`${n} ดาว`}
              />
              <Star
                className={cn(
                  'h-6 w-6 transition',
                  rating >= n ? 'fill-warning-ink text-warning-ink' : 'text-muted group-hover:text-ink',
                )}
                aria-hidden="true"
              />
            </label>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm font-semibold text-ink">
              {rating} ดาว — {RATING_LABELS[rating]}
            </span>
          )}
        </div>
      </fieldset>
      <div className="mt-4">
        <Label htmlFor="fb-comment">ข้อเสนอแนะ (ไม่บังคับ)</Label>
        <Input
          id="fb-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="เล่าเพิ่มเติมได้ที่นี่"
          maxLength={500}
        />
      </div>
      {state === 'error' && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{message}</p>
      )}
      <Button type="submit" className="mt-4 h-11 px-7" disabled={state === 'sending'}>
        {state === 'sending' ? 'กำลังส่ง...' : 'ส่งคะแนน'}
      </Button>
    </form>
  );
}
