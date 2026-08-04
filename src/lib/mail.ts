import nodemailer from 'nodemailer';

/**
 * Mail sender — nodemailer + SMTP
 *
 * Works with any SMTP provider (Resend SMTP, Gmail, govt mail server).
 * Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
 *
 * Dev fallback: set MAIL_CONSOLE=true to log emails to the console instead of
 * sending (no SMTP required locally). Production must configure real SMTP.
 */

const MAIL_FROM = process.env.MAIL_FROM || 'อบต.หัวงัว <no-reply@huangua.go.th>';

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.MAIL_CONSOLE === 'true') {
    console.warn(`[mail:console] to=${to} subject=${subject}\n${html}`);
    return;
  }

  const transport = getTransport();
  if (!transport) {
    // ไม่มี SMTP — ไม่ throw (กัน enumeration: caller ต้องคืน message เดียวกันเสมอ)
    // แต่ log ให้ operator รู้ว่าอีเมลไม่ถูกส่งจริง
    console.warn('[mail] SMTP not configured — email NOT sent', { to, subject });
    return;
  }

  await transport.sendMail({ from: MAIL_FROM, to, subject, html });
}

/**
 * อีเมลรีเซ็ตรหัสผ่าน — template ภาษาไทย
 * @param resetUrl ลิงก์เต็ม (รวม token) ไปหน้า /admin/reset-password
 */
export function buildResetEmailHtml(userName: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"></head>
<body style="font-family:'Noto Sans Thai',sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 16px;">รีเซ็ตรหัสผ่าน</h1>
    <p style="font-size:15px;color:#444;line-height:1.7;">
      สวัสดีคุณ${userName}<br>
      เราได้รับคำขอรีเซ็ตรหัสผ่านบัญชีเจ้าหน้าที่ของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#0049a1;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:8px;">
        ตั้งรหัสผ่านใหม่
      </a>
    </p>
    <p style="font-size:13px;color:#888;line-height:1.7;">
      ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุภายใน 1 ชั่วโมง<br>
      หากคุณไม่ได้เป็นผู้ร้องขอ สามารถเพิกเฉยอีเมลฉบับนี้ได้
    </p>
  </div>
</body>
</html>`;
}
