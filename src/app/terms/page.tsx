import type { Metadata } from 'next';
import { FileText, AlertCircle, CheckSquare, Ban, Scale } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'เงื่อนไขการใช้งาน',
  description: 'เงื่อนไขและข้อตกลงในการใช้ระบบรับแจ้งเหตุออนไลน์ อบต.หัวงัว',
};

const TERMS_DATE = '20 กรกฎาคม 2569';

/**
 * /terms — เงื่อนไขการใช้งาน
 *
 * ⚠️ ควรตรวจทบทวนโดยนิติกรก่อนใช้งานจริง
 */

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <header className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-sunken px-4 py-1.5 text-xs font-semibold text-accent-strong">
              <FileText className="h-4 w-4" aria-hidden="true" />
              ปรับปรุง {TERMS_DATE}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              เงื่อนไขการใช้งาน
            </h1>
            <p className="mt-3 text-muted">
              เงื่อนไขและข้อตกลงสำหรับการใช้ระบบรับแจ้งเหตุออนไลน์
              องค์การบริหารส่วนตำบลหัวงัว
            </p>
          </header>

          <div className="mb-8 rounded-md border border-warning/30 bg-warning-soft/40 px-5 py-4 text-sm text-ink">
            <p>
              <strong>หมายเหตุ:</strong> เอกสารนี้จัดทำเพื่อระบบรับแจ้งเหตุออนไลน์
              ควรตรวจทบทวนโดยนิติกรขององค์กรก่อนใช้งานจริง
            </p>
          </div>

          <div className="space-y-10">
            <Section icon={<CheckSquare className="h-5 w-5" />} title="1. การยอมรับเงื่อนไข">
              <p>
                การใช้ระบบรับแจ้งเหตุออนไลน์ของอบต.หัวงัว ถือว่าผู้ใช้ได้อ่าน
                และยอมรับเงื่อนไขและข้อตกลงทั้งหมดในเอกสารฉบับนี้
                หากไม่ยอมรับเงื่อนไขใดๆ ผู้ใช้ไม่ควรใช้ระบบนี้
              </p>
            </Section>

            <Section icon={<FileText className="h-5 w-5" />} title="2. การใช้บริการ">
              <p>ผู้ใช้สามารถ:</p>
              <ul className="mt-3 space-y-2">
                <li>• แจ้งเหตุ/ร้องเรียกเกี่ยวกับบริการสาธารณูปโภค</li>
                <li>• ติดตามสถานะเรื่องที่แจ้งผ่านรหัสติดตามงาน</li>
                <li>• ถอนความยินยอมในการเก็บข้อมูลได้</li>
              </ul>
              <p className="mt-3">ผู้ใช้ตกลงที่จะ:</p>
              <ul className="mt-3 space-y-2">
                <li>• ให้ข้อมูลที่ถูกต้องและเป็นจริง</li>
                <li>• ไม่แจ้งเรื่องที่เป็นเท็จหรือทำให้เสียหาย</li>
                <li>• ไม่ส่งข้อมูลที่ละเมิดสิทธิผู้อื่น</li>
                <li>• ไม่ใช้ระบบเพื่อก่อกวนหรือสแปม</li>
              </ul>
            </Section>

            <Section icon={<Ban className="h-5 w-5" />} title="3. ข้อจำกัดความรับผิดชอบ">
              <p>
                อบต.หัวงัวจะดำเนินการเรื่องที่ได้รับแจ้งตามลำดับความสำคัญ
                และความเป็นไปได้ทางงบประมาณ โดยไม่รับประกัน:
              </p>
              <ul className="mt-3 space-y-2">
                <li>• ระยะเวลาดำเนินการที่แน่นอน (ขึ้นกับลักษณะเรื่องและงบประมาณ)</li>
                <li>• ผลลัพธ์ตามที่ผู้แจ้งคาดหวังทุกประการ</li>
                <li>• ความพร้อมของระบบตลอด 24 ชั่วโมง (อาจมีการปิดปรับปรุง)</li>
              </ul>
            </Section>

            <Section icon={<AlertCircle className="h-5 w-5" />} title="4. การแจ้งเรื่องเท็จ">
              <p>
                การแจ้งเรื่องอันเป็นเท็จหรือใส่ความผู้อื่นอาจมีความผิดตามกฎหมาย
                อบต.หัวงัวอาจดำเนินคดีตามกฎหมายที่เกี่ยวข้อง
                และ/หรือระงับการให้บริการแก่ผู้กระทำความผิด
              </p>
            </Section>

            <Section icon={<Scale className="h-5 w-5" />} title="5. กฎหมายที่ใช้บังคับ">
              <p>
                เงื่อนไขการใช้งานฉบับนี้อยู่ภายใต้กฎหมายไทย
                หากมีข้อพิพาทให้ใช้เขตอำเภอยางตลาด จังหวัดกาฬสินธุ์
                เป็นศาลที่มีเขตอำนาจศาล
              </p>
            </Section>

            <Section icon={<FileText className="h-5 w-5" />} title="6. การแก้ไขเงื่อนไข">
              <p>
                อบต.หัวงัวสงวนสิทธิในการแก้ไขเงื่อนไขการใช้งานได้ตลอดเวลา
                การแก้ไขจะมีผลเมื่อเผยแพร่บนเว็บไซต์นี้
                ผู้ใช้ควรตรวจสอบเงื่อนไขเป็นระยะ
              </p>
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
