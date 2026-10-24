export interface RichMenuAreaAction {
  type: 'uri' | 'message' | 'richmenuswitch';
  uri?: string;
  text?: string;
  richMenuAliasId?: string;
}

export interface RichMenuArea {
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  action: RichMenuAreaAction;
}

export type RichMenuTemplateGroup = 'Large' | 'Compact';

export interface RichMenuTemplate {
  key: string;
  label: string;
  group: RichMenuTemplateGroup;
  size: { width: number; height: number };
  areas: RichMenuArea[];
}

const LARGE = { width: 2500, height: 1686 } as const;
const COMPACT = { width: 2500, height: 843 } as const;

function area(
  label: string,
  bounds: RichMenuArea['bounds'],
): RichMenuArea {
  return { label, bounds, action: { type: 'uri', uri: '' } };
}

// § 11 เทมเพลตตาม LINE OA Manager (Large 7 + Compact 4) — ผังเดียวกับ jsk-app
export const RICH_MENU_TEMPLATES: RichMenuTemplate[] = [
  {
    key: 'large-6',
    label: '6 Buttons (3x2)',
    group: 'Large',
    size: LARGE,
    areas: [
      area('Area 1', { x: 0, y: 0, width: 833, height: 843 }),
      area('Area 2', { x: 833, y: 0, width: 834, height: 843 }),
      area('Area 3', { x: 1667, y: 0, width: 833, height: 843 }),
      area('Area 4', { x: 0, y: 843, width: 833, height: 843 }),
      area('Area 5', { x: 833, y: 843, width: 834, height: 843 }),
      area('Area 6', { x: 1667, y: 843, width: 833, height: 843 }),
    ],
  },
  {
    key: 'large-4',
    label: '4 Buttons (2x2)',
    group: 'Large',
    size: LARGE,
    areas: [
      area('Top Left', { x: 0, y: 0, width: 1250, height: 843 }),
      area('Top Right', { x: 1250, y: 0, width: 1250, height: 843 }),
      area('Bottom Left', { x: 0, y: 843, width: 1250, height: 843 }),
      area('Bottom Right', { x: 1250, y: 843, width: 1250, height: 843 }),
    ],
  },
  {
    key: 'large-3-top',
    label: '3 Buttons (1 Top, 2 Bottom)',
    group: 'Large',
    size: LARGE,
    areas: [
      area('Top', { x: 0, y: 0, width: 2500, height: 843 }),
      area('Bottom Left', { x: 0, y: 843, width: 1250, height: 843 }),
      area('Bottom Right', { x: 1250, y: 843, width: 1250, height: 843 }),
    ],
  },
  {
    key: 'large-3-left',
    label: '3 Buttons (1 Left, 2 Right)',
    group: 'Large',
    size: LARGE,
    areas: [
      area('Main (Left)', { x: 0, y: 0, width: 1667, height: 1686 }),
      area('Top Right', { x: 1667, y: 0, width: 833, height: 843 }),
      area('Bottom Right', { x: 1667, y: 843, width: 833, height: 843 }),
    ],
  },
  {
    key: 'large-2-rows',
    label: '2 Buttons (Rows)',
    group: 'Large',
    size: LARGE,
    areas: [
      area('Top', { x: 0, y: 0, width: 2500, height: 843 }),
      area('Bottom', { x: 0, y: 843, width: 2500, height: 843 }),
    ],
  },
  {
    key: 'large-2-cols',
    label: '2 Buttons (Columns)',
    group: 'Large',
    size: LARGE,
    areas: [
      area('Left', { x: 0, y: 0, width: 1250, height: 1686 }),
      area('Right', { x: 1250, y: 0, width: 1250, height: 1686 }),
    ],
  },
  {
    key: 'large-1',
    label: '1 Button (Full)',
    group: 'Large',
    size: LARGE,
    areas: [area('Full Area', { x: 0, y: 0, width: 2500, height: 1686 })],
  },
  {
    key: 'compact-3',
    label: '3 Buttons (Columns)',
    group: 'Compact',
    size: COMPACT,
    areas: [
      area('Left', { x: 0, y: 0, width: 833, height: 843 }),
      area('Middle', { x: 833, y: 0, width: 834, height: 843 }),
      area('Right', { x: 1667, y: 0, width: 833, height: 843 }),
    ],
  },
  {
    key: 'compact-2-cols',
    label: '2 Buttons (Columns)',
    group: 'Compact',
    size: COMPACT,
    areas: [
      area('Left', { x: 0, y: 0, width: 1250, height: 843 }),
      area('Right', { x: 1250, y: 0, width: 1250, height: 843 }),
    ],
  },
  {
    key: 'compact-2-asym',
    label: '2 Buttons (Small Left)',
    group: 'Compact',
    size: COMPACT,
    areas: [
      area('Left', { x: 0, y: 0, width: 833, height: 843 }),
      area('Right', { x: 833, y: 0, width: 1667, height: 843 }),
    ],
  },
  {
    key: 'compact-1',
    label: '1 Button (Full)',
    group: 'Compact',
    size: COMPACT,
    areas: [area('Full Area', { x: 0, y: 0, width: 2500, height: 843 })],
  },
];

export function templateByKey(key: string): RichMenuTemplate {
  return RICH_MENU_TEMPLATES.find((t) => t.key === key) ?? RICH_MENU_TEMPLATES[0]!;
}

export function templatesByGroup(group: RichMenuTemplateGroup): RichMenuTemplate[] {
  return RICH_MENU_TEMPLATES.filter((t) => t.group === group);
}

export function validateArea(action: RichMenuAreaAction): string | null {
  if (action.type === 'richmenuswitch') {
    if (!action.richMenuAliasId?.trim()) return 'ต้องเลือก alias ปลายทาง';
    return null;
  }
  if (action.type === 'uri') {
    if (!action.uri?.trim()) return 'กรุณากรอก URL';
    if (!/^https:\/\//.test(action.uri.trim())) return 'URL ต้องขึ้นต้นด้วย https://';
    // § template ฝัง <LIFF_ID> เป็น placeholder — กันตั้งแต่ validate ไม่ให้ขึ้น LINE เป็นปุ่มพัง
    if (/<\s*LIFF_ID\s*>/i.test(action.uri) || action.uri.includes('<') || action.uri.includes('>')) {
      return 'กรุณาแทน <LIFF_ID> ด้วยค่า LINE_LIFF_ID จริงก่อนบันทึก';
    }
    return null;
  }
  if (!action.text?.trim()) return 'กรุณากรอกข้อความที่จะส่ง';
  if (action.text.trim().length > 300) return 'ข้อความยาวเกิน 300 ตัวอักษร';
  return null;
}

export function areaStyle(
  bounds: RichMenuArea['bounds'],
  size: RichMenuTemplate['size'],
): { left: string; top: string; width: string; height: string } {
  return {
    left: `${(bounds.x / size.width) * 100}%`,
    top: `${(bounds.y / size.height) * 100}%`,
    width: `${(bounds.width / size.width) * 100}%`,
    height: `${(bounds.height / size.height) * 100}%`,
  };
}

/** action แบบสั้นสำหรับเก็บลง LINE config (ตัด field ของ UI ออก) */
export function toLineAction(action: RichMenuAreaAction): RichMenuAreaAction {
  if (action.type === 'uri') return { type: 'uri', uri: action.uri?.trim() ?? '' };
  if (action.type === 'richmenuswitch') {
    return { type: 'richmenuswitch', richMenuAliasId: action.richMenuAliasId };
  }
  return { type: 'message', text: action.text?.trim() ?? '' };
}
