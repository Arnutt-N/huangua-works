'use client';

import type { ReplyObjectType } from '@/lib/line/reply-object-validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** สรุป payload 1 บรรทัดสำหรับ card — ไม่ render flex เต็ม (หนัก, เสี่ยง crash กับ draft) */
export function payloadSummary(objectType: string, payload: Record<string, unknown>): string {
  if (objectType === 'text' || objectType === 'text_v2') {
    const text = payload.text;
    return typeof text === 'string' && text.length > 0 ? text.slice(0, 80) : '—';
  }
  if (objectType === 'image' || objectType === 'video' || objectType === 'audio') {
    const url = payload.url;
    return typeof url === 'string' ? url.slice(0, 60) : '—';
  }
  if (objectType === 'sticker') {
    return `package ${String(payload.packageId ?? '?')} / sticker ${String(payload.stickerId ?? '?')}`;
  }
  if (objectType === 'location') {
    return String(payload.title ?? payload.address ?? '—').slice(0, 80);
  }
  if (objectType === 'imagemap') {
    const actions = payload.actions;
    return Array.isArray(actions) ? `${actions.length} actions` : '—';
  }
  const altText = (payload as { altText?: unknown }).altText;
  if (typeof altText === 'string' && altText.length > 0) return altText.slice(0, 80);
  const keys = Object.keys(payload).filter((k) => k !== 'quickReply');
  return keys.length > 0 ? keys.slice(0, 4).join(', ') : '—';
}

export function hasQuickReply(payload: Record<string, unknown>): boolean {
  const qr = payload.quickReply;
  if (!isRecord(qr)) return false;
  return Array.isArray(qr.items) && qr.items.length > 0;
}

export function typeBadgeClass(objectType: string): string {
  switch (objectType as ReplyObjectType) {
    case 'flex':
    case 'template':
    case 'imagemap':
      return 'bg-accent-sunken text-accent-strong';
    case 'image':
    case 'video':
      return 'bg-success/10 text-success';
    case 'sticker':
      return 'bg-warning-soft text-warning-ink';
    default:
      return 'bg-surface-sunken text-muted';
  }
}
