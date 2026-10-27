'use client';

import Link from 'next/link';
import { MessageSquare, Package, Tags } from 'lucide-react';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { PageHeader } from '@/components/admin/page-header';
import { AdminErrorState } from '@/components/admin/admin-error-state';
import { KpiCard } from '@/components/admin/kpi-card';
import { readinessOf } from './auto-replies/readiness';

export function ChatbotDashboardClient() {
  const replyObjectsRes = useResource({ load: adminApi.listReplyObjects });
  const intentsRes = useResource({ load: adminApi.listIntents });

  const replyObjects = replyObjectsRes.data?.items ?? [];
  const intents = intentsRes.data?.items ?? [];
  const loading = replyObjectsRes.loading || intentsRes.loading;
  const replyObjectsError = replyObjectsRes.error;
  const intentsError = intentsRes.error;

  const activeIntents = intents.filter((i) => i.isActive);
  const activeResponses = activeIntents.reduce((sum, i) => sum + i.responses.length, 0);

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Chatbot Overview" subtitle="จัดการคำตอบอัตโนมัติและข้อความ Flex ของ LINE OA" />

      {(replyObjectsError ?? intentsError) && (
        <AdminErrorState error={(replyObjectsError ?? intentsError)!} errorCode={replyObjectsRes.errorCode ?? intentsRes.errorCode} onRetry={() => { void replyObjectsRes.reload(); void intentsRes.reload(); }} variant="inline" />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/chatbot/reply-objects" className="block">
          <KpiCard
            label="Reply Objects"
            value={replyObjects.length}
            icon={Package}
            hint="Flex Messages & Images"
          />
        </Link>
        <Link href="/admin/chatbot/auto-replies" className="block">
          <KpiCard
            label="Intent Categories"
            value={intents.length}
            icon={Tags}
            hint={`${activeIntents.length} หมวดที่เปิดใช้`}
            variant="gold"
          />
        </Link>
        <KpiCard
          label="Active Responses"
          value={activeResponses}
          icon={MessageSquare}
          hint="คำตอบในหมวดที่เปิดใช้"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <span className="h-5 w-1 rounded-full bg-accent-strong" aria-hidden="true" />
              Recent Templates
            </h2>
            <Link
              href="/admin/chatbot/reply-objects"
              className="text-xs font-medium uppercase tracking-wide text-accent-strong hover:underline"
            >
              View All
            </Link>
          </div>
          {replyObjectsError ? null : replyObjects.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              ยังไม่มี Reply Object —{' '}
              <Link href="/admin/chatbot/reply-objects/new" className="font-semibold text-accent-strong hover:underline">
                สร้างเทมเพลตแรก
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {replyObjects.slice(0, 5).map((obj) => (
                <li key={obj.id} className="px-5 py-3.5 hover:bg-accent/5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-sunken text-sm font-semibold text-accent-strong">
                        $
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {obj.name ?? obj.objectId}
                        </p>
                        <p className="truncate font-mono text-xs text-muted">${obj.objectId}</p>
                      </div>
                    </div>
                    <span className="flex-none rounded-sm bg-surface-sunken px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      {obj.objectType}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <span className="h-5 w-1 rounded-full bg-accent-strong" aria-hidden="true" />
              Active Intents
            </h2>
            <Link
              href="/admin/chatbot/auto-replies"
              className="text-xs font-medium uppercase tracking-wide text-accent-strong hover:underline"
            >
              Manage
            </Link>
          </div>
          {intentsError ? null : intents.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              ยังไม่มีหมวดเจตนา —{' '}
              <Link href="/admin/chatbot/auto-replies" className="font-semibold text-accent-strong hover:underline">
                ไปสร้างหมวด
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {intents.slice(0, 5).map((item) => {
                const { ready, reason } = readinessOf(item);
                return (
                  <li key={item.id}>
                    <Link
                      href="/admin/chatbot/auto-replies"
                      className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-accent/5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent-sunken text-sm font-semibold text-accent-strong">
                          #
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                          <p className="text-xs text-muted">
                            {item.keywords.length} keywords · {item.responses.length} responses
                          </p>
                        </div>
                      </div>
                      <span
                        className={`h-2 w-2 flex-none rounded-full ${ready ? 'bg-success' : 'bg-danger'}`}
                        title={reason}
                        aria-label={reason}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
