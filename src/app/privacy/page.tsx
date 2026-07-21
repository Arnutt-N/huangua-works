import type { Metadata } from 'next';
import { ShieldCheck, FileText, Mail, Phone, UserCog, Database, Eye, Ban, RefreshCw } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว',
  description: 'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคล อบต.หัวงัว (PDPA พ.ร.บ. 2562)',
};

/**
 * /privacy — นโยบายความเป็นส่วนตัว
 *
 * ⚠️ เนื้อหานี้เป็นการสรุปเพื่อความเข้าใจ — ควรตรวจทบทวนโดยนิติกร
 * ก่อนใช้งานจริง เพื่อให้สอดคล้องกับ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
 * และกฎหมายที่เกี่ยวข้องอย่างสมบูรณ์
 */

const POLICY_VERSION = '1.0';
const POLICY_DATE = '20 กรกฎาคม 2569';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <header className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-sunken px-4 py-1.5 text-xs font-semibold text-accent-strong">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              เวอร์ชัน {POLICY_VERSION} · ปรับปรุง {POLICY_DATE}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              นโยบายความเป็นส่วนตัว
            </h1>
            <p className="mt-3 text-muted">
              องค์การบริหารส่วนตำบลหัวงัว ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคล
              ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
            </p>
          </header>

          {/* Disclaimer */}
          <div className="mb-8 rounded-md border border-warning/30 bg-warning-soft/40 px-5 py-4 text-sm text-ink">
            <p>
              <strong>หมายเหตุ:</strong> เอกสารนี้จัดทำเพื่อระบบรับแจ้งเหตุออนไลน์
              ควรตรวจทบทวนโดยนิติกรขององค์กรก่อนใช้งานจริง
            </p>
          </div>

          <div className="space-y-10">
            <Section icon={<Database className="h-5 w-5" />} title="1. ข้อมูลส่วนบุคคลที่เก็บรวบรวม">
              <p>ระบบรับแจ้งเหตุออนไลน์เก็บรวบรวมข้อมูลส่วนบุคคลดังต่อไปนี้:</p>
              <ul className="mt-3 space-y-2">
                <li>• <strong>เลขบัตรประจำตัวประชาชน</strong> — ใช้สำหรับตรวจสอบตัวตนและป้องกันการแจ้งเรื่องซ้ำซ้อน (เก็บในรูปแฮช ไม่เก็บเป็นข้อความตรง)</li>
                <li>• <strong>ชื่อ-นามสกุล</strong> — สำหรับติดต่อกลับและบันทึกประวัติ</li>
                <li>• <strong>เบอร์โทรศัพท์และอีเมล</strong> — สำหรับติดต่อกลับ (ใส่หรือไม่ใส่ก็ได้)</li>
                <li>• <strong>ที่อยู่/สถานที่เกิดเหตุ</strong> — สำหรับดำเนินการเกี่ยวกับเรื่องที่แจ้ง</li>
                <li>• <strong>รายละเอียดเรื่องร้องเรียก</strong> — สำหรับดำเนินการ</li>
                <li>• <strong>ที่อยู่ IP และ User-Agent</strong> — สำหรับความปลอดภัยและป้องกันการละเมิด</li>
              </ul>
            </Section>

            <Section icon={<Eye className="h-5 w-5" />} title="2. วัตถุประสงค์การเก็บข้อมูล">
              <p>ข้อมูลส่วนบุคคลที่เก็บรวบรวมใช้เพื่อ:</p>
              <ul className="mt-3 space-y-2">
                <li>• รับและดำเนินการเรื่องแจ้งเหตุ/ร้องเรียก</li>
                <li>• ติดตามสถานะและแจ้งผลการดำเนินการให้ประชาชน</li>
                <li>• ป้องกันการแจ้งเรื่องซ้ำซ้อนในช่วง 7 วัน</li>
                <li>• รวบรวมสถิติเพื่อประเมินประสิทธิภาพการให้บริการ</li>
                <li>• ป้องกันและตรวจสอบการละเมิดกฎหมายหรือนโยบาย</li>
              </ul>
            </Section>

            <Section icon={<FileText className="h-5 w-5" />} title="3. การเก็บรักษาข้อมูล">
              <p>
                ข้อมูลถูกเก็บรักษาในระบบฐานข้อมูลของอบต.หัวงัว
                โดยมีมาตรการรักษาความปลอดภัยตามมาตรฐาน PDPA ได้แก่:
              </p>
              <ul className="mt-3 space-y-2">
                <li>• เข้ารหัสรหัสผ่านด้วย bcrypt</li>
                <li>• เลขบัตรประชาชนเก็บในรูป HMAC-SHA256 (ไม่สามารถถอดกลับได้)</li>
                <li>• การเข้าถึงข้อมูลมีการบันทึก audit log ทุกครั้ง</li>
                <li>• ระบบมีการสำรองข้อมูลเป็นระยะ</li>
                <li>• การเข้าถึงส่วนเจ้าหน้าที่ต้องผ่านการยืนยันตัวตน</li>
              </ul>
              <p className="mt-3">
                ระยะเวลาเก็บรักษา: ข้อมูลเรื่องแจ้งเหตุเก็บไว้ตามระยะเวลาที่กฎหมายกำหนด
                หรือตามความจำเป็นในการดำเนินการ
              </p>
            </Section>

            <Section icon={<UserCog className="h-5 w-5" />} title="4. สิทธิของเจ้าของข้อมูล">
              <p>ประชาชนมีสิทธิตาม PDPA ดังต่อไปนี้:</p>
              <ul className="mt-3 space-y-2">
                <li>• <strong>สิทธิเข้าถึงข้อมูล</strong> — ขอดูข้อมูลส่วนบุคคลที่เก็บไว้</li>
                <li>• <strong>สิทธิแก้ไขข้อมูล</strong> — ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                <li>• <strong>สิทธิถอนความยินยอม</strong> — ถอนความยินยอมในการเก็บข้อมูล</li>
                <li>• <strong>สิทธิขอให้ลบหรือทำลายข้อมูล</strong> — กรณีไม่จำเป็นต้องเก็บต่อ</li>
                <li>• <strong>สิทธิร้องเรียน</strong> — ร้องเรียนต่อคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล</li>
              </ul>
            </Section>

            <Section icon={<RefreshCw className="h-5 w-5" />} title="5. การถอนความยินยอม">
              <p>
                ประชาชนสามารถถอนความยินยอมในการเก็บข้อมูลได้โดย:
              </p>
              <ul className="mt-3 space-y-2">
                <li>• ใช้ระบบถอนความยินยอมออนไลน์ (ใช้รหัสติดตามงานและเลขบัตรประชาชน)</li>
                <li>• ติดต่อเจ้าหน้าที่โดยตรงที่อบต.หัวงัว</li>
              </ul>
              <p className="mt-3">
                เมื่อถอนความยินยอมแล้ว ข้อมูลจะถูกทำให้ไม่สามารถเข้าถึงได้ผ่านระบบติดตามงาน
                และจะถูกลบหรือทำให้ไม่ระบุตัวตนได้ตามระยะเวลาที่กฎหมายกำหนด
              </p>
            </Section>

            <Section icon={<Ban className="h-5 w-5" />} title="6. การเปิดเผยข้อมูล">
              <p>
                อบต.หัวงัวจะไม่เปิดเผยข้อมูลส่วนบุคคลให้แก่บุคคลที่สาม
                ยกเว้นในกรณีต่อไปนี้:
              </p>
              <ul className="mt-3 space-y-2">
                <li>• ได้รับความยินยอมจากเจ้าของข้อมูล</li>
                <li>• มีหน้าที่ตามกฎหมายในการเปิดเผย</li>
                <li>• เพื่อประโยชน์สาธารณะหรือความมั่นคง</li>
                <li>• หน่วยงานราชการที่เกี่ยวข้องในการดำเนินการเรื่องร้องเรียก</li>
              </ul>
            </Section>

            <Section icon={<Mail className="h-5 w-5" />} title="7. ติดต่อเจ้าหน้าที่คุ้มครองข้อมูล">
              <p>หากมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัวหรือสิทธิตาม PDPA สามารถติดต่อ:</p>
              <div className="mt-4 rounded-md border border-border bg-surface-raised p-5">
                <p className="font-semibold text-ink">เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO)</p>
                <p className="mt-2 text-sm text-muted">
                  องค์การบริหารส่วนตำบลหัวงัว<br />
                  อำเภอยางตลาด จังหวัดกาฬสินธุ์ 46120
                </p>
                <div className="mt-3 space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span>043-123456</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span>dpo@huangua.go.th</span>
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink">
        <span className="text-accent-strong">{icon}</span>
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
