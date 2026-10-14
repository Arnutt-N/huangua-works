'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { CaseStatusBadge } from '../../components/ui/case-status-badge';
import { Button } from '../../components/ui/button';
import { FieldHint, Input, Label } from '../../components/ui/field';
import { clearTrackDraft, readTrackDraft, saveTrackDraft } from '../../components/forms/non-pii-draft';
import { cn } from '../../lib/cn';
import { COPY } from '../../lib/copy';
import type { CaseStatus } from '../../lib/cases/state-machine';
import { formatThaiDateTimeShort } from '../../lib/thai-date';

interface CaseDetail {
  case: {
    id: string;
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
    const trimmed = trackId.trim();
    if (!trimmed) {
      setError('กรุณากรอกเลขติดตามเรื่อง');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResult(null);

    const result = await fetchCase(trimmed);
    if (result.ok) setResult(result.data);
    else setError(result.error);
    setIsSearching(false);
  }

  const timeline = result ? buildTimeline(result) : [];
  const canRate = !!result && (result.case.status === 'done' || result.case.status === 'closed');

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="glass-panel mt-8 rounded-xl p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="bg-accent-100 flex h-10 w-10 items-center justify-center rounded-xl">
            <Search className="text-accent-strong h-5 w-5" aria-hidden="true" />
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
            onChange={(e) => setTrackId(e.target.value)}
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
              <div className="min-w-0">
                <p className="text-sm text-muted">
                  {COPY.TRACKING_CODE}เรื่อง{' '}
                  <span className="font-mono font-semibold text-ink">{trackId}</span>
                </p>
                <h3 className="mt-1 text-lg font-semibold">{result.case.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    แจ้ง {formatThaiDateTimeShort(new Date(result.case.createdAt))}
                  </span>
                </p>
              </div>
              <CaseStatusBadge status={result.case.status} register="citizen" />
            </div>

            <ol className="relative mt-6">
              <span
                aria-hidden="true"
                className="absolute bottom-2 left-[1.375rem] top-2 w-px bg-border"
              />
              {timeline.map((entry, i) => {
                const isCurrent = i === timeline.length - 1;
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
                        {isCurrent ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        )}
                      </span>
                      <div className="pt-1.5">
                        <CaseStatusBadge status={entry.status} register="citizen" />
                        <p className="mt-1 text-sm text-muted">{formatThaiDateTimeShort(new Date(entry.at))}</p>
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
      {canRate && result && <FeedbackCard key={trackId.trim()} trackingCode={trackId.trim()} />}
    </>
  );
}

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
        <div role="radiogroup" aria-label="คะแนน 1 ถึง 5 ดาว" className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={cn(
                'flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-lg border text-lg font-bold',
                rating >= n ? 'border-accent-strong bg-accent-100 text-accent-strong' : 'border-border text-muted',
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
              ★
            </label>
          ))}
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
