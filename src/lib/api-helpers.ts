import { NextResponse } from 'next/server';
import type { z } from 'zod';

export function parseBodyError(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export async function parseBody<T extends z.ZodType>(
  schema: T,
  request: Request,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: parseBodyError('Invalid JSON') };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: parseBodyError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง') };
  }

  return { ok: true, data: parsed.data };
}
