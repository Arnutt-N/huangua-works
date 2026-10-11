/**
 * Legacy import — ตรรกะนำเข้าทะเบียน Excel ย้อนหลัง (pure + DB แยกชั้น)
 *
 * อ่าน staging จาก scripts/prepare-excel-intake.py (rows/review-queue/manifest)
 * แยกส่วน pure (classify/build) ออกจากส่วนเขียน DB เพื่อให้ unit test ได้โดยไม่ต้องมี DB
 * console/log ทุกจุดห้ามพิมพ์ PII — พิมพ์ได้เฉพาะ counts, source_key (hash), เลขแถว
 */

import { inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import {
  cases,
  caseUpdates,
  categories,
  departments,
  importBatches,
  legacyResponsibleMap,
} from '../db/schema';
import { generateId } from '../id';
import { AUDIT_ACTIONS, logAudit } from '../audit';
import { isCaseStatus, type CaseStatus } from '../cases/state-machine';
import { normalizeLegacyName, resolveCitizen } from '../cases/citizen-access/identity';

export class ImportError extends Error {}

/** ข้อความดิบของเซลล์ใน staging (tagged) — ใช้เฉพาะ .value ที่เป็น string */
interface TaggedCell {
  type: string;
  value: string | number | boolean | null;
}

export interface StagedRow {
  sourceKey: string;
  rowNumber: number;
  sourceSha256: string;
  receivedDate: string | null;
  categorySlug: string | null;
  categoryId: string | null;
  statusValue: string | null;
  reviewCodes: string[];
  /** ค่าดิบรายแถว (H/B/D/F/J/K/E + ผู้รับผิดชอบ) — อยู่ใน memory เท่านั้น ห้าม log */
  raw: {
    detail: string;
    receiptNo: string;
    channel: string;
    villageRaw: string;
    statusRaw: string;
    note: string;
    submitterName: string;
    responsibleRaw: string;
  };
}

export interface StagedBundle {
  manifest: {
    sourceSha256: string;
    masterSha256: string;
    writeGate: string;
    dbReady: number;
    outputSha256: Record<string, string>;
  };
  rows: StagedRow[];
}

function cellString(cell: unknown): string {
  if (typeof cell !== 'object' || cell === null) return '';
  const value = (cell as TaggedCell).value;
  return typeof value === 'string' ? value : value === null ? '' : String(value);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ImportError(`รูปแบบ ${what} ไม่ถูกต้อง`);
  }
  return value as Record<string, unknown>;
}

