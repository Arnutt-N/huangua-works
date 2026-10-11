import {
  STATUS_LABELS_TH_CITIZEN,
  isCaseStatus,
  type CaseStatus,
} from '../../cases/state-machine';
import type { LineOutgoingMessage } from '../types';

const STATUS_COLORS: Record<CaseStatus, string> = {
  pending: '#9B9B9B',
  received: '#4A90D9',
  reviewing: '#F5A623',
  awaiting_budget: '#F5A623',
  assigned: '#7B68EE',
  in_progress: '#F5A623',
  done: '#7ED321',
  closed: '#9B9B9B',
  rejected: '#D0021B',
};

export function caseStatusFlex(trackingCode: string, status: string, title: string): LineOutgoingMessage {
  const label = isCaseStatus(status) ? STATUS_LABELS_TH_CITIZEN[status] : status;
  const headerColor = isCaseStatus(status) ? STATUS_COLORS[status] : '#4A90D9';

  return {
    type: 'flex',
    altText: `สถานะเรื่อง ${trackingCode}: ${label}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'สถานะเรื่อง', color: '#FFFFFF', size: 'sm' },
          { type: 'text', text: trackingCode, color: '#FFFFFF', size: 'lg', weight: 'bold' },
        ],
        backgroundColor: headerColor,
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: title, wrap: true, size: 'md', weight: 'bold' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'สถานะ', size: 'sm', color: '#9B9B9B' },
              { type: 'text', text: label, size: 'sm', align: 'end', weight: 'bold' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            // § เดิม label "สอบถามเพิ่มเติม" ส่งข้อความที่ engine ไม่มี handler →
            // ตก fallback "ไม่เข้าใจคำถาม" (audit พบ) เปลี่ยนเป็น "ติดต่อเจ้าหน้าที่"
            // ซึ่งเป็น handoff keyword ที่ engine จัดการอยู่แล้ว
            type: 'button',
            action: { type: 'message', label: 'ติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
            style: 'secondary',
          },
        ],
      },
    },
  };
}

export function faqMenuFlex(categories: { label: string; value: string }[]): LineOutgoingMessage {
  return {
    type: 'flex',
    altText: 'เลือกหมวดหมู่เรื่องที่แจ้ง',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'แจ้งเรื่องใหม่', color: '#FFFFFF', weight: 'bold' },
        ],
        backgroundColor: '#4A90D9',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: categories.map((cat) => ({
          type: 'button' as const,
          action: { type: 'message' as const, label: cat.label, text: cat.label },
          style: 'secondary' as const,
          height: 'sm' as const,
        })),
      },
    },
  };
}

export function handoffNotifyFlex(): LineOutgoingMessage {
  return {
    type: 'flex',
    altText: 'กำลังเชื่อมต่อเจ้าหน้าที่',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🙋 กำลังเชื่อมต่อเจ้าหน้าที่', weight: 'bold', size: 'md' },
          { type: 'text', text: 'กรุณารอสักครู่ เจ้าหน้าที่จะตอบกลับโดยเร็วที่สุด', wrap: true, size: 'sm', color: '#9B9B9B', margin: 'md' },
        ],
      },
    },
  };
}

// ─── ยืนยันเรื่อง (confirm bubble + ปุ่มแก้รายช่อง) ─────────────────────────

/** ช่องที่แก้จาก bubble ยืนยันได้ — ตรงกับ step ของ case-flow ทีละตัว */
export type ConfirmEditableField = 'category' | 'title' | 'description' | 'location';

/**
 * § postback protocol ของ bubble ยืนยัน — union ปิด (ไม่มี prefix match กว้างๆ)
 * engine แยก confirm:* ออกจาก postback อื่นด้วย parseConfirmPostback เท่านั้น
 */
export type CaseConfirmPostbackData =
  | 'confirm:ok'
  | 'confirm:cancel'
  | 'confirm:edit:category'
  | 'confirm:edit:title'
  | 'confirm:edit:description'
  | 'confirm:edit:location';

const CONFIRM_POSTBACKS: ReadonlySet<string> = new Set<string>([
  'confirm:ok',
  'confirm:cancel',
  'confirm:edit:category',
  'confirm:edit:title',
  'confirm:edit:description',
  'confirm:edit:location',
]);

/** แยก postback ดิบที่ข้าม boundary (webhook) เข้ามา — ไม่ใช่สมาชิก union คืน null */
export function parseConfirmPostback(data: string): CaseConfirmPostbackData | null {
  if (!CONFIRM_POSTBACKS.has(data)) return null;
  return data as CaseConfirmPostbackData;
}

export interface CaseConfirmSummary {
  categoryName: string;
  title: string;
  description: string;
  location: string;
}

const CONFIRM_FIELD_ROWS: ReadonlyArray<{ field: ConfirmEditableField; label: string; key: keyof CaseConfirmSummary }> = [
  { field: 'category', label: 'หมวดหมู่', key: 'categoryName' },
  { field: 'title', label: 'หัวข้อ', key: 'title' },
  { field: 'description', label: 'รายละเอียด', key: 'description' },
  { field: 'location', label: 'สถานที่', key: 'location' },
];

/**
 * bubble สรุปก่อนส่งเรื่อง — 4 แถวช่อง + ปุ่มแก้ไขรายช่อง (postback) + ยืนยัน/ยกเลิก
 *
 * § consentNotice ต้องเป็น BOT_CONSENT_NOTICE จาก case-flow (ส่งเข้ามาเป็น param
 * แทน import ตรงเพื่อเลี่ยง import cycle flex ↔ case-flow) — ข้อความนี้อยู่ในทั้ง
 * body และ altText เพราะ createCase บันทึก consent via line_bot_submit ทันทีที่ยืนยัน
 */
export function caseConfirmFlex(summary: CaseConfirmSummary, consentNotice: string): LineOutgoingMessage {
  const altText =
    `📋 สรุปเรื่องที่แจ้ง:\n\nหมวดหมู่: ${summary.categoryName}\nหัวข้อ: ${summary.title}\nรายละเอียด: ${summary.description}\nสถานที่: ${summary.location}\n\n${consentNotice}\n\nกดปุ่ม "ยืนยัน" เพื่อส่งเรื่อง หรือพิมพ์ "ยืนยัน" / "ยกเลิก" ได้เช่นกัน`;

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📋 สรุปเรื่องที่แจ้ง', color: '#FFFFFF', weight: 'bold' },
        ],
        backgroundColor: '#4A90D9',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          ...CONFIRM_FIELD_ROWS.map((row) => ({
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 4,
                contents: [
                  { type: 'text', text: row.label, size: 'sm', color: '#9B9B9B' },
                  { type: 'text', text: summary[row.key], wrap: true, size: 'md' },
                ],
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: `แก้${row.label}`,
                  data: `confirm:edit:${row.field}`,
                  displayText: `แก้${row.label}`,
                },
                style: 'secondary',
                height: 'sm',
                flex: 1,
              },
            ],
          })),
          { type: 'separator', margin: 'md' },
          { type: 'text', text: consentNotice, wrap: true, size: 'xs', color: '#9B9B9B', margin: 'md' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'ยืนยันส่งเรื่อง',
              data: 'confirm:ok',
              displayText: 'ยืนยัน',
            },
            style: 'primary',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'ยกเลิก',
              data: 'confirm:cancel',
              displayText: 'ยกเลิก',
            },
            style: 'secondary',
          },
        ],
      },
    },
  };
}
