/**
 * โหลด LIFF SDK จาก CDN แบบ singleton + type ขั้นต่ำที่เราใช้
 *
 * แยกเป็นโมดูลแยกจาก liff-provider เพื่อให้ liff-state-redirect (หน้าแรก)
 * ใช้ร่วมได้โดยไม่ต้องดึงทั้ง provider component เข้า bundle ของหน้าแรก
 */

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

export interface LiffSdk {
  init(config: { liffId: string }): Promise<void>;
  isInClient(): boolean;
  isLoggedIn(): boolean;
  login(): void;
  getIDToken(): string | null;
  getProfile(): Promise<{ displayName?: string; pictureUrl?: string }>;
}

declare global {
  interface Window {
    liff?: LiffSdk;
  }
}

export function loadLiffSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.liff) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('LIFF SDK load failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('LIFF SDK load failed')));
    document.head.appendChild(script);
  });
}