/** parse staging boundary — ตรวจโครงก่อนใช้ ไม่เชื่อชนิดจากไฟล์ */
export function parseBundle(
  manifestText: string,
  reviewQueueText: string,
  rowsText: string,
): StagedBundle {
  const manifest = asRecord(JSON.parse(manifestText), 'manifest');
  const outputSha256 = asRecord(manifest.output_sha256 ?? {}, 'output_sha256');
  for (const name of ['rows.jsonl', 'review-queue.jsonl', 'summary.json', 'ownership.json']) {
    if (typeof outputSha256[name] !== 'string') {
      throw new ImportError(`manifest ขาด hash ของ ${name}`);
    }
  }
  const manifestInfo = {
    sourceSha256: String(manifest.source_sha256 ?? ''),
    masterSha256: String(manifest.master_sha256 ?? ''),
    writeGate: String(manifest.write_gate ?? ''),
    dbReady: Number(manifest.db_ready ?? -1),
    outputSha256: outputSha256 as Record<string, string>,
  };
  if (!manifestInfo.sourceSha256 || manifestInfo.writeGate !== 'blocked' || manifestInfo.dbReady !== 0) {
    throw new ImportError('manifest ไม่ใช่ staging ที่พร้อมนำเข้า (write_gate ต้อง blocked, db_ready ต้อง 0)');
  }

  const codesByKey = new Map<string, string[]>();
  for (const line of reviewQueueText.split('\n')) {
    if (!line.trim()) continue;
    const entry = asRecord(JSON.parse(line), 'review-queue');
    const key = String(entry.source_key ?? '');
    const codes = Array.isArray(entry.codes) ? entry.codes.map(String) : [];
    if (key) codesByKey.set(key, codes);
  }

  const rows: StagedRow[] = [];
  for (const line of rowsText.split('\n')) {
    if (!line.trim()) continue;
    const record = asRecord(JSON.parse(line), 'rows');
    const source = asRecord(record.source ?? {}, 'source');
    const original = asRecord(record.original ?? {}, 'original');
    const category = asRecord(record.category ?? {}, 'category');
    const status = asRecord(record.status ?? {}, 'status');
    const key = String(record.source_key ?? '');
    if (!key) throw new ImportError('พบแถวไม่มี source_key');
    rows.push({
      sourceKey: key,
      rowNumber: Number(source.row ?? 0),
      sourceSha256: String(source.workbook_sha256 ?? ''),
      receivedDate: typeof record.received_date === 'string' ? record.received_date : null,
      categorySlug: typeof category.value === 'string' ? category.value : null,
      categoryId: typeof category.id === 'string' ? category.id : null,
      statusValue: typeof status.value === 'string' ? status.value : null,
      reviewCodes: codesByKey.get(key) ?? (Array.isArray(record.review_codes) ? record.review_codes.map(String) : []),
      raw: {
        detail: cellString(original.H),
        receiptNo: cellString(original.B),
        channel: cellString(original.D),
        villageRaw: cellString(original.F),
        statusRaw: cellString(original.J),
        note: cellString(original.K),
        submitterName: cellString(original.E),
        responsibleRaw: cellString(original.I),
      },
    });
  }
  return { manifest: manifestInfo, rows };
}

export interface Resolution {
  statusByKey: Record<string, string>;
  dateByKey: Record<string, string>;
  categoryByKey: Record<string, string>;
}

/** code ที่ operator แก้ได้ผ่าน flag — นอกนี้ค้าง blocked สถานเดียว */
const RESOLVABLE_CODES = new Set(['received_date_unresolved', 'status_unresolved', 'category_unresolved']);
/** code ที่ dry-run ตรวจกับ live DB (map + ชื่อ) — classify ระดับ staging ไม่ตัดสิน */
const VERIFIABLE_CODES = new Set(['responsible_mapping_unresolved', 'submitter_identity_unresolved']);

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export interface ClassifiedRow {
  row: StagedRow;
  importable: boolean;
  /** codes ที่ยังค้างหลังหัก overrides — รายงานด้วย key/row เท่านั้น */
  blockingCodes: string[];
  statusFinal: CaseStatus | null;
  dateFinal: string | null;
  categorySlugFinal: string | null;
}

export function classifyRows(bundle: StagedBundle, resolution: Resolution): ClassifiedRow[] {
  return bundle.rows.map((row) => {
    const remaining = row.reviewCodes.filter((code) => {
      if (code === 'duplicate_receipt_preserved') return false;
      if (VERIFIABLE_CODES.has(code)) return false;
      if (code === 'received_date_unresolved' && resolution.dateByKey[row.sourceKey]) return false;
      if (code === 'status_unresolved' && resolution.statusByKey[row.sourceKey]) return false;
      if (code === 'category_unresolved' && resolution.categoryByKey[row.sourceKey]) return false;
      return true;
    });
    // § code แปลกที่นอกเหนือจากที่รู้จักถือว่า block — ไม่เดาว่าปลอดภัย
    const unknown = remaining.filter((code) => !RESOLVABLE_CODES.has(code));

    let statusFinal: CaseStatus | null = null;
    if (row.statusValue && isCaseStatus(row.statusValue)) {
      statusFinal = row.statusValue;
    } else {
      const overrideStatus = resolution.statusByKey[row.sourceKey];
      if (overrideStatus && isCaseStatus(overrideStatus)) statusFinal = overrideStatus;
    }

    let dateFinal = row.receivedDate;
    const overrideDate = resolution.dateByKey[row.sourceKey];
    if (!dateFinal && overrideDate && isRealDate(overrideDate)) dateFinal = overrideDate;

    const categorySlugFinal = resolution.categoryByKey[row.sourceKey] ?? row.categorySlug;

    const blockingCodes = [...remaining];
    if (!statusFinal && !blockingCodes.includes('status_unresolved')) blockingCodes.push('status_unresolved');
    if (!dateFinal && !blockingCodes.includes('received_date_unresolved')) blockingCodes.push('received_date_unresolved');
    if (!categorySlugFinal && !blockingCodes.includes('category_unresolved')) blockingCodes.push('category_unresolved');

    return {
      row,
      importable: blockingCodes.length === 0 && unknown.length === 0,
      blockingCodes,
      statusFinal,
      dateFinal,
      categorySlugFinal,
    };
  });
}

