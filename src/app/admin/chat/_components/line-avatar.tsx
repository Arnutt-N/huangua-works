'use client';

import { useState } from 'react';

/**
 * LineAvatar — รูปโปรไฟล์ LINE พร้อม fallback
 *
 * § ทำไมไม่ใช้ <img> ตรงๆ: รูปจาก LINE CDN (sprofile.line-scdn.net) อาจโหลดไม่ขึ้น
 * เมื่อ browser ส่ง Referer header (CDN ปฏิเสธ) หรือ URL หมดอายุหลังผู้ใช้เปลี่ยนรูป
 * → เห็นเป็นไอคอนรูปแตก/กรอบว่าง ("แสดงไม่สมบูรณ์")
 * แก้โดยส่ง referrerPolicy="no-referrer" และถ้า onError ให้ render fallback แทน
 */
export function LineAvatar({
  src,
  className,
  fallback,
}: {
  src: string | null | undefined;
  className: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // รูปเปลี่ยน (สลับห้อง) → ลองโหลดใหม่ (adjust-state-during-render ตาม react.dev)
  if (src !== prevSrc) {
    setPrevSrc(src);
    setFailed(false);
  }

  if (!src || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์ LINE เป็น external URL ไม่ fix โดเมน
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
