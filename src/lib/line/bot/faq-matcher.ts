import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatFaq } from '@/lib/db/schema';

interface FaqMatch {
  id: string;
  answer: string;
  score: number;
}

export async function matchFaq(input: string): Promise<FaqMatch | null> {
  const db = await getDb();
  const normalized = input.toLowerCase().trim();

  const faqs = await db
    .select()
    .from(chatFaq)
    .where(and(eq(chatFaq.isActive, true)));

  let best: FaqMatch | null = null;

  for (const faq of faqs) {
    const keywords = faq.keywords as string[];
    let hits = 0;
    for (const kw of keywords) {
      if (normalized.includes(kw.toLowerCase())) hits++;
    }
    if (hits === 0) continue;

    const score = hits / keywords.length + faq.priority * 0.1;
    if (!best || score > best.score) {
      best = { id: faq.id, answer: faq.answer, score };
    }
  }

  if (best) {
    await db
      .update(chatFaq)
      .set({ hitCount: sql`${chatFaq.hitCount} + 1` })
      .where(eq(chatFaq.id, best.id));
  }

  return best;
}
