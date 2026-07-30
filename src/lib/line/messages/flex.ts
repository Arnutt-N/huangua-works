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
          { type: 'text', text: 'สถานะเรื่องร้องเรียน', color: '#FFFFFF', size: 'sm' },
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
            type: 'button',
            action: { type: 'message', label: 'สอบถามเพิ่มเติม', text: 'สอบถามเพิ่มเติม' },
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
    altText: 'เลือกหมวดหมู่เรื่องร้องเรียน',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'แจ้งเรื่องร้องเรียน', color: '#FFFFFF', weight: 'bold' },
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
