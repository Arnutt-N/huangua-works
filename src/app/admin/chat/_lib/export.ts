import type { Message } from './types';

const SENDER_LABEL: Record<string, string> = {
  user: 'ผู้ใช้',
  admin: 'เจ้าหน้าที่',
  bot: 'บอท',
  system: 'ระบบ',
};

function csvCell(value: string): string {
  // § กัน CSV injection — ข้อความจากผู้ใช้ที่ขึ้นต้นด้วยสูตร Excel ต้องถูกทำให้เป็น text
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // § RFC 4180 — ครอบด้วย " และซ้ำ " ที่อยู่ข้างใน
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function messagesToCsv(messages: Message[]): string {
  const header = ['เวลา', 'ผู้ส่ง', 'ประเภท', 'ข้อความ'];
  const rows = messages.map((m) => [
    m.createdAt,
    SENDER_LABEL[m.sender] ?? m.sender,
    m.messageType,
    m.textContent ?? (m.messageType === 'text' ? '' : `[${m.messageType}]`),
  ]);
  // BOM ให้ Excel อ่านไทยถูก
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function printConversation(
  title: string,
  messages: Message[],
): boolean {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return false;
  const rows = messages
    .map(
      (m) =>
        `<tr><td class="t">${escapeHtml(new Date(m.createdAt).toLocaleString('th-TH'))}</td>` +
        `<td>${escapeHtml(SENDER_LABEL[m.sender] ?? m.sender)}</td>` +
        `<td>${escapeHtml(m.textContent ?? `[${m.messageType}]`)}</td></tr>`,
    )
    .join('');
  win.document.write(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      '<style>body{font-family:"Sarabun",sans-serif;padding:24px;color:#111}' +
      'h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}' +
      'th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}' +
      'td.t{white-space:nowrap;color:#555}</style></head><body>' +
      `<h1>${escapeHtml(title)}</h1><table><thead><tr><th>เวลา</th><th>ผู้ส่ง</th><th>ข้อความ</th></tr></thead>` +
      `<tbody>${rows}</tbody></table></body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
  return true;
}
