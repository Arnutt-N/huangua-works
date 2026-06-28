import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import '../styles/tokens.css';

/**
 * Noto Sans Thai — self-host ผ่าน next/font/google (ดาวน์โหลดครั้งเดียวตอน build
 * แล้วให้บริการจาก origin เรา ไม่ผ่าน Google CDN ตอน runtime → สอดคล้อง H10)
 * สร้างตัวแปร --font-noto ให้ tokens.css อ้างอิง
 */
const noto = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: 'อบต.หัวงัว — แจ้งเรื่องร้องเรียก/ร้องทุกข์',
    template: '%s · อบต.หัวงัว',
  },
  description:
    'ระบบรับเรื่องร้องเรียก/ร้องทุกข์ องค์การบริหารส่วนตำบลหัวงัว (อ.ยางตลาด จ.กาฬสินธุ์) — แจ้งเรื่องได้ ติดตามได้ ตรวจสอบได้',
  applicationName: 'อบต.หัวงัว Citizen Help',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfcfe' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1d33' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" data-theme="light" className={noto.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}