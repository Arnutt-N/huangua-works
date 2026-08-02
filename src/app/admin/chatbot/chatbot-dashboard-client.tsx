'use client';

import { useEffect, useState } from 'react';
import { Bot, MessageSquare, HelpCircle, UserPlus } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';

interface Stats {
  messages: { totalIn: number; totalOut: number };
  faq: { total: number; active: number; hits: number; hitRate: number };
  conversations: { total: number; active: number; handoff: number };
  topFaq: { question: string; hitCount: number }[];
}

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/line/admin/chatbot-stats')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!stats) return <div className="py-12 text-center text-muted">โหลดข้อมูลไม่สำเร็จ</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="ข้อความเข้า" value={stats.messages.totalIn} />
        <KpiCard icon={<Bot className="h-4 w-4" />} label="ข้อความออก (bot)" value={stats.messages.totalOut} />
        <KpiCard icon={<HelpCircle className="h-4 w-4" />} label="FAQ Hit Rate" value={`${stats.faq.hitRate}%`} sub={`${stats.faq.hits} hits / ${stats.faq.active} active FAQs`} />
        <KpiCard icon={<UserPlus className="h-4 w-4" />} label="Handoff" value={stats.conversations.handoff} sub={`จาก ${stats.conversations.total} conversations`} />
      </div>

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