export interface CaseMapping {
  title: string;
  description: string;
  actionDetails: string | null;
  location: string;
  village: string | null;
  legacySubmitterName: string;
}

/** แปลงเซลล์ดิบเป็น field ของ cases — ไม่แตะ DB จึง test ได้ล้วน */
export function buildCaseMapping(raw: {
  detail: string;
  receiptNo: string;
  channel: string;
  villageRaw: string;
  statusRaw: string;
  note: string;
  dateFinal: string;
  sourceSha256: string;
}): CaseMapping {
  const detail = raw.detail.trim();
  const villageRaw = raw.villageRaw.trim();
  const note = raw.note.trim();
  // § หมายเหตุอยู่บ้านใหม่ของตัวเอง (action_details) ไม่ซ้ำใน description อีก
  const lines = [detail];
  lines.push(
    `เลขที่รับ: ${raw.receiptNo.trim() || '-'} | ช่องทาง: ${raw.channel.trim() || '-'} | สถานะต้นฉบับ: ${raw.statusRaw.trim() || '-'} | วันที่รับ: ${raw.dateFinal} | แหล่ง: excel-legacy (${raw.sourceSha256.slice(0, 12)})`,
  );
  return {
    title: detail || `เรื่องร้องเรียนเลขที่ ${raw.receiptNo.trim() || '-'}`,
    description: lines.filter(Boolean).join('\n'),
    actionDetails: note || null,
    location: villageRaw || 'ไม่ระบุ',
    village: villageRaw || null,
    legacySubmitterName: '',
  };
}

export interface DryRunReport {
  records: number;
  importable: number;
  blocked: number;
  skipped: number;
  dbReady: 0;
  batchExists: boolean;
  blocks: { sourceKey: string; row: number; codes: string[] }[];
}

