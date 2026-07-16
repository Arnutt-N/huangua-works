/**
 * Thai Citizen ID (CID) Utilities — บัตรประชาชน 13 หลัก
 * Format: X-XXXX-XXXXX-XX-C (13 digits, last digit = checksum)
 * Checksum algorithm: MOD 11 (ตามมาตรฐานกรมการปกครอง)
 */

/**
 * ตรวจสอบ checksum บัตรประชาชน 13 หลัก (MOD 11)
 * @param cid - เลขบัตรประชาชน 13 หลัก (string)
 * @returns true ถ้า checksum ถูกต้อง
 */
export function validateCidChecksum(cid: string): boolean {
  // Remove non-digit characters
  const digits = cid.replace(/\D/g, '');

  if (digits.length !== 13) {
    return false;
  }

  // MOD 11 algorithm
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]!, 10) * (13 - i);
  }

  const checksum = (11 - (sum % 11)) % 10;
  const lastDigit = parseInt(digits[12]!, 10);

  return checksum === lastDigit;
}

/**
 * Format CID เป็น X-XXXX-XXXXX-XX-C
 */
export function formatCid(cid: string): string {
  const digits = cid.replace(/\D/g, '');

  if (digits.length !== 13) {
    return cid; // return as-is ถ้าไม่ใช่ 13 หลัก
  }

  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12, 13)}`;
}

/**
 * Sanitize CID (เก็บแค่ตัวเลข 13 หลัก)
 */
export function sanitizeCid(cid: string): string {
  return cid.replace(/\D/g, '').slice(0, 13);
}

/**
 * ตรวจสอบ CID ว่าถูกต้องหรือไม่ (length + checksum)
 * รับ unknown เพราะเรียกกับ input ที่ยังไม่ validate (เช่น JSON body ที่ไม่มี field cid)
 */
export function isValidCid(cid: unknown): boolean {
  if (typeof cid !== 'string') {
    return false;
  }

  const sanitized = sanitizeCid(cid);
  return sanitized.length === 13 && validateCidChecksum(sanitized);
}
