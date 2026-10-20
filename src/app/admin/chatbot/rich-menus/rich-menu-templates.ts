export interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number };
  action: { type: 'uri' | 'message'; uri?: string; text?: string };
}

export interface RichMenuTemplate {
  key: string;
  label: string;
  size: { width: number; height: number };
  areas: RichMenuArea[];
}

function gridAreas(
  cols: number,
  rows: number,
  width: number,
  height: number,
): RichMenuArea[] {
  const cw = Math.floor(width / cols);
  const ch = Math.floor(height / rows);
  const areas: RichMenuArea[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lastCol = c === cols - 1;
      const lastRow = r === rows - 1;
      areas.push({
        bounds: {
          x: c * cw,
          y: r * ch,
          width: lastCol ? width - c * cw : cw,
          height: lastRow ? height - r * ch : ch,
        },
        action: { type: 'message', text: '' },
      });
    }
  }
  return areas;
}

export const RICH_MENU_TEMPLATES: RichMenuTemplate[] = [
  {
    key: 'grid-3x2',
    label: '6 ปุ่ม (3×2)',
    size: { width: 2500, height: 1686 },
    areas: gridAreas(3, 2, 2500, 1686),
  },
  {
    key: 'grid-2x2',
    label: '4 ปุ่ม (2×2)',
    size: { width: 2500, height: 1686 },
    areas: gridAreas(2, 2, 2500, 1686),
  },
  {
    key: 'grid-2x1',
    label: '2 ปุ่ม (2×1)',
    size: { width: 2500, height: 843 },
    areas: gridAreas(2, 1, 2500, 843),
  },
];

export function templateByKey(key: string): RichMenuTemplate {
  return RICH_MENU_TEMPLATES.find((t) => t.key === key) ?? RICH_MENU_TEMPLATES[0]!;
}

export function validateArea(action: RichMenuArea['action']): string | null {
  if (action.type === 'uri') {
    if (!action.uri?.trim()) return 'กรุณากรอก URL';
    if (!/^https:\/\//.test(action.uri.trim())) return 'URL ต้องขึ้นต้นด้วย https://';
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
