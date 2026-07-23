import type { LineOutgoingMessage } from '../types';

export function caseStatusFlex(trackingCode: string, status: string, title: string): LineOutgoingMessage {
  const statusLabels: Record<string, string> = {
    received: 'รับเรื่องแล้ว',
    reviewing: 'กำลังตรวจสอบ',
    assigned: 'มอบหมายแล้ว',
    in_progress: 'กำลังดำเนินการ',
    done: 'ดำเนินการเสร็จ',
    closed: 'ปิดเรื่อง',
    rejected: 'ไม่รับเรื่อง',
  };

  const statusColors: Record<string, string> = {
    received: '#4A90D9',
    reviewing: '#F5A623',
    assigned: '#7B68EE',
    in_progress: '#F5A623',
    done: '#7ED321',
    closed: '#9B9B9B',
    rejected: '#D0021B',
  };

  return {
    type: 'flex',
    altText: `สถานะเรื่อง ${trackingCode}: ${statusLabels[status] ?? status}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'สถานะเรื่องร้องเรียน', color: '#FFFFFF', size: 'sm' },
          { type: 'text', text: trackingCode, color: '#FFFFFF', size: 'lg', weight: 'bold' },
        ],
        backgroundColor: statusColors[status] ?? '#4A90D9',
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
              { type: 'text', text: statusLabels[status] ?? status, size: 'sm', align: 'end', weight: 'bold' },
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
