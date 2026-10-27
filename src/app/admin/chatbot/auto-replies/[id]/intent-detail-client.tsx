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
import { AdminErrorState } from '@/components/admin/admin-error-state';

const MATCH_LABELS: Record<IntentMatchType, string> = {
  exact: 'ตรงทั้งหมด',
  starts_with: 'ขึ้นต้น',
  contains: 'มีคำนี้',
  regex: 'regex',
};

export function IntentDetailClient({ intentId }: { intentId: string }) {
  const { data: item, loading, feedback, error, errorCode, errorStatus, notify, reload } = useResource({
    load: (_q, opts) => adminApi.getIntent(intentId, opts),
  });

  const [activeTab, setActiveTab] = useState<'keywords' | 'responses'>('keywords');
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newMatchType, setNewMatchType] = useState<IntentMatchType>('contains');
  const [newReplyType, setNewReplyType] = useState<'text' | 'reply_object'>('text');
  const [newResponseText, setNewResponseText] = useState('');
  const [mutating, setMutating] = useState(false);

  async function handleToggle() {
    if (!item || mutating) return;
    setMutating(true);
    try {
      const res = await adminApi.updateIntent(item.id, { isActive: !item.isActive });
      if (!res.ok) {
        notify('error', res.error);
        return;
      }
      notify('success', item.isActive ? 'ปิดหมวดแล้ว' : 'เปิดหมวดแล้ว');
      await reload();
    } finally {
      setMutating(false);
    }
  }

  async function handleDeleteKeyword(keywordId: string) {
    if (!item) return;
    // § server min(1) — ลบตัวสุดท้ายฝั่ง client ก่อนยิง ไม่ให้ 400 แล้วงง
    if (item.keywords.length <= 1) {
      notify('error', 'ต้องเหลือ keyword อย่างน้อย 1 คำ');
      return;
    }
    if (!confirm('ลบ keyword นี้?')) return;
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

  async function saveMeta() {
    if (!item || nameDraft === null) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      notify('error', 'ชื่อหมวดต้องไม่ว่าง');
      return;
    }
    const res = await adminApi.updateIntent(item.id, {
      name: trimmed,
      description: (descDraft ?? '').trim() || null,
    });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    notify('success', 'บันทึกชื่อ/คำอธิบายแล้ว');
    setNameDraft(null);
    setDescDraft(null);
    await reload();
  }

  async function addKeyword() {
    if (!item) return;
    const kw = newKeyword.trim();
    if (!kw) {
      notify('error', 'กรุณากรอก keyword');
      return;
    }
    const res = await adminApi.updateIntent(item.id, {
      keywords: [
        ...item.keywords.map((k) => ({ keyword: k.keyword, matchType: k.matchType })),
        { keyword: kw, matchType: newMatchType },
      ],
    });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    setNewKeyword('');
    await reload();
  }

  async function addResponse() {
    if (!item) return;
    const value = newResponseText.trim();
    if (!value) {
      notify('error', newReplyType === 'text' ? 'กรุณากรอกข้อความคำตอบ' : 'กรุณากรอก reply object id');
      return;
    }
    const res = await adminApi.updateIntent(item.id, {
      responses: [
        ...item.responses.map((r) => ({
          replyType: r.replyType,
          textContent: r.textContent,
          replyObjectId: r.replyObjectId,
          displayOrder: r.displayOrder,
        })),
        {
          replyType: newReplyType,
          textContent: newReplyType === 'text' ? value : null,
          replyObjectId: newReplyType === 'reply_object' ? value : null,
          displayOrder: item.responses.length,
        },
      ],
    });
    if (!res.ok) {
      notify('error', res.error);
      return;
    }
    setNewResponseText('');
    await reload();
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!item && error && errorStatus !== 404) return <AdminErrorState error={error} errorCode={errorCode} onRetry={() => void reload()} />;
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
              disabled={mutating}
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
        {nameDraft === null ? (
          <div className="flex flex-wrap items-center gap-2">
            {item.description && <p className="text-sm text-muted">{item.description}</p>}
            <Button
              variant="outline"
              onClick={() => {
                setNameDraft(item.name);
                setDescDraft(item.description ?? '');
              }}
              className="gap-1 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" /> แก้ไข
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <input
              aria-label="ชื่อหมวด"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-ink"
            />
            <input
              aria-label="คำอธิบาย"
              value={descDraft ?? ''}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="คำอธิบาย (เว้นว่างได้)"
              className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-ink"
            />
            <div className="flex gap-2">
              <Button onClick={() => void saveMeta()} className="text-xs">บันทึก</Button>
              <Button variant="ghost" onClick={() => { setNameDraft(null); setDescDraft(null); }}>
                ยกเลิก
              </Button>
            </div>
          </div>
        )}
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
            <p className="py-6 text-center text-sm text-muted">ยังไม่มี keyword — เพิ่มด้านล่าง</p>
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
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
            <div className="min-w-40 flex-1">
              <label htmlFor="add-keyword" className="text-xs text-muted">keyword ใหม่</label>
              <input
                id="add-keyword"
                aria-label="keyword ใหม่"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="เช่น กี่โมง"
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-ink"
              />
            </div>
            <div>
              <label htmlFor="add-match" className="text-xs text-muted">วิธีจับคู่</label>
              <select
                id="add-match"
                aria-label="วิธีจับคู่ keyword"
                value={newMatchType}
                onChange={(e) => setNewMatchType(e.target.value as IntentMatchType)}
                className="min-h-touch rounded-md border border-border bg-surface-raised px-2 text-sm text-ink"
              >
                <option value="exact">ตรงทั้งหมด</option>
                <option value="starts_with">ขึ้นต้น</option>
                <option value="contains">มีคำนี้</option>
                <option value="regex">regex</option>
              </select>
            </div>
            <Button onClick={() => void addKeyword()} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> เพิ่ม
            </Button>
          </div>
        </AdminCard>
      ) : (
        <AdminCard>
          <AdminCardTitle icon={<MessageSquare className="h-4 w-4" />}>คำตอบ</AdminCardTitle>
          {item.responses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">ยังไม่มีคำตอบ — เพิ่มด้านล่าง</p>
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
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
            <div className="min-w-40 flex-1">
              <label htmlFor="add-response" className="text-xs text-muted">คำตอบใหม่</label>
              <input
                id="add-response"
                aria-label="คำตอบใหม่"
                value={newResponseText}
                onChange={(e) => setNewResponseText(e.target.value)}
                placeholder={newReplyType === 'text' ? 'ข้อความตอบกลับ' : 'reply object id เช่น rpl_xxx'}
                className="min-h-touch w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-ink"
              />
            </div>
            <div>
              <label htmlFor="add-reply-type" className="text-xs text-muted">ประเภท</label>
              <select
                id="add-reply-type"
                aria-label="ประเภทคำตอบ"
                value={newReplyType}
                onChange={(e) => setNewReplyType(e.target.value as 'text' | 'reply_object')}
                className="min-h-touch rounded-md border border-border bg-surface-raised px-2 text-sm text-ink"
              >
                <option value="text">ข้อความ</option>
                <option value="reply_object">reply object</option>
              </select>
            </div>
            <Button onClick={() => void addResponse()} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> เพิ่ม
            </Button>
          </div>
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
