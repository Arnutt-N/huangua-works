import { describe, expect, test } from 'vitest';
import { findInvalidRichMenuArea, isValidRichMenuUri } from '@/lib/contracts';
import { formatPublishRichMenuError, isRichMenuDrift, normalizeRichMenuConfig } from './rich-menu-service';

const BASE = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'เมนูบริการงานช่าง อบต.หัวงัว',
  chatBarText: 'เมนูหลัก',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'uri', uri: 'https://liff.line.me/X/intake' },
    },
  ],
};

describe('isRichMenuDrift', () => {
  test('config ตรงกัน → ไม่ drift', () => {
    expect(isRichMenuDrift(BASE, { ...BASE })).toBe(false);
  });

  test('areas เปลี่ยน → drift', () => {
    const edited = { ...BASE, areas: [] };
    expect(isRichMenuDrift(edited, BASE)).toBe(true);
  });

  test('key เฉพาะ local (selected) ต่างกัน → ไม่ drift', () => {
    expect(isRichMenuDrift({ ...BASE, selected: false }, BASE)).toBe(false);
  });

  test('ฝั่ง LINE ไม่มีเมนู (null) → drift (stale)', () => {
    expect(isRichMenuDrift(BASE, null)).toBe(true);
  });

  test('chatBarText เปลี่ยน → drift', () => {
    expect(isRichMenuDrift({ ...BASE, chatBarText: 'เมนู' }, BASE)).toBe(true);
  });
});

describe('findInvalidRichMenuArea & isValidRichMenuUri', () => {
  test('ปฏิเสธ uri ว่าง หรือไม่มี host', () => {
    expect(findInvalidRichMenuArea([{ action: { type: 'uri', uri: '' } }])).toBe('(ค่าว่าง)');
    expect(findInvalidRichMenuArea([{ action: { type: 'uri', uri: '   ' } }])).toBe('(ค่าว่าง)');
    expect(findInvalidRichMenuArea([{ action: { type: 'uri' } }])).toBe('(ค่าว่าง)');
    expect(findInvalidRichMenuArea([{ action: { type: 'uri', uri: 'https://' } }])).toBe('https://');
  });

  test('ปฏิเสธ placeholder <LIFF_ID> และอักขระผิดสเปก URI ของ LINE', () => {
    const liffPlaceholder = 'https://liff.line.me/<LIFF_ID>/intake?category=roads-sidewalks';
    expect(isValidRichMenuUri(liffPlaceholder)).toBe(false);
    expect(findInvalidRichMenuArea([{ action: { type: 'uri', uri: liffPlaceholder } }])).toBe(
      liffPlaceholder,
    );
    expect(isValidRichMenuUri('https://example.com/path with space')).toBe(false);
    expect(isValidRichMenuUri('http://example.com')).toBe(false);
  });

  test('ยอมรับ https URI ที่สมบูรณ์และข้ามปุ่ม message', () => {
    expect(
      findInvalidRichMenuArea([
        { action: { type: 'uri', uri: 'https://liff.line.me/2010836454-II8nghWc/intake?category=water-supply' } },
        { action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' } },
      ]),
    ).toBeNull();
  });
});

describe('normalizeRichMenuConfig', () => {
  const LEGACY_6_AREAS = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'เมนูบริการงานช่าง อบต.หัวงัว',
    chatBarText: 'เมนูหลัก',
    areas: [
      { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake?category=roads-sidewalks' } },
      { bounds: { x: 833, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake?category=electricity-lighting' } },
      { bounds: { x: 1666, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake?category=water-supply' } },
      { bounds: { x: 0, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/intake' } },
      { bounds: { x: 833, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://liff.line.me/<LIFF_ID>/track' } },
      { bounds: { x: 1666, y: 843, width: 834, height: 843 }, action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' } },
    ],
  };

  test('แทน <LIFF_ID> ด้วย liffId เมื่อตั้งค่าไว้ และผ่าน findInvalidRichMenuArea ครบทั้ง 6 ปุ่ม', () => {
    const { config, changed } = normalizeRichMenuConfig(LEGACY_6_AREAS, {
      liffId: '2010836454-II8nghWc',
      authUrl: 'http://localhost:3000',
    });
    expect(changed).toBe(true);
    expect(findInvalidRichMenuArea(config.areas)).toBeNull();
    const areas = config.areas as Array<{ action: { uri?: string } }>;
    expect(areas[0]!.action.uri).toBe(
      'https://liff.line.me/2010836454-II8nghWc/intake?category=roads-sidewalks',
    );
    expect(areas[4]!.action.uri).toBe('https://liff.line.me/2010836454-II8nghWc/track');
  });

  test('fallback เป็น AUTH_URL (https) เมื่อยังไม่ได้ตั้ง LIFF ID', () => {
    const { config, changed } = normalizeRichMenuConfig(LEGACY_6_AREAS, {
      liffId: null,
      authUrl: 'https://huangua-works.vercel.app',
    });
    expect(changed).toBe(true);
    expect(findInvalidRichMenuArea(config.areas)).toBeNull();
    const areas = config.areas as Array<{ action: { uri?: string } }>;
    expect(areas[0]!.action.uri).toBe(
      'https://huangua-works.vercel.app/intake?category=roads-sidewalks',
    );
    expect(areas[3]!.action.uri).toBe('https://huangua-works.vercel.app/intake');
  });

  test('ไม่แปลงเป็น http://localhost เมื่อไม่มีทั้ง LIFF ID และ https AUTH_URL (ให้ validator จับได้)', () => {
    const { config, changed } = normalizeRichMenuConfig(LEGACY_6_AREAS, {
      liffId: null,
      authUrl: 'http://localhost:3000',
    });
    expect(changed).toBe(false);
    expect(findInvalidRichMenuArea(config.areas)).toContain('<LIFF_ID>');
  });

  test('เติม data ให้ปุ่ม richmenuswitch ที่ยังไม่มี data', () => {
    const { config, changed } = normalizeRichMenuConfig({
      areas: [
        {
          bounds: { x: 0, y: 0, width: 833, height: 843 },
          action: { type: 'richmenuswitch', richMenuAliasId: 'main-menu' },
        },
      ],
    });
    expect(changed).toBe(true);
    const areas = config.areas as Array<{ action: { data?: string } }>;
    expect(areas[0]!.action.data).toBe('richmenuswitch:main-menu');
  });
});

describe('formatPublishRichMenuError', () => {
  test('แปลง error must upload richmenu image ของ LINE เป็นข้อความภาษาไทยที่ชัดเจน', () => {
    const err = new Error(
      'LINE API /user/all/richmenu/richmenu-05fd3b3b9b580731c8c5358ec7da5352 failed (400): {"message":"must upload richmenu image before applying it to user","details":[]}',
    );
    expect(formatPublishRichMenuError(err)).toContain('ต้องอัปโหลดรูปภาพเมนูก่อนตั้งเป็นเมนูหลัก');
  });

  test('คืนข้อความเดิมสำหรับ error อื่น', () => {
    expect(formatPublishRichMenuError(new Error('network timeout'))).toBe('network timeout');
  });
});
