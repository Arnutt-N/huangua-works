'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { CaseStatusBadge } from '../../components/ui/case-status-badge';
import { Button } from '../../components/ui/button';
import { FieldHint, Input, Label } from '../../components/ui/field';
import { cn } from '../../lib/cn';
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

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="glass mt-8 rounded-xl p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="bg-accent-100 flex h-10 w-10 items-center justify-center rounded-xl">
            <Search className="text-accent-strong h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">ค้นหาเรื่อง</h2>
        </div>

        <div className="mt-5">
          <Label htmlFor="trackId">เลขติดตามเรื่อง</Label>
          <Input
            id="trackId"
            placeholder="เช่น HG483729156"
            invalid={!!error}
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
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-5 w-5" aria-hidden="true" />
          )}
          ค้นหาเรื่อง
        </Button>

        {error ? (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm font-semibold text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            {error}
          </p>
        ) : (
          <FieldHint>เลขติดตามอยู่ในหน้ายืนยันหลังส่งเรื่องที่หน้าแจ้งเรื่องใหม่</FieldHint>
        )}
      </form>

      {result && (
        <section aria-labelledby="result" className="mt-8">
          <div className="glass rounded-xl p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">
                  เลขติดตามเรื่อง{' '}
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
              <CaseStatusBadge status={result.case.status} />
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
                        <CaseStatusBadge status={entry.status} />
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
    </>
  );
}
