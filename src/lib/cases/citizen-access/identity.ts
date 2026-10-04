import { eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '../../db';
import { firstOrUndefined } from '../../db/query-helpers';
import { lineUsers, users } from '../../db/schema';
import { generateId } from '../../id';
import { generateCidHash } from '../../cid-hmac';
import { linePlaceholderEmail } from '../../line/placeholder-email';

/**
 * ตัวตนของประชาชนที่ระบบรับรู้ได้ — เว็บผูกกับ CID เท่านั้น, LINE ผูกกับ lineUserId
 * ที่ผ่านการ verify แล้ว (webhook signature / LIFF HMAC session cookie)
 */
export type CitizenIdentity =
  | {
      kind: 'cid';
      cid: string;
      fullName?: string;
      phoneNumber?: string;
      /** email ที่ประชาชนกรอก — เก็บเป็นช่องทางติดต่อเท่านั้น ไม่ใช่ identity key */
      contactEmail?: string;
    }
  | {
      kind: 'line';
      lineUserId: string;
      /** ใช้ตั้ง users.full_name ตอนสร้างแถวใหม่เท่านั้น */
      fullName?: string;
      /** โปรไฟล์ LINE ล่าสุด (จาก ID token) — เขียนทับ line_users เมื่อส่งมา */
      profile?: { displayName?: string; pictureUrl?: string };
      source: 'line_intake' | 'liff_session';
    };

type CidIdentity = Extract<CitizenIdentity, { kind: 'cid' }>;
type LineIdentity = Extract<CitizenIdentity, { kind: 'line' }>;

/**
 * placeholder email ของผู้แจ้งทางเว็บ — ใช้ภายใน module เท่านั้น (identity + withdraw)
 * § เดิมเขียนมือสองที่ (intake.ts กับ consent/withdraw) ถ้าเปลี่ยนที่เดียว withdraw จะพังเงียบ ๆ
 */
export function cidPlaceholderEmail(cid: string): string {
  return `cid-${generateCidHash(cid)}@placeholder.local`;
}

/** คืน users.id ของประชาชน — สร้างแถว users / ผูก line_users ให้ถ้ายังไม่มี */
export async function resolveCitizen(identity: CitizenIdentity, db?: DbOrTx): Promise<string> {
  const _db = db ?? (await getDb());
  return identity.kind === 'cid'
    ? resolveCidCitizen(_db, identity)
    : resolveLineCitizen(_db, identity);
}

async function findUserIdByEmail(db: DbOrTx, email: string): Promise<string | undefined> {
  const row = await firstOrUndefined(
    db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
  );
  return row?.id;
}

/**
 * insert users แบบทน race — แพ้ unique(users.email) แล้วใช้แถวของ request ที่ชนะ
 *
 * § ห้าม catch-unique-แล้ว-select: createCase (audited-writes) เรียกฟังก์ชันนี้ใน
 * transaction ถ้า statement error ทั้ง tx abort แล้ว select ต่อไม่ได้
 * ON CONFLICT DO NOTHING ไม่ error; RETURNING ว่าง = แพ้ race → SELECT ในคำสั่งเดียวกัน
 * target คือ unique(users.email) (`schema.ts` column `.unique()`)
 */
async function insertUserOrReuse(db: DbOrTx, row: typeof users.$inferInsert): Promise<string> {
  const inserted = await db
    .insert(users)
    .values(row)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  return inserted[0]?.id ?? (await findUserIdByEmail(db, row.email)) ?? row.id;
}

async function resolveCidCitizen(db: DbOrTx, identity: CidIdentity): Promise<string> {
  // § ตัวตนของผู้แจ้งทางเว็บผูกกับ CID เท่านั้น — ห้ามใช้ email ที่กรอกเป็น lookup key
  // เดิมใช้ `input.email || cid-hash` ซึ่งเปิดให้ใครก็ได้ยิง /api/cases/submit พร้อม email
  // ของเจ้าหน้าที่ แล้วเคส + consent record ไปผูกกับบัญชีคนนั้นทั้งที่เขาไม่เคยยินยอม
  // (endpoint นี้ไม่ต้อง login — email ที่ส่งมาไม่เคยถูกยืนยัน จึงเป็น identity ไม่ได้)
  //
  // ผลพลอยได้: เดิมคนที่กรอก email จริงจะถอนความยินยอมไม่ได้เลย เพราะ withdraw
  // เทียบกับ placeholder ของ CID เท่านั้น — ผูกทุกคนด้วย CID hash เหมือนกันหมดแล้ว
  const email = cidPlaceholderEmail(identity.cid);
  const existing = await findUserIdByEmail(db, email);
  if (existing) return existing;

  return insertUserOrReuse(db, {
    id: generateId(),
    email,
    role: 'citizen',
    isActive: true,
    fullName: identity.fullName || 'ประชาชน',
    phoneNumber: identity.phoneNumber || null,
    // § email ที่ประชาชนกรอกเก็บเป็น "ช่องทางติดต่อ" ใน metadata ไม่ใช่ identity key
    metadata: JSON.stringify({
      source: 'web_intake',
      ...(identity.contactEmail ? { contactEmail: identity.contactEmail } : {}),
    }),
  });
}

async function resolveLineCitizen(db: DbOrTx, identity: LineIdentity): Promise<string> {
  // § เจ้าของความสัมพันธ์ line↔users จุดเดียวของระบบ — เดิมมีสองตัว (resolveSubmitter
  // ใน intake + linkLineIdentity ใน liff/session) ที่ทำต่างกันเล็กน้อย: ตัวหนึ่งไม่สร้าง
  // line_users ตัวหนึ่งกัน race ตัวหนึ่งไม่กัน — แจ้งผ่านบอทครั้งที่ 2 เคยชน unique(users.email)
  // และ "เรื่องของฉัน" (LIFF) มองไม่เห็นเคสของบอท
  const lineRow = await firstOrUndefined(
    db
      .select({ id: lineUsers.id, linkedUserId: lineUsers.linkedUserId })
      .from(lineUsers)
      .where(eq(lineUsers.lineUserId, identity.lineUserId))
      .limit(1),
  );

  // reuse row เดิมก่อนสร้างใหม่เสมอ — กันชน unique(users.email) จากการแจ้ง/login ซ้ำ
  let userId = lineRow?.linkedUserId ?? undefined;
  if (!userId) {
    const email = linePlaceholderEmail(identity.lineUserId);
    userId =
      (await findUserIdByEmail(db, email)) ??
      (await insertUserOrReuse(db, {
        id: generateId(),
        email,
        role: 'citizen',
        isActive: true,
        fullName: identity.fullName || 'ผู้ใช้ LINE',
        metadata: JSON.stringify({ source: identity.source }),
      }));
  }

  await linkLineRow(db, identity, lineRow, userId);
  return userId;
}

async function linkLineRow(
  db: DbOrTx,
  identity: LineIdentity,
  lineRow: { id: string; linkedUserId: string | null } | undefined,
  userId: string,
): Promise<void> {
  const profile = identity.profile ?? {};
  const profilePatch = {
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
    ...(profile.pictureUrl ? { pictureUrl: profile.pictureUrl } : {}),
  };

  if (lineRow) {
    const needsWrite = lineRow.linkedUserId !== userId || Object.keys(profilePatch).length > 0;
    if (!needsWrite) return;
    await db
      .update(lineUsers)
      .set({ linkedUserId: userId, ...profilePatch, updatedAt: new Date() })
      .where(eq(lineUsers.id, lineRow.id));
    return;
  }

  // § unique(line_users.line_user_id) แพ้ race — ON CONFLICT แล้วเขียน link ในคำสั่งเดียวกัน
  // ห้าม catch แล้ว update: ใน transaction ของ createCase statement error ทำให้ทั้ง tx abort
  // target คือ uniqueIndex('line_users_line_user_id_idx')
  await db
    .insert(lineUsers)
    .values({
      id: generateId(),
      lineUserId: identity.lineUserId,
      displayName: profile.displayName ?? null,
      pictureUrl: profile.pictureUrl ?? null,
      linkedUserId: userId,
      metadata: { profileCheckedAt: new Date().toISOString() },
    })
    .onConflictDoUpdate({
      target: lineUsers.lineUserId,
      set: { linkedUserId: userId, updatedAt: new Date() },
    });
}
