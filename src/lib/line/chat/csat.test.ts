import { describe, expect, it } from 'vitest';
import {
  buildCsatSurvey,
  csatThankYou,
  parseCsatPostback,
  recordCsatResponse,
  sendCsatSurvey,
} from './csat';

describe('parseCsatPostback', () => {
  it('รูปแบบถูก → score', () => {
    expect(parseCsatPostback('csat|5')).toEqual({ score: 5 });
  });
  it('คะแนนนอก 1-5 → null', () => {
    expect(parseCsatPostback('csat|0')).toBeNull();
    expect(parseCsatPostback('csat|6')).toBeNull();
  });
  it('ไม่ใช่ csat protocol → null', () => {
    expect(parseCsatPostback('confirm:ok')).toBeNull();
    expect(parseCsatPostback('csat')).toBeNull();
    expect(parseCsatPostback('csat|')).toBeNull();
  });
  it('wire ใหม่มี roundRef แนบ → คืน roundRef + score', () => {
    expect(parseCsatPostback('csat|2026-11-28T10:00:00.000Z|5')).toEqual({
      roundRef: '2026-11-28T10:00:00.000Z',
      score: 5,
    });
    expect(parseCsatPostback('csat|2026-11-28T10:00:00.000Z|9')).toBeNull();
  });
  it('wire เก่าไม่มี ref → รับช่วงเปลี่ยนผ่าน ใช้แค่ score', () => {
    expect(parseCsatPostback('csat|3')).toEqual({ score: 3 });
  });
});

describe('buildCsatSurvey', () => {
  it('มีปุ่ม 5-1 ครบ postback data มีแค่ score', () => {
    const survey = buildCsatSurvey();
    if (survey.type !== 'flex') throw new Error('survey ต้องเป็น flex');
    const footer = (survey.contents as { footer: { contents: unknown[] } }).footer.contents;
    expect(footer).toHaveLength(5);
    const data = JSON.stringify(footer);
    expect(data).toContain('csat|5');
    expect(data).toContain('csat|1');
  });
  it('มี roundRef → ปุ่มผูกกับรอบปิด', () => {
    const survey = buildCsatSurvey('2026-11-28T10:00:00.000Z');
    if (survey.type !== 'flex') throw new Error('survey ต้องเป็น flex');
    const data = JSON.stringify((survey.contents as { footer: unknown }).footer);
    expect(data).toContain('csat|2026-11-28T10:00:00.000Z|5');
  });
});

describe('csatThankYou', () => {
  it('คะแนนต่ำขอบคุณแบบปรับปรุง คะแนนสูงขอบคุณแบบดีใจ', () => {
    expect(csatThankYou(1)).toContain('ปรับปรุง');
    expect(csatThankYou(5)).toContain('ดีใจ');
  });
});

describe('recordCsatResponse', () => {
  it('คะแนนนอก 1-5 → invalid โดยไม่แตะ DB', async () => {
    await expect(recordCsatResponse({} as never, 'conv-ghost', 0, null)).resolves.toEqual({ kind: 'invalid' });
    await expect(recordCsatResponse({} as never, 'conv-ghost', 6, null)).resolves.toEqual({ kind: 'invalid' });
  });
  it('resolvedAt null → invalid (NULL ไม่ชน unique จะไหลไม่จำกัดแถว)', async () => {
    await expect(recordCsatResponse({} as never, 'conv-ghost', 5, null)).resolves.toEqual({ kind: 'invalid' });
  });
});

describe('sendCsatSurvey', () => {
  it('push ล้ม → จบเงียบ ไม่บันทึก transcript', async () => {
    const push = async () => {
      throw new Error('LINE down');
    };
    await expect(sendCsatSurvey('conv-x', 'U123', { push } as never)).resolves.toBeUndefined();
  });
});
