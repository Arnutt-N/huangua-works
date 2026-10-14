import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countFailures } from '../../scripts/check-contrast';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

describe('การลดการเคลื่อนไหวสำหรับผู้สูงอายุ', () => {
  it('กฎส่วนกลางลด animation/transition ทั้งตัว element และ pseudo-element โดยไม่เหลือ delay', () => {
    const guard = css.slice(css.indexOf('/* ---------- Motion safe guard'));
    const body = guard.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]+)\}/)?.[1];
    expect(body).toBeDefined();
    const declarations = Object.fromEntries(body!.replace(/\/\*[\s\S]*?\*\//g, '').split(';').filter((line) => line.includes(':')).map((line) => line.trim().split(/:\s*/)));
    expect(declarations['animation-duration']).toBe('0.01ms !important');
    expect(declarations['animation-iteration-count']).toBe('1 !important');
    expect(declarations['animation-delay']).toBe('0s !important');
    expect(declarations['transition-duration']).toBe('0.01ms !important');
    expect(declarations['transition-delay']).toBe('0s !important');
    expect(declarations['scroll-behavior']).toBe('auto !important');
  });

  it('คู่สีเดิมยังผ่าน contrast gate ทั้งสองธีมในการรันเฉพาะ tests งานนี้', () => {
    expect(countFailures(true)).toBe(0);
  });
});
