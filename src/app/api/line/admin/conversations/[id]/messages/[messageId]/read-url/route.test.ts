import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * § ห้องแชทอ่านข้ามห้องไม่ได้ — route ต้องกรองทั้ง messageId และ conversationId
 * และต้องไม่คืน key หรือ URL ของ storage ให้ client
 */

const mocks = vi.hoisted(() => ({
  row: null as
    | { storageKey: string | null; mediaUrl: string | null; messageType: string; metadata: unknown }
    | null,
  signedKeys: [] as string[],
  whereArgs: [] as unknown[],
  ownerConv: 'conv-1',
  requestedConv: '',
}));

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'staff-1' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    readUrlForKey: vi.fn(async (key: string) => {
      mocks.signedKeys.push(key);
      return `https://signed.example/${key}?X-Amz-Signature=abc`;
    }),
  };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = (arg: unknown) => {
      mocks.whereArgs.push(arg);
      return chain;
    };
    // § จำลอง FK join: คืนแถวเฉพาะเมื่อ route ถามห้องเดียวกับเจ้าของแถว
    // route ที่ไม่กรอง conversationId จะได้แถวเสมอ = เทสต์ข้ามห้องจะแดง
    chain.limit = async () => (mocks.row && mocks.ownerConv === mocks.requestedConv ? [mocks.row] : []);
    return { select: () => chain };
  }),
}));

const { GET } = await import('./route');

const ENDPOINT = 'https://abc.supabase.co/storage/v1/s3';

function call(conversationId = 'conv-1', messageId = 'msg-1') {
  mocks.requestedConv = conversationId;
  return GET(new Request(`http://localhost/api/line/admin/conversations/${conversationId}/messages/${messageId}/read-url`), {
    params: Promise.resolve({ id: conversationId, messageId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = null;
  mocks.signedKeys.length = 0;
  mocks.whereArgs.length = 0;
  mocks.ownerConv = 'conv-1';
  mocks.requestedConv = '';
  vi.stubEnv('S3_ENDPOINT', ENDPOINT);
  vi.stubEnv('S3_BUCKET', 'media');
});

describe('GET .../messages/[messageId]/read-url', () => {
  it('เซ็น key จาก storage_key ของแถว', async () => {
    mocks.row = {
      storageKey: 'line-inbound/m1/a.jpg',
      mediaUrl: `${ENDPOINT}/media/line-inbound/m1/a.jpg`,
      messageType: 'image',
      metadata: { contentType: 'image/jpeg', fileName: 'a.jpg' },
    };

    const res = await call();

    expect(res.status).toBe(200);
    expect(mocks.signedKeys).toEqual(['line-inbound/m1/a.jpg']);
  });

  it('fallback ไป mediaUrl เมื่อยังไม่มี storage_key', async () => {
    mocks.row = {
      storageKey: null,
      mediaUrl: `${ENDPOINT}/media/line-inbound/m2/b.png`,
      messageType: 'image',
      metadata: { contentType: 'image/png' },
    };

    const res = await call();

    expect(res.status).toBe(200);
    expect(mocks.signedKeys).toEqual(['line-inbound/m2/b.png']);
  });

  it('แถวของห้องอื่นไม่ถูกเซ็น — route ต้องผูก messageId กับ conversationId', async () => {
    // § mock จำลอง DB ที่กรองเอง: เก็บ row พร้อม conversationId เจ้าของ
    // route ที่กรองถูก → ถามห้องผิดได้ 0 แถว → 404 (ไม่ใช่เซ็น URL ให้)
    mocks.ownerConv = 'conv-A';
    mocks.row = {
      storageKey: 'line-inbound/m1/a.jpg',
      mediaUrl: null,
      messageType: 'image',
      metadata: {},
    };

    const wrongRoom = await call('conv-B', 'msg-1');
    expect(wrongRoom.status).toBe(404);
    expect(mocks.signedKeys).toEqual([]);

    mocks.signedKeys.length = 0;
    const rightRoom = await call('conv-A', 'msg-1');
    expect(rightRoom.status).toBe(200);
    expect(mocks.signedKeys).toEqual(['line-inbound/m1/a.jpg']);
  });

  it('คืน 409 เมื่อไม่มีไฟล์หรือ URL ไม่ตรงรูปแบบ', async () => {
    mocks.row = { storageKey: null, mediaUrl: 'https://foreign.example/z.jpg', messageType: 'image', metadata: {} };

    const res = await call();

    expect(res.status).toBe(409);
    expect(mocks.signedKeys).toEqual([]);
  });

  it('คืน 404 เมื่อไม่พบข้อความ', async () => {
    const res = await call();
    expect(res.status).toBe(404);
    expect(mocks.signedKeys).toEqual([]);
  });

  it('ไม่คืน key หรือ URL ของ storage ใน response', async () => {
    mocks.row = {
      storageKey: 'line-inbound/m1/a.jpg',
      mediaUrl: null,
      messageType: 'image',
      metadata: { contentType: 'image/jpeg' },
    };

    const res = await call();
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain(ENDPOINT);
    expect(body).not.toContain('storageKey');
    expect(body).toContain('X-Amz-Signature');
  });
});
