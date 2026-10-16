import { CredentialsSignin } from 'next-auth';
import type { LoginDenialReason } from './roles';

/**
 * § authorize() throw ตัวนี้เมื่อรหัสผ่านถูกแต่บัญชีไม่มีสิทธิ์ staff (citizen / ระงับ)
 * ไม่ออก JWT ให้ แต่ส่ง "เหตุผล" ถึง login action ให้แสดงข้อความเจาะจง + audit ACCESS_DENIED
 * ไม่ใช่ enumeration oracle: ถึงจุดนี้รหัสผ่านถูกพิสูจน์แล้ว
 * code ไปโผล่ใน URL ได้เฉพาะ HTTP callback ซึ่งถูกบล็อกใน src/app/api/auth/[...nextauth]/route.ts
 */
export class IneligibleAccountSignin extends CredentialsSignin {
  readonly reason: LoginDenialReason;
  readonly userId: string;

  constructor(reason: LoginDenialReason, userId: string) {
    super();
    this.reason = reason;
    this.userId = userId;
    this.code = reason;
  }
}
