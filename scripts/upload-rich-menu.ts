/**
 * scripts/upload-rich-menu.ts
 *
 * อัปโหลด Rich Menu ขึ้น LINE OA
 * — อ่าน PNG จาก scripts/rich-menu.png (สร้างด้วย generate-rich-menu.ts)
 * — สร้าง rich menu object → อัปโหลดรูป → ตั้งเป็น default
 *
 * ต้องมีใน .env.local:
 *   LINE_CHANNEL_ACCESS_TOKEN=...
 *
 * Usage:
 *   npx tsx scripts/upload-rich-menu.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RICH_MENU_BODY, createRichMenu, setDefaultRichMenu, uploadRichMenuImage } from '../src/lib/line/messages/rich-menu';

config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN || TOKEN === 'YOUR_LINE_CHANNEL_ACCESS_TOKEN') {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งใน .env.local');
  console.error('   กรุณาเพิ่ม token จาก LINE Developers Console แล้วรันใหม่');
  process.exit(1);
}

const PNG_PATH = join(__dirname, 'rich-menu.png');

async function main() {
  // 1. Read the generated PNG
  let imageBuffer: Buffer;
  try {
    imageBuffer = readFileSync(PNG_PATH);
  } catch {
    console.error(`❌ ไม่พบไฟล์ ${PNG_PATH}`);
    console.error('   รัน `npx tsx scripts/generate-rich-menu.ts` ก่อน');
    process.exit(1);
  }

  console.log('📋 Rich Menu config:');
  console.log(`   Name: ${RICH_MENU_BODY.name}`);
  console.log(`   Size: ${RICH_MENU_BODY.size.width}x${RICH_MENU_BODY.size.height}`);
  console.log(`   Areas: ${RICH_MENU_BODY.areas.length} (2x2 grid)`);
  console.log(`   PNG: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  console.log('');

  // 2. Create rich menu object via LINE API
  console.log('1/3 สร้าง rich menu object...');
  const richMenuId = await createRichMenu();
  if (!richMenuId) {
    console.error('❌ สร้าง rich menu ไม่สำเร็จ — ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN');
    process.exit(1);
  }
  console.log(`   ✅ richMenuId: ${richMenuId}`);

  // 3. Upload PNG image
  console.log('2/3 อัปโหลดรูป PNG...');
  const uploaded = await uploadRichMenuImage(richMenuId, imageBuffer);
  if (!uploaded) {
    console.error('❌ อัปโหลดรูปไม่สำเร็จ');
    process.exit(1);
  }
  console.log('   ✅ อัปโหลดสำเร็จ');

  // 4. Set as default rich menu
  console.log('3/3 ตั้งเป็น default rich menu...');
  const setDefault = await setDefaultRichMenu(richMenuId);
  if (!setDefault) {
    console.error('⚠️ ตั้ง default ไม่สำเร็จ (rich menu ยังอยู่ใน LINE แต่ไม่ได้แสดงอัตโนมัติ)');
    process.exit(1);
  }
  console.log('   ✅ ตั้งเป็น default แล้ว');

  console.log('');
  console.log('🎉 Rich Menu พร้อมใช้งาน!');
  console.log(`   richMenuId: ${richMenuId}`);
  console.log('   ผู้ใช้จะเห็น rich menu ในแชท LINE อัตโนมัติ');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});