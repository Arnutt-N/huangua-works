import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-surface-raised">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold">อบต.หัวงัว Smart Service</h3>
            <p className="mt-4 text-sm text-muted">
              ระบบรับแจ้งเหตุและติดตามงานบริการสาธารณูปโภคออนไลน์
              เพื่อการบริการที่รวดเร็ว โปร่งใส และมีประสิทธิภาพ
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold">ลิงก์ด่วน</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="#home" className="text-muted transition-colors hover:text-accent">
                  หน้าแรก
                </Link>
              </li>
              <li>
                <Link href="#services" className="text-muted transition-colors hover:text-accent">
                  บริการของเรา
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="text-muted transition-colors hover:text-accent">
                  ขั้นตอนการทำงาน
                </Link>
              </li>
              <li>
                <Link href="#tracking" className="text-muted transition-colors hover:text-accent">
                  ติดตามงาน
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold">บริการ</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>ไฟฟ้าสาธารณะ</li>
              <li>ประปาหมู่บ้าน</li>
              <li>ถนน</li>
              <li>การระบายน้ำ</li>
              <li>ซ่อมบำรุง</li>
              <li>สิ่งแวดล้อม</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold">ติดต่อเรา</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                <span className="text-muted">
                  อบต.หัวงัว อ.ยางตลาด จ.กาฬสินธุ์ 46120
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0 text-accent" />
                <a href="tel:043-123456" className="text-muted transition-colors hover:text-accent">
                  043-123456
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0 text-accent" />
                <a
                  href="mailto:contact@huangua.go.th"
                  className="text-muted transition-colors hover:text-accent"
                >
                  contact@huangua.go.th
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0 text-accent" />
                <a
                  href="https://facebook.com/huanguasao"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted transition-colors hover:text-accent"
                >
                  facebook.com/huanguasao
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8 text-center text-sm text-muted">
          <p>
            © {new Date().getFullYear()} องค์การบริหารส่วนตำบลหัวงัว อ.ยางตลาด จ.กาฬสินธุ์
            | สงวนลิขสิทธิ์
          </p>
          <p className="mt-2">
            <Link href="/privacy" className="hover:text-accent">
              นโยบายความเป็นส่วนตัว
            </Link>
            {' • '}
            <Link href="/terms" className="hover:text-accent">
              เงื่อนไขการใช้งาน
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
