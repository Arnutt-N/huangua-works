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
  it('ไม่ใช่ csat protocol หรือมี id แนบ → null', () => {
    expect(parseCsatPostback('confirm:ok')).toBeNull();
    expect(parseCsatPostback('csat')).toBeNull();
    expect(parseCsatPostback('csat|conv-1|5')).toBeNull();
  });
});

describe('buildCsatSurvey', () => {
  it('มีปุ่ม 5-1 ครบพร้อม postback data มีแค่ score', () => {
    const survey = buildCsatSurvey();
    if (survey.type !== 'flex') throw new Error('survey ต้องเป็น flex');
    const footer = (survey.contents as { footer: { contents: unknown[] } }).footer.contents;
    expect(footer).toHaveLength(5);
    const data = JSON.stringify(footer);
    expect(data).toContain('csat|5');
    expect(data).toContain('csat|1');
    expect(data).not.toContain('conv-');
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
    await expect(recordCsatResponse('conv-ghost', 0)).resolves.toEqual({ kind: 'invalid' });
    await expect(recordCsatResponse('conv-ghost', 6)).resolves.toEqual({ kind: 'invalid' });
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
