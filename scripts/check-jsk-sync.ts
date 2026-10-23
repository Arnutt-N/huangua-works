/**
 * ตรวจสอบความเปลี่ยนแปลงใหม่จากโปรเจคต้นแบบ JSK-App (D:\genAI\jsk-app)
 * เทียบกับจุดซิงค์ล่าสุดใน .agents/jsk-sync-state.json
 *
 * วิธีรัน:
 *   npx tsx scripts/check-jsk-sync.ts
 */

import fs from 'node:fs';
import path from 'node:path';

interface SyncState {
  jskRepoPath: string;
  jskSessionLogDir: string;
  lastSyncedSessionFile: string;
  lastSyncedJskHead: string;
  lastSyncedAt: string;
}

const STATE_PATH = path.resolve(process.cwd(), '.agents/jsk-sync-state.json');

function main() {
  if (!fs.existsSync(STATE_PATH)) {
    console.error(`ไม่พบไฟล์สถานะการซิงค์: ${STATE_PATH}`);
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as SyncState;
  console.log('=== สถานะการซิงค์ JSK-App -> Huangua-Works ===');
  console.log(`ซิงค์ล่าสุดเมื่อ: ${state.lastSyncedAt}`);
  console.log(`ไฟล์เซสชันล่าสุดที่ซิงค์แล้ว: ${state.lastSyncedSessionFile}`);
  console.log(`Commit ล่าสุดของ JSK ที่ซิงค์แล้ว: ${state.lastSyncedJskHead}\n`);

  if (!fs.existsSync(state.jskSessionLogDir)) {
    console.error(`ไม่พบโฟลเดอร์บันทึกเซสชันของ JSK: ${state.jskSessionLogDir}`);
    process.exit(1);
  }

  const allFiles = fs
    .readdirSync(state.jskSessionLogDir)
    .filter((f) => f.startsWith('session-summary-') && f.endsWith('.md'))
    .sort();

  const newFiles = allFiles.filter((f) => f > state.lastSyncedSessionFile);

  if (newFiles.length === 0) {
    console.log('✅ ไม่มี Session Summary ใหม่ใน JSK-App นับจากครั้งล่าสุดที่ซิงค์');
    return;
  }

  console.log(`🔔 พบ Session Summary ใหม่ใน JSK-App จำนวน ${newFiles.length} ไฟล์:\n`);
  for (const file of newFiles) {
    const fullPath = path.join(state.jskSessionLogDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    console.log(`------------------------------------------------------------`);
    console.log(`📄 ไฟล์: ${file}`);
    console.log(`------------------------------------------------------------`);
    console.log(content.trim());
    console.log('\n');
  }
}

main();
