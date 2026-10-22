'use client';

import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { readinessOf } from './auto-replies/readiness';
import { Bot, MessageSquare, HelpCircle, UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function ChatbotDashboardClient() {
  const { data: stats, loading: statsLoading, feedback } = useResource({
    load: adminApi.getChatbotStats,
  });
  const { data: intentsData, loading: intentsLoading, feedback: intentsFeedback } = useResource({
    load: adminApi.listIntents,
  });
  const intents = intentsData?.items ?? [];
  // § feedback ของ intents แยกจาก stats: intents ล้มต้องไม่เหมารวมกับ stats และไม่หลอกว่าไม่มีหมวด
  const intentsError = intentsFeedback?.type === 'error' ? intentsFeedback.msg : null;

  // § รวม loading ทั้งสองแหล่ง — กัน flash false-empty ตอน stats เสร็จก่อน intents
  if (statsLoading || intentsLoading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!stats) {
    return (
      <div className="py-12 text-center text-danger">
        {feedback?.type === 'error' ? feedback.msg : 'โหลดข้อมูลไม่สำเร็จ'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="ข้อความเข้า" value={stats.messages.totalIn} />
        <KpiCard icon={<Bot className="h-4 w-4" />} label="ข้อความออก (bot)" value={stats.messages.totalOut} />
        <KpiCard icon={<HelpCircle className="h-4 w-4" />} label="FAQ Hit Rate" value={`${stats.faq.hitRate}%`} sub={`${stats.faq.hits} hits / ${stats.faq.active} active FAQs`} />
        <Link href="/admin/chat" className="block rounded-xl border border-border/50 p-4 hover:bg-accent/5">
          <span className="flex items-center gap-2 text-muted">
            <UserPlus className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Handoff</span>
          </span>
          <span className="mt-2 block text-2xl font-bold tabular-nums text-ink">{stats.conversations.handoff}</span>
          <span className="mt-0.5 block text-xs text-muted">จาก {stats.conversations.total} conversations — เปิด live chat →</span>
        </Link>
      </div>

      <AdminCard>
        <AdminCardTitle>ความพร้อมบอท (Readiness)</AdminCardTitle>
        {/* § intents ล้มต้องเห็น error ไทยเหนือการ์ดนี้ — ห้ามตกไป empty state ชวนสร้างหมวดซ้ำ */}
        {intentsError && (
          <div role="status" className="mb-3 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {intentsError}
          </div>
        )}
        {intentsError ? null : intents.length === 0 ? (
          <p className="text-sm text-muted">
            ยังไม่มีหมวดเจตนา —{' '}
            <Link href="/admin/chatbot/auto-replies" className="font-semibold text-accent-strong hover:underline">
              ไปสร้างหมวด
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {intents.map((item) => {
              const { ready, reason } = readinessOf(item);
              const Icon = ready ? CheckCircle2 : XCircle;
              return (
                <Link
                  key={item.id}
                  href="/admin/chatbot/auto-replies"
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-3 hover:bg-accent/5"
                >
                  <Icon
                    className={`h-5 w-5 flex-none ${ready ? 'text-success' : 'text-danger'}`}
                    aria-label={ready ? 'พร้อม' : `ไม่พร้อม: ${reason}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.name}</span>
                  <span className="flex-none text-xs tabular-nums text-muted">
                    {item.keywords.length} kw · {item.responses.length} ตอบ
                  </span>
                  <span
                    className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium ${
                      ready ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {ready ? 'พร้อม' : reason}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>คำถามยอดนิยม (Top FAQ)</AdminCardTitle>
        {stats.topFaq.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีข้อมูล — เพิ่ม FAQ และรอให้ประชาชนถาม</p>
        ) : (
          <div className="space-y-2">
            {stats.topFaq.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-sunken text-xs font-bold text-accent-strong">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.question}</span>
                <span className="flex-none text-sm tabular-nums text-muted">{item.hitCount} hits</span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
