export const MODE_LABELS: Record<string, string> = {
  bot_active: 'Bot ตอบอัตโนมัติ',
  waiting_handoff: 'รอเจ้าหน้าที่',
  human_active: 'เจ้าหน้าที่ตอบ',
  resolved: 'ปิดเรื่อง',
};

/** ป้ายสั้นสำหรับแถวใน sidebar (MODE_LABELS ยาวเกินพื้นที่ pill ในแถว) */
export const MODE_SHORT: Record<string, string> = {
  bot_active: 'Bot',
  waiting_handoff: 'รอคน',
  human_active: 'เจ้าหน้าที่',
  resolved: 'ปิดแล้ว',
};

/**
 * § สีโหมดสนทนา — ใช้ design token เท่านั้น
 * แมป: น้ำเงิน = ระบบ/บอท, amber = รอคน, success = คนกำลังคุย, muted = ปิดแล้ว
 */
export const MODE_BADGE: Record<string, string> = {
  bot_active: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  waiting_handoff: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  human_active: 'bg-success-soft text-success-ink ring-success-ink/20',
  resolved: 'bg-surface-sunken text-muted ring-border-strong/30',
};

export const FALLBACK_BADGE = 'bg-surface-sunken text-muted ring-border-strong/30';

/** สีป้าย tag — key ต้องตรงกับ TAG_COLORS ใน validation (token variants เท่านั้น) */
export const TAG_BADGE: Record<string, string> = {
  accent: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  gold: 'bg-accent-gold-soft text-warning-ink ring-warning-ink/20',
  success: 'bg-success-soft text-success-ink ring-success-ink/20',
  warning: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  danger: 'bg-danger-soft text-danger ring-danger/20',
  muted: 'bg-surface-sunken text-muted ring-border-strong/30',
};
