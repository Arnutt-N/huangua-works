import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
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

const baseUrl = process.env.AUTH_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'อบต.หัวงัว — แจ้งเหตุ/ติดตามงานบริการสาธารณูปโภค',
    template: '%s · อบต.หัวงัว',
  },
  description:
    'ระบบแจ้งเหตุ/ติดตามงานบริการสาธารณูปโภค องค์การบริหารส่วนตำบลหัวงัว (อ.ยางตลาด จ.กาฬสินธุ์) — แจ้งเรื่องได้ ติดตามได้ ตรวจสอบได้',
  applicationName: 'อบต.หัวงัว Citizen Help',
  keywords: [
    'อบต.หัวงัว',
    'แจ้งเหตุ',
    'ติดตามงาน',
    'บริการสาธารณูปโภค',
    'ยางตลาด',
    'กาฬสินธุ์',
    'ร้องเรียก',
    'ร้องทุกข์',
  ],
  authors: [{ name: 'องค์การบริหารส่วนตำบลหัวงัว' }],
  creator: 'องค์การบริหารส่วนตำบลหัวงัว',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: baseUrl,
    siteName: 'อบต.หัวงัว Citizen Help',
    title: 'อบต.หัวงัว — แจ้งเหตุ/ติดตามงานบริการสาธารณูปโภค',
    description:
      'ระบบแจ้งเหตุ/ติดตามงานบริการสาธารณูปโภค องค์การบริหารส่วนตำบลหัวงัว (อ.ยางตลาด จ.กาฬสินธุ์)',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
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
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
