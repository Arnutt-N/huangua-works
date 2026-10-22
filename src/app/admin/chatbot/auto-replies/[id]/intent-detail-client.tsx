'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Key, MessageSquare, Plus, Pencil, Trash2 } from 'lucide-react';
import type { IntentMatchType } from '@/app/admin/_lib/admin-api';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { readinessOf } from '../readiness';
import { useResource } from '@/app/admin/_lib/use-resource';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

const MATCH_LABELS: Record<IntentMatchType, string> = {
  exact: 'ตรงทั้งหมด',
  starts_with: 'ขึ้นต้น',
  contains: 'มีคำนี้',
  regex: 'regex',
};

export function IntentDetailClient({ intentId }: { intentId: string }) {
  const { data: item, loading, feedback, notify, reload } = useResource({
    load: () => adminApi.getIntent(intentId),
  });

  const [activeTab, setActiveTab] = useState<'keywords' | 'responses'>('keywords');

  async function handleToggle() {
    if (!item) return;
    // § ส่งเฉพาะ isActive — ลด read-modify-write (ดู intent-section)
    const res = await adminApi.updateIntent(item.id, { isActive: !item.isActive });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    notify('success', item.isActive ? 'ปิดหมวดแล้ว' : 'เปิดหมวดแล้ว');
    await reload();
  }

  async function handleDeleteKeyword(keywordId: string) {
    if (!item) return;
    // § server min(1) — ลบตัวสุดท้ายฝั่ง client ก่อนยิง ไม่ให้ 400 แล้วงง
    if (item.keywords.length <= 1) {
      notify('error', 'ต้องเหลือ keyword อย่างน้อย 1 คำ');
      return;
    }
    if (!confirm('ลบ keyword นี้?')) return;
    // § ส่งเฉพาะ keywords ที่เปลี่ยน — ไม่ทับ responses/name ที่อาจมีคนอื่นแก้พร้อมกัน
    const res = await adminApi.updateIntent(item.id, {
      keywords: item.keywords.filter((k) => k.id !== keywordId).map((k) => ({ keyword: k.keyword, matchType: k.matchType })),
    });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    await reload();
  }

  async function handleDeleteResponse(responseId: string) {
    if (!item) return;
    // § server min(1) — เหมือน keyword
    if (item.responses.length <= 1) {
      notify('error', 'ต้องเหลือคำตอบอย่างน้อย 1 ข้อ');
      return;
    }
    if (!confirm('ลบคำตอบนี้?')) return;
    // § ส่งเฉพาะ responses ที่เปลี่ยน — ไม่ทับ keywords/name
    const res = await adminApi.updateIntent(item.id, {
      responses: item.responses
        .filter((r) => r.id !== responseId)
        .map((r, i) => ({
          replyType: r.replyType,
          textContent: r.textContent,
          replyObjectId: r.replyObjectId,
          displayOrder: i,
        })),
    });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    await reload();
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!item) return <div className="py-12 text-center text-muted">ไม่พบหมวดนี้</div>;

  const { ready, reason } = readinessOf(item);

  return (
    <div className="space-y-4">
      {feedback && (
        <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {feedback.msg}
        </div>
      )}
      <Link href="/admin/chatbot/auto-replies" className="inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-accent-strong">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายการ
      </Link>

      <AdminCard>
        <AdminCardTitle
          icon={<MessageSquare className="h-4 w-4" />}
          action={
            <button
              type="button"
              onClick={handleToggle}
              aria-label={`${item.isActive ? 'ปิด' : 'เปิด'} ${item.name}`}
              aria-pressed={item.isActive}
              className="min-h-touch rounded-full px-3 text-xs font-semibold hover:bg-accent/10"
            >
              <span className={`inline-block rounded-full px-2 py-0.5 ${item.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {ready && item.isActive ? 'พร้อม' : `ไม่พร้อม (${reason})`}
              </span>
            </button>
          }
        >
          {item.name}
        </AdminCardTitle>
        {item.description && <p className="text-sm text-muted">{item.description}</p>}
      </AdminCard>

      <div className="flex gap-2" role="tablist" aria-label="ส่วนของหมวด">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'keywords'}
          onClick={() => setActiveTab('keywords')}
          className={`min-h-touch rounded-lg px-4 text-sm font-semibold ${activeTab === 'keywords' ? 'bg-accent-strong text-on-accent' : 'border border-border text-muted'}`}
        >
          Keywords ({item.keywords.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'responses'}
          onClick={() => setActiveTab('responses')}
          className={`min-h-touch rounded-lg px-4 text-sm font-semibold ${activeTab === 'responses' ? 'bg-accent-strong text-on-accent' : 'border border-border text-muted'}`}
        >
          คำตอบ ({item.responses.length})
        </button>
      </div>

      {activeTab === 'keywords' ? (
        <AdminCard>
          <AdminCardTitle icon={<Key className="h-4 w-4" />}>Keywords</AdminCardTitle>
          {item.keywords.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">ยังไม่มี keyword — เพิ่มจากปุ่มแก้ไขในหน้ารายการ</p>
          ) : (
            <ul className="space-y-2">
              {item.keywords.map((kw) => (
                <li key={kw.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                  <span>
                    <span className="text-sm font-medium text-ink">{kw.keyword}</span>
                    <span className="ml-2 rounded bg-accent-sunken px-1.5 py-0.5 text-xs text-accent-strong">{MATCH_LABELS[kw.matchType]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteKeyword(kw.id)}
                    className="flex min-h-touch min-w-touch items-center justify-center rounded-md hover:bg-danger/10"
                    aria-label={`ลบ keyword ${kw.keyword}`}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      ) : (
        <AdminCard>
          <AdminCardTitle icon={<MessageSquare className="h-4 w-4" />}>คำตอบ</AdminCardTitle>
          {item.responses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">ยังไม่มีคำตอบ — เพิ่มจากปุ่มแก้ไขในหน้ารายการ</p>
          ) : (
            <ul className="space-y-2">
              {item.responses.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    {r.replyType === 'text' ? (
                      <span className="block truncate text-sm text-ink">{r.textContent ?? '—'}</span>
                    ) : (
                      <span className="block font-mono text-sm font-bold text-accent-strong">${r.replyObjectId ?? '—'}</span>
                    )}
                    <span className="text-xs text-muted">{r.replyType === 'text' ? 'ข้อความ' : 'reply object'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteResponse(r.id)}
                    className="flex min-h-touch min-w-touch items-center justify-center rounded-md hover:bg-danger/10"
                    aria-label="ลบคำตอบนี้"
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setActiveTab(activeTab === 'keywords' ? 'responses' : 'keywords')} className="gap-1.5">
          <Plus className="h-4 w-4" /> จัดการจากหน้ารายการ
        </Button>
        <span className="inline-flex min-h-touch items-center gap-1 text-xs text-muted">
          <Pencil className="h-3.5 w-3.5" /> แก้ไข keyword/คำตอบแบบเต็มที่ปุ่มแก้ไขในตารางรายการ
        </span>
      </div>
    </div>
  );
}