/** dry-run อ่านอย่างเดียว — ไม่เขียน DB ทุกกรณี */
export async function dryRun(bundle: StagedBundle, classified: ClassifiedRow[]): Promise<DryRunReport> {
  const db = await getDb();
  const existingBatch = await firstOrUndefined(
    db.select({ id: importBatches.id }).from(importBatches).where(inArray(importBatches.sourceSha256, [bundle.manifest.sourceSha256])).limit(1),
  );

  const importable = classified.filter((c) => c.importable);
  const existingKeys = importable.length
    ? await db
        .select({ sourceKey: cases.sourceKey })
        .from(cases)
        .where(inArray(cases.sourceKey, importable.map((c) => c.row.sourceKey)))
    : [];
  const existingSet = new Set(existingKeys.map((r) => r.sourceKey));

  // § ตรวจ live master: category slug/id ยัง active, department ใน map มีจริง
  const slugs = [...new Set(importable.map((c) => c.categorySlugFinal).filter((s): s is string => Boolean(s)))];
  const liveCategories = slugs.length
    ? await db.select({ slug: categories.slug, id: categories.id, isActive: categories.isActive }).from(categories).where(inArray(categories.slug, slugs))
    : [];
  const liveBySlug = new Map(liveCategories.map((c) => [c.slug, c]));
  const mapRows = await db.select().from(legacyResponsibleMap);
  const mapByRaw = new Map(mapRows.map((m) => [m.raw, m]));
  const deptIds = [...new Set(mapRows.map((m) => m.departmentId).filter((d): d is string => Boolean(d)))];
  const liveDepts = deptIds.length
    ? await db.select({ id: departments.id }).from(departments).where(inArray(departments.id, deptIds))
    : [];
  const liveDeptSet = new Set(liveDepts.map((d) => d.id));

  let blocked = 0;
  const blocks: DryRunReport['blocks'] = [];
  for (const c of classified) {
    const extra: string[] = [];
    if (c.importable) {
      const live = c.categorySlugFinal ? liveBySlug.get(c.categorySlugFinal) : undefined;
      // § row.categoryId จาก master snapshot วันเตรียม — ต้องตรงกับ live slug และ active
      if (!live || !live.isActive) extra.push('category_unresolved');
      // § ผู้รับผิดชอบยึดค่าดิบจาก Excel เป็นหลัก (นโยบาย: ใช้ตามทะเบียน ถ้าผิดแก้ทีหลัง)
      // map ต้องมีอยู่ + active; department ว่างได้ (ค่อยผูกหน่วยงานทีหลังผ่าน settings)
      // แต่ถ้าระบุ department มาแล้วต้องมีจริงใน live DB
      const mapEntry = mapByRaw.get(c.row.raw.responsibleRaw.trim());
      if (!mapEntry || !mapEntry.isActive || (mapEntry.departmentId && !liveDeptSet.has(mapEntry.departmentId))) {
        extra.push('responsible_mapping_unresolved');
      }
      // § ชื่อผู้แจ้งว่าง = สร้างตัวตนไม่ได้ (ห้ามเดาชื่อ)
      if (!c.row.raw.submitterName.trim()) extra.push('submitter_identity_unresolved');
    }
    const codes = [...c.blockingCodes, ...extra];
    if (codes.length) {
      blocked += 1;
      blocks.push({ sourceKey: c.row.sourceKey, row: c.row.rowNumber, codes });
    }
  }

  return {
    records: classified.length,
    importable: classified.length - blocked,
    blocked,
    skipped: importable.filter((c) => existingSet.has(c.row.sourceKey)).length,
    dbReady: 0,
    batchExists: Boolean(existingBatch),
    blocks,
  };
}

export interface ApplyOptions {
  bundle: StagedBundle;
  classified: ClassifiedRow[];
  operatorUserId: string;
  sourceName: string;
}

