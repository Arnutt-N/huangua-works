import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'อบต.หัวงัว - ระบบจัดการและบริการประชาชน',
    short_name: 'อบต.หัวงัว',
    description: 'ระบบรับเรื่องร้องเรียนและบริการจองคิวนัดหมาย อบต.หัวงัว อ.ยางตลาด จ.กาฬสินธุ์',
    start_url: '/',
    id: '/',
    display: 'standalone',
    background_color: '#fafcff',
    theme_color: '#1e40af',
    lang: 'th',
    scope: '/',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'คิวนัดหมายงานช่าง',
        short_name: 'คิวนัดช่าง',
        description: 'ตรวจสอบคิวนัดหมายลงพื้นที่งานช่าง',
        url: '/admin/queue',
      },
      {
        name: 'เรื่องร้องเรียนทั้งหมด',
        short_name: 'คิวเรื่อง',
        description: 'ตรวจสอบและจัดการเรื่องร้องเรียน',
        url: '/admin/reports',
      },
      {
        name: 'แจ้งเรื่องร้องเรียนใหม่',
        short_name: 'แจ้งเรื่อง',
        description: 'แบบฟอร์มรับเรื่องร้องเรียนสำหรับประชาชน',
        url: '/intake',
      },
      {
        name: 'จองคิวนัดหมาย',
        short_name: 'จองคิว',
        description: 'บริการจองคิวนัดหมายติดต่อ อบต.',
        url: '/queue',
      },
    ],
  };
}
