import { NextResponse } from 'next/server';
import { sql, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatMessages, chatFaq, chatConversations } from '@/lib/db/schema';
import { requireStaffApi } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';

export const runtime = 'nodejs';

export async function GET() {
  const authz = await requireStaffApi(ADMIN_ROLES);
  if (!authz.ok) return authz.response;

  const db = await getDb();

  const [msgStats] = await db
    .select({
      totalIn: sql<number>`count(*) filter (where sender = 'user')`.as('total_in'),
      totalOut: sql<number>`count(*) filter (where sender = 'bot')`.as('total_out'),
    })
    .from(chatMessages);

  const [faqStats] = await db
    .select({
      totalFaq: sql<number>`count(*)`.as('total'),
      totalHits: sql<number>`coalesce(sum(hit_count), 0)`.as('hits'),
      activeFaq: sql<number>`count(*) filter (where is_active = true)`.as('active'),
    })
    .from(chatFaq);

  const [convStats] = await db
    .select({
      totalConversations: sql<number>`count(*)`.as('total'),
      activeConversations: sql<number>`count(*) filter (where mode = 'bot_active' or mode = 'human_active')`.as('active'),
      handoffCount: sql<number>`count(*) filter (where mode = 'waiting_handoff' or mode = 'human_active')`.as('handoff'),
    })
    .from(chatConversations);

  const topFaq = await db
    .select({ question: chatFaq.question, hitCount: chatFaq.hitCount })
    .from(chatFaq)
    .orderBy(desc(chatFaq.hitCount))
    .limit(5);

  const totalMessages = (msgStats?.totalIn ?? 0) + (msgStats?.totalOut ?? 0);
  const faqHitRate = totalMessages > 0 ? Math.round(((faqStats?.totalHits ?? 0) / totalMessages) * 100) : 0;

  return NextResponse.json({
    messages: { totalIn: msgStats?.totalIn ?? 0, totalOut: msgStats?.totalOut ?? 0 },
    faq: { total: faqStats?.totalFaq ?? 0, active: faqStats?.activeFaq ?? 0, hits: faqStats?.totalHits ?? 0, hitRate: faqHitRate },
    conversations: { total: convStats?.totalConversations ?? 0, active: convStats?.activeConversations ?? 0, handoff: convStats?.handoffCount ?? 0 },
    topFaq,
  });
}