/** apply เขียนจริง — caller ตรวจ report.blocked === 0 และ batchExists === false มาก่อน */
export async function applyImport(options: ApplyOptions): Promise<{ batchId: string; imported: number; skipped: number }> {
  const { bundle, classified, operatorUserId, sourceName } = options;
  const db = await getDb();

  return db.transaction(async (tx) => {
    const dupBatch = await firstOrUndefined(
      tx.select({ id: importBatches.id }).from(importBatches).where(inArray(importBatches.sourceSha256, [bundle.manifest.sourceSha256])).limit(1),
    );
    if (dupBatch) throw new ImportError('workbook นี้ถูกนำเข้าแล้ว (import_batches ซ้ำ)');

    const importable = classified.filter((c) => c.importable);
    const existingKeys = importable.length
      ? new Set(
          (await tx.select({ sourceKey: cases.sourceKey }).from(cases).where(inArray(cases.sourceKey, importable.map((c) => c.row.sourceKey)))).map(
            (r) => r.sourceKey,
          ),
        )
      : new Set<string>();

    const liveCategories = await tx.select().from(categories);
    const liveBySlug = new Map(liveCategories.map((c) => [c.slug, c]));
    const mapRows = await tx.select().from(legacyResponsibleMap);
    const mapByRaw = new Map(mapRows.map((m) => [m.raw, m]));
    // § กัน department หายระหว่าง dry-run กับ apply — เขียน departmentId ลอยไม่ได้
    const liveDeptIds = new Set((await tx.select({ id: departments.id }).from(departments)).map((d) => d.id));

    const batchId = generateId();
    await tx.insert(importBatches).values({
      id: batchId,
      sourceSha256: bundle.manifest.sourceSha256,
      fileName: sourceName,
      rowCount: classified.length,
      operatorUserId,
      notes: JSON.stringify({ masterSha256: bundle.manifest.masterSha256 }),
    });

    let imported = 0;
    let skipped = 0;
    for (const c of importable) {
      if (existingKeys.has(c.row.sourceKey)) {
        skipped += 1;
        continue;
      }
      const raw = c.row.raw;
      const live = c.categorySlugFinal ? liveBySlug.get(c.categorySlugFinal) : undefined;
      if (!live || !live.isActive || !c.statusFinal || !c.dateFinal) {
        throw new ImportError('แถวไม่ผ่าน gate สุดท้ายก่อนเขียน');
      }
      const mapEntry = mapByRaw.get(raw.responsibleRaw.trim());
      // § ปฏิเสธ map ที่ยังไม่ตัดสิน (inactive / ยังไม่ระบุหน่วยงาน) — คู่กับ dry-run ข้างบน
      if (!mapEntry || !mapEntry.isActive) throw new ImportError('แถวไม่มี responsible map ที่ใช้งานได้');
      if (!mapEntry.departmentId || !liveDeptIds.has(mapEntry.departmentId)) {
        throw new ImportError('แถวนี้ยังไม่มีการตัดสินหน่วยงานรับผิดชอบ');
      }
      const submitterName = normalizeLegacyName(raw.submitterName);
      if (!submitterName) throw new ImportError('แถวไม่มีชื่อผู้แจ้ง');

      const mapping = buildCaseMapping({ ...raw, dateFinal: c.dateFinal, sourceSha256: bundle.manifest.sourceSha256 });
      // § resolveCitizen ใน tx เดียวกัน — ชน unique(email) ใช้แถวผู้ชนะ (ดู identity.ts)
      const submitterId = await resolveCitizen({ kind: 'legacy', name: submitterName }, tx);

      const caseId = generateId();
      const evidenceDate = new Date(`${c.dateFinal}T00:00:00Z`);
      // § ปีงบ UTC ตรงไม่พึ่ง TZ เครื่อง (ตค–ธค → ปีถัดไป, +543 เป็น พ.ศ.)
      const fiscalYearBe =
        evidenceDate.getUTCMonth() >= 9 ? evidenceDate.getUTCFullYear() + 544 : evidenceDate.getUTCFullYear() + 543;
      await tx.insert(cases).values({
        id: caseId,
        status: c.statusFinal,
        // § สถานะเงินแยกจากขั้นตอนงาน — รออนุมัติงบเท่านั้นที่รองบ ที่เหลือไม่ระบุ
        budgetStatus: c.statusFinal === 'awaiting_budget' ? 'awaiting_budget' : 'unspecified',
        title: mapping.title,
        description: mapping.description,
        actionDetails: mapping.actionDetails,
        budgetAmount: null,
        location: mapping.location,
        village: mapping.village,
        categoryId: live.id,
        submittedBy: submitterId,
        departmentId: mapEntry.departmentId,
        assignedTo: mapEntry.assignedTo,
        dueDate: null,
        closedAt: null,
        trackingCode: null,
        sourceKey: c.row.sourceKey,
        importBatchId: batchId,
        legacySubmitterName: submitterName,
        legacyResponsibleRaw: raw.responsibleRaw.trim() || null,
        isHistorical: true,
        createdAt: evidenceDate,
        updatedAt: evidenceDate,
        metadata: JSON.stringify({ source: 'legacy_import', batchId, fiscalYearBe }),
      });
      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: operatorUserId,
        updateType: 'comment',
        comment: 'นำเข้าจากทะเบียน Excel ย้อนหลัง',
        isPublic: false,
      });
      await logAudit(
        {
          userId: operatorUserId,
          action: AUDIT_ACTIONS.IMPORT_CASE,
          resource: 'cases',
          resourceId: caseId,
          metadata: { batchId, sourceKey: c.row.sourceKey, channel: 'legacy_import' },
        },
        tx,
      );
      imported += 1;
    }

    await tx
      .update(importBatches)
      .set({ importedCount: imported, skippedCount: skipped })
      .where(inArray(importBatches.id, [batchId]));

    return { batchId, imported, skipped };
  });
}
