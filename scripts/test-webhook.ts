/**
 * scripts/test-webhook.ts
 *
 * ทดสอบ LINE webhook ในเครื่อง (localhost)
 * — ส่ง webhook event จำลองพร้อม signature ที่ถูกต้อง
 * — ใช้สำหรับ verify ว่า webhook + bot engine ทำงานก่อนเชื่อม LINE Console
 *
 * Usage:
 *   npx tsx scripts/test-webhook.ts [event-type]
 *   npx tsx scripts/test-webhook.ts          # default: follow event (welcome)
 *   npx tsx scripts/test-webhook.ts message  # text message "แจ้งเรื่อง"
 *   npx tsx scripts/test-webhook.ts handoff  # text message "ติดต่อเจ้าหน้าที่"
 */

import { config } from 'dotenv';
import { createHmac } from 'crypto';

config({ path: '.env.local' });

const SECRET = process.env.LINE_CHANNEL_SECRET;
const BASE = process.argv[2] ?? 'http://localhost:3001';
const EVENT_TYPE = process.argv[3] ?? 'follow';

if (!SECRET) {
  console.error('❌ LINE_CHANNEL_SECRET ไม่ได้ตั้งใน .env.local');
  process.exit(1);
}

const TEST_USER_ID = 'U_test_local_webhook_user';

function buildEvent(type: string) {
  const base = {
    replyToken: 'test-reply-token-' + Date.now(),
    timestamp: Date.now(),
    mode: 'active' as const,
    source: { type: 'user' as const, userId: TEST_USER_ID },
  };

  switch (type) {
    case 'follow':
      return { ...base, type: 'follow' };
    case 'message':
    case 'handoff':
      return {
        ...base,
        type: 'message',
        message: {
          type: 'text',
          id: 'msg-' + Date.now(),
          text: type === 'handoff' ? 'ติดต่อเจ้าหน้าที่' : 'แจ้งเรื่อง',
        },
      };
    default:
      return { ...base, type: 'message', message: { type: 'text', id: 'msg-' + Date.now(), text: type } };
  }
}

async function main() {
  const event = buildEvent(EVENT_TYPE);
  const body = JSON.stringify({
    destination: 'U_test_oa',
    events: [event],
  });

  const signature = createHmac('sha256', SECRET).update(body, 'utf8').digest('base64');

  console.log(`📤 Sending ${EVENT_TYPE} event to ${BASE}/api/line/webhook`);
  console.log(`   Body length: ${body.length}`);
  console.log(`   Signature: ${signature.substring(0, 20)}...`);

  try {
    const res = await fetch(`${BASE}/api/line/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': signature,
      },
      body,
    });

    const status = res.status;
    const text = await res.text();
    console.log(`\n📥 Response: ${status}`);
    console.log(`   Body: ${text}`);

    if (status === 200) {
      console.log('\n✅ Webhook รับ event สำเร็จ — signature verification + bot engine ทำงาน');
      console.log('   (replyMessage จะ fail เพราะ replyToken เป็น fake — ปกติ)');
    } else if (status === 401) {
      console.log('\n❌ Signature verification ล้มเหลว — ตรวจ LINE_CHANNEL_SECRET');
    } else {
      console.log(`\n⚠️ Status ${status} — ตรวจ logs ของ dev server`);
    }
  } catch (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ dev server:', err);
    console.error('   ตรวจสอบว่า dev server รันอยู่ (pnpm dev / npx next dev)');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});