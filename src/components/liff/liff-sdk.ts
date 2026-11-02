/**
 * โหลด LIFF SDK จาก CDN แบบ singleton + type ขั้นต่ำที่เราใช้
 *
 * แยกเป็นโมดูลแยกจาก liff-provider เพื่อให้ liff-state-redirect (หน้าแรก)
 * ใช้ร่วมได้โดยไม่ต้องดึงทั้ง provider component เข้า bundle ของหน้าแรก
 */

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
const SDK_LOAD_TIMEOUT_MS = 5_000;

export interface LiffSdk {
  init(config: { liffId: string }): Promise<void>;
  isInClient(): boolean;
  isLoggedIn(): boolean;
  login(): void;
  getIDToken(): string | null;
  getProfile(): Promise<{ displayName?: string; pictureUrl?: string }>;
  closeWindow?: () => void;
}

declare global {
  interface Window {
    liff?: LiffSdk;
  }
}

export function loadLiffSdk(timeoutMs = SDK_LOAD_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.liff) return resolve();

    let timer: NodeJS.Timeout | null = null;
    let finished = false;

    const cleanup = () => {
      finished = true;
      if (timer) clearTimeout(timer);
    };

    const onLoad = () => {
      if (finished) return;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (finished) return;
      cleanup();
      reject(new Error('LIFF SDK load failed'));
    };

    timer = setTimeout(() => {
      if (finished) return;
      cleanup();
      reject(new Error('LIFF SDK load timed out'));
    }, timeoutMs);

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });
}
